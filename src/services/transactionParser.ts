import type {
  ImportedSourceType,
  ImportedTransactionType,
  ImportedWalletRecord,
  ParsedTransactionCandidate,
} from '../types/wallet';

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
  '٬': ',',
};

const ARABIC_MONTHS: Record<string, number> = {
  يناير: 0,
  فبراير: 1,
  مارس: 2,
  أبريل: 3,
  ابريل: 3,
  مايو: 4,
  يونيو: 5,
  يوليو: 6,
  أغسطس: 7,
  اغسطس: 7,
  سبتمبر: 8,
  أكتوبر: 9,
  اكتوبر: 9,
  نوفمبر: 10,
  ديسمبر: 11,
};

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹٫٬]/g, (ch) => ARABIC_DIGIT_MAP[ch] ?? ch);
}

export function extractEgyptianPhone(text: string): string {
  const norm = normalizeDigits(text).replace(/[\s\-()]/g, '');
  const intlMatch = norm.match(/(?:\+?20|0020)(1[0125]\d{8})/);
  if (intlMatch) {
    return `0${intlMatch[1]}`;
  }
  const localMatch = norm.match(/01[0125]\d{8}/);
  if (localMatch) {
    return localMatch[0];
  }
  return '';
}

export function detectTransactionType(text: string): ImportedTransactionType {
  const lower = normalizeDigits(text).toLowerCase();

  if (
    /استلام|تم\s*استلام|وصل(?:ك|ت)?|تم\s*تحويل\s*مبلغ.*لك|تحويل\s*وارد|received|credited|cash\s*in|incoming/i.test(
      lower
    )
  ) {
    return 'receive';
  }
  if (/سحب|atm|ماكينة|withdraw|cash\s*out/i.test(lower)) {
    return 'withdraw';
  }
  if (/إيداع|ايداع|deposit|بنكي|top\s*up/i.test(lower)) {
    return 'deposit';
  }
  if (
    /تم\s*تحويل|تحويل|أرسلت|ارسلت|دفع|مدفوعات|شحن|خصم|transferred|sent|paid|payment|debit/i.test(
      lower
    )
  ) {
    return 'send';
  }
  return 'other';
}

