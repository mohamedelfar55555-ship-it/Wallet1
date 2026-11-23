import { readSheet } from 'read-excel-file/browser';
import type {
  ImportedSourceType,
  ImportedTransactionType,
  ParsedTransactionCandidate,
} from '../types/wallet';
import {
  detectTransactionType,
  extractAmount,
  extractEgyptianPhone,
  extractReferenceCode,
  extractTimestampIso,
  normalizeDigits,
} from './transactionParser';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

export interface FileParseResult {
  sourceType: ImportedSourceType;
  fileName: string;
  candidates: ParsedTransactionCandidate[];
  errors: string[];
  totalRawRows: number;
}

function normalizeHeaderKey(key: string): string {
  return normalizeDigits(key).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function mapTransactionTypeValue(rawVal: string, fallbackText: string): ImportedTransactionType {
  const lower = normalizeDigits(rawVal).trim().toLowerCase();
  if (/^(send|sent|transfer_out|debit|تحويل|ارسال|صادر|دفع|مدفوعات|شحن)$/.test(lower)) {
    return 'send';
  }
  if (/^(receive|received|credit|استلام|وارد)$/.test(lower)) {
    return 'receive';
  }
  if (/^(withdraw|atm|سحب)$/.test(lower)) {
    return 'withdraw';
  }
  if (/^(deposit|ايداع|إيداع)$/.test(lower)) {
    return 'deposit';
  }
  return detectTransactionType(`${rawVal} ${fallbackText}`);
}

function mapRowObjectToCandidate(
  rowObj: Record<string, unknown>,
  sourceType: ImportedSourceType,
  index: number
): { candidate?: ParsedTransactionCandidate; error?: string } {
  const normalizedEntries = new Map<string, string>();
  for (const [k, v] of Object.entries(rowObj)) {
    normalizedEntries.set(normalizeHeaderKey(k), String(v ?? '').trim());
  }

  const getFirst = (keys: string[]): string => {
    for (const k of keys) {
      const val = normalizedEntries.get(normalizeHeaderKey(k));
      if (val) return val;
    }
    return '';
  };

  const amountRaw = getFirst([
    'amount',
    'value',
    'total',
    'المبلغ',
    'القيمة',
    'المبلغ الإجمالي',
    'egp',
  ]);
  const phoneRaw = getFirst([
    'phone',
    'phoneNumber',
    'mobile',
    'msisdn',
    'رقم الهاتف',
    'الموبايل',
    'الرقم',
    'to',
    'from',
  ]);
  const typeRaw = getFirst(['type', 'transactionType', 'kind', 'النوع', 'نوع العملية', 'نوع المعاملة']);
  const dateRaw = getFirst(['date', 'timestamp', 'txTimestamp', 'time', 'التاريخ', 'تاريخ العملية']);
  const descRaw = getFirst(['description', 'desc', 'notes', 'title', 'الوصف', 'التفاصيل', 'البيان']);
  const refRaw = getFirst(['reference', 'referenceCode', 'ref', 'id', 'المرجع', 'رقم العملية']);

  const rawJson = JSON.stringify(rowObj);
  const parsedAmount = amountRaw
    ? Number(normalizeDigits(amountRaw).replace(/[^\d.-]/g, ''))
    : extractAmount(rawJson);

  if (parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return {
      error: `الصف رقم ${index + 1}: تعذر قراءة مبلغ موجب صالح.`,
    };
  }

  const phoneNumber = extractEgyptianPhone(phoneRaw || rawJson) || phoneRaw.slice(0, 20);
  const { iso: txTimestamp, inferred } = extractTimestampIso(dateRaw || rawJson);
  const transactionType = mapTransactionTypeValue(typeRaw, `${descRaw} ${rawJson}`);
  const referenceCode = refRaw || extractReferenceCode(rawJson);
  const description = descRaw || `سجل مستورد (${sourceType.toUpperCase()})`;

  const warnings: string[] = [];
  if (!phoneNumber) warnings.push('لم يتم العثور على رقم هاتف صالح.');
  if (inferred && !dateRaw) warnings.push('تاريخ غير محدد — تم استخدام وقت الاستيراد.');

  return {
    candidate: {
      tempId: `file-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      originalSourceText: rawJson,
      transactionType,
      amount: Number(parsedAmount.toFixed(2)),
      phoneNumber,
      txTimestamp,
      description,
      referenceCode,
      sourceType,
      confidence: phoneNumber ? 'high' : 'medium',
      warnings,
      selected: true,
    },
  };
}

export function parseCsvString(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

export async function parseImportedFile(file: File): Promise<FileParseResult> {
  if (file.size === 0) {
    throw new Error('الملف فارغ.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد المسموح به (5 ميجابايت).');
  }

  const lowerName = file.name.toLowerCase();
  const errors: string[] = [];
  const candidates: ParsedTransactionCandidate[] = [];

  if (lowerName.endsWith('.json') || file.type === 'application/json') {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('ملف JSON غير صالح التركيب.');
    }

    const items = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null
        ? ((parsed as Record<string, unknown>).records ??
            (parsed as Record<string, unknown>).transactions ??
            (parsed as Record<string, unknown>).data)
        : null;

    if (!Array.isArray(items)) {
      throw new Error('يجب أن يحتوي ملف JSON على مصفوفة معاملات (Array) أو حقل records / transactions.');
    }

    const slice = items.slice(0, MAX_ROWS);
    if (items.length > MAX_ROWS) {
      errors.push(`تمت معالجة أول ${MAX_ROWS} صف فقط من أصل ${items.length}.`);
    }

    slice.forEach((item, idx) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`الصف رقم ${idx + 1}: تنسيق غير صالح.`);
        return;
      }
      const mapped = mapRowObjectToCandidate(item as Record<string, unknown>, 'json', idx);
      if (mapped.candidate) candidates.push(mapped.candidate);
      if (mapped.error) errors.push(mapped.error);
    });

    return {
      sourceType: 'json',
      fileName: file.name,
      candidates,
      errors,
      totalRawRows: items.length,
    };
  }

  if (lowerName.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    const matrix = parseCsvString(text);
    if (matrix.length < 2) {
      throw new Error('ملف CSV يجب أن يحتوي على صف عناوين وصف بيانات واحد على الأقل.');
    }

    const headers = matrix[0];
    const dataRows = matrix.slice(1, MAX_ROWS + 1);
    if (matrix.length - 1 > MAX_ROWS) {
      errors.push(`تمت معالجة أول ${MAX_ROWS} صف فقط.`);
    }

    dataRows.forEach((cells, idx) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        obj[h || `col_${colIdx}`] = cells[colIdx] ?? '';
      });
      const mapped = mapRowObjectToCandidate(obj, 'csv', idx);
      if (mapped.candidate) candidates.push(mapped.candidate);
      if (mapped.error) errors.push(mapped.error);
    });

    return {
      sourceType: 'csv',
      fileName: file.name,
      candidates,
      errors,
      totalRawRows: matrix.length - 1,
    };
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    let rows: unknown[][];
    try {
      rows = await readSheet(file);
    } catch {
      throw new Error(
        'تعذر قراءة ملف Excel. تأكد أن الملف بصيغة .xlsx صالحة أو صدّره كملف CSV.'
      );
    }

    if (rows.length < 2) {
      throw new Error('ملف Excel فارغ أو لا يحتوي على صفوف بيانات.');
    }

    const headers = rows[0].map((cell) => String(cell ?? '').trim());
    const dataRows = rows.slice(1, MAX_ROWS + 1);
    if (rows.length - 1 > MAX_ROWS) {
      errors.push(`تمت معالجة أول ${MAX_ROWS} صف فقط.`);
    }

    dataRows.forEach((cells, idx) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        obj[h || `col_${colIdx}`] = cells[colIdx] ?? '';
      });
      const mapped = mapRowObjectToCandidate(obj, 'excel', idx);
      if (mapped.candidate) candidates.push(mapped.candidate);
      if (mapped.error) errors.push(mapped.error);
    });

    return {
      sourceType: 'excel',
      fileName: file.name,
      candidates,
      errors,
      totalRawRows: rows.length - 1,
    };
  }

  throw new Error('صيغة الملف غير مدعومة. الصيغ المدعومة: CSV وJSON وExcel (.xlsx).');
}