export function extractAmount(text: string): number | null {
  const norm = normalizeDigits(text);

  // Pattern 1: Currency attached before or after number (Arabic or English)
  const currencyRegexes = [
    /(?:مبلغ|المبلغ(?:\s*الإجمالي|\s*الكلي)?|بقيمة|بمبلغ|قدره)\s*[:：]?\s*([0-9]{1,7}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /([0-9]{1,7}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:جنيه(?:اً|ا)?|ج\.?م|جم|egp|le)\b/i,
    /(?:egp|le|ج\.?م|جنيه)\s*[:：]?\s*([0-9]{1,7}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  ];

  for (const regex of currencyRegexes) {
    const match = norm.match(regex);
    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0 && value <= 10000000) {
        return Number(value.toFixed(2));
      }
    }
  }

  // Fallback: standalone decimal or integer that is NOT an 11-digit phone or year 202x
  const strippedPhones = norm.replace(/(?:\+?20)?0?1[0125]\d{8}/g, ' ');
  const fallbackMatches = strippedPhones.match(/\b([0-9]{1,6}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\b/g);
  if (fallbackMatches) {
    for (const rawNum of fallbackMatches) {
      const val = Number(rawNum.replace(/,/g, ''));
      if (Number.isFinite(val) && val > 0 && val < 500000 && val !== 2025 && val !== 2026) {
        return Number(val.toFixed(2));
      }
    }
  }

  return null;
}

export function extractReferenceCode(text: string): string {
  const norm = normalizeDigits(text);
  const vfcMatch = norm.match(/\b(VFC-\d{6,8}-\d{4,8})\b/i);
  if (vfcMatch) return vfcMatch[1].toUpperCase();

  const refMatch = norm.match(
    /(?:رقم\s*العملية|المرجع|مرجع|ref(?:erence)?|trx|tx\s*id)\s*[:：#-]?\s*([A-Z0-9-]{6,24})/i
  );
  if (refMatch) return refMatch[1];

  const receiptDigits = norm.match(/\b(025\d{8,12})\b/);
  if (receiptDigits) return receiptDigits[1];

  return '';
}

export function extractTimestampIso(text: string): { iso: string; inferred: boolean } {
  const norm = normalizeDigits(text);

  // ISO format
  const isoMatch = norm.match(/\b(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?)\b/);
  if (isoMatch) {
    const dt = new Date(isoMatch[1]);
    if (!Number.isNaN(dt.getTime())) {
      return { iso: dt.toISOString(), inferred: false };
    }
  }

  // Arabic month date: e.g. 20 نوفمبر 2026 - 02:35 م
  const arMatch = norm.match(
    /(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+(\d{4})(?:\s*[-–·]?\s*(\d{1,2}):(\d{2})\s*(ص|م|AM|PM)?)?/i
  );
  if (arMatch) {
    const day = Number(arMatch[1]);
    const month = ARABIC_MONTHS[arMatch[2]];
    const year = Number(arMatch[3]);
    let hour = arMatch[4] ? Number(arMatch[4]) : 12;
    const min = arMatch[5] ? Number(arMatch[5]) : 0;
    const meridiem = arMatch[6];
    if (meridiem === 'م' || meridiem?.toUpperCase() === 'PM') {
      if (hour < 12) hour += 12;
    } else if ((meridiem === 'ص' || meridiem?.toUpperCase() === 'AM') && hour === 12) {
      hour = 0;
    }
    const dt = new Date(year, month, day, hour, min, 0);
    if (!Number.isNaN(dt.getTime())) {
      return { iso: dt.toISOString(), inferred: false };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = norm.match(
    /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?\b/
  );
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    let year = Number(dmyMatch[3]);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] ? Number(dmyMatch[4]) : 12;
    const min = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
    const dt = new Date(year, month, day, hour, min, 0);
    if (!Number.isNaN(dt.getTime()) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { iso: dt.toISOString(), inferred: false };
    }
  }

  return { iso: new Date().toISOString(), inferred: true };
}

export function buildCandidateFingerprint(candidate: {
  amount: number | null;
  phoneNumber: string;
  txTimestamp: string;
  referenceCode: string;
  originalSourceText: string;
}): string {
  const amt = (candidate.amount ?? 0).toFixed(2);
  const phone = candidate.phoneNumber.replace(/\D/g, '');
  const ts = candidate.txTimestamp.slice(0, 16);
  const ref = candidate.referenceCode.trim().toUpperCase();
  const raw = ref ? '' : candidate.originalSourceText.trim().slice(0, 120);
  return `${amt}|${phone}|${ts}|${ref}|${raw}`;
}

export function markCandidateDuplicates(
  candidates: ParsedTransactionCandidate[],
  existingRecords: ImportedWalletRecord[]
): ParsedTransactionCandidate[] {
  const existingKeys = new Set(
    existingRecords.map((r) =>
      buildCandidateFingerprint({
        amount: r.amount,
        phoneNumber: r.phoneNumber,
        txTimestamp: r.txTimestamp,
        referenceCode: r.referenceCode,
        originalSourceText: r.originalSourceText,
      })
    )
  );

  const seenInBatch = new Set<string>();
  return candidates.map((c) => {
    const key = buildCandidateFingerprint(c);
    const isDuplicate = existingKeys.has(key) || seenInBatch.has(key);
    seenInBatch.add(key);
    return {
      ...c,
      isDuplicate,
      selected: isDuplicate ? false : c.selected,
    };
  });
}

export function parseSingleTextBlock(
  blockText: string,
  sourceType: ImportedSourceType,
  index = 0
): ParsedTransactionCandidate | null {
  const trimmed = blockText.trim();
  if (!trimmed) return null;

  const amount = extractAmount(trimmed);
  const phoneNumber = extractEgyptianPhone(trimmed);
  const transactionType = detectTransactionType(trimmed);
  const referenceCode = extractReferenceCode(trimmed);
  const { iso: txTimestamp, inferred } = extractTimestampIso(trimmed);

  const warnings: string[] = [];
  if (amount === null) warnings.push('لم يتم التعرف على المبلغ تلقائياً — يرجى إدخاله يدوياً.');
  if (!phoneNumber) warnings.push('لم يُعثر على رقم موبايل مصري واضح.');
  if (inferred) warnings.push('تم استخدام وقت الاستيراد الحالي لعدم وضوح التاريخ.');
  if (sourceType === 'screenshot_ocr') {
    warnings.push('نص مستخرج عبر OCR وقد يحتوي على أخطاء؛ يرجى المراجعة قبل الحفظ.');
  }

  let confidence: ParsedTransactionCandidate['confidence'] = 'high';
  if (amount === null) {
    confidence = 'low';
  } else if (!phoneNumber || transactionType === 'other' || sourceType === 'screenshot_ocr') {
    confidence = 'medium';
  }

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || trimmed;
  const description =
    firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;

  return {
    tempId: `cand-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    originalSourceText: trimmed,
    transactionType,
    amount,
    phoneNumber,
    txTimestamp,
    description,
    referenceCode,
    sourceType,
    confidence,
    warnings,
    selected: amount !== null && amount > 0,
  };
}

/**
 * Splits multi-message text pastes or single receipts intelligently into candidate records.
 */
export function parseTextBatchToCandidates(
  rawInput: string,
  sourceType: ImportedSourceType
): ParsedTransactionCandidate[] {
  const cleaned = rawInput.trim();
  if (!cleaned) return [];

  // For screenshot OCR, keep the entire receipt together unless clearly multiple blank-line-separated blocks with amounts
  if (sourceType === 'screenshot_ocr') {
    const single = parseSingleTextBlock(cleaned, sourceType, 0);
    return single ? [single] : [];
  }

  const blankSplit = cleaned
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blankSplit.length > 1) {
    return blankSplit
      .map((block, idx) => parseSingleTextBlock(block, sourceType, idx))
      .filter((c): c is ParsedTransactionCandidate => c !== null);
  }

  // Check if each line looks like its own transaction line
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const linesWithAmounts = lines.filter((line) => extractAmount(line) !== null);
    if (linesWithAmounts.length >= 2) {
      return lines
        .map((line, idx) => parseSingleTextBlock(line, sourceType, idx))
        .filter((c): c is ParsedTransactionCandidate => c !== null);
    }
  }

  const single = parseSingleTextBlock(cleaned, sourceType, 0);
  return single ? [single] : [];
}
