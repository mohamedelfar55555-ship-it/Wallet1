import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardPaste,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { readClipboardOnUserClick } from '../services/androidDeviceBridge';
import { parseImportedFile } from '../services/fileImporter';
import { extractReceiptDataFromImage } from '../services/ocrEngine';
import {
  markCandidateDuplicates,
  parseTextBatchToCandidates,
} from '../services/transactionParser';
import type {
  ImportBatchSummary,
  ImportedSourceType,
  ImportedTransactionType,
  ImportedWalletRecord,
  ParsedTransactionCandidate,
} from '../types/wallet';
import { formatCurrency, formatDateTime } from '../utils/formatters';

interface ImportWalletDataScreenProps {
  records: ImportedWalletRecord[];
  batches: ImportBatchSummary[];
  incomingSharedText?: string | null;
  incomingSharedFiles?: File[];
  onConsumeIncomingShare?: () => void;
  onSaveBatch: (payload: {
    sourceType: ImportedSourceType;
    fileName: string;
    candidates: ParsedTransactionCandidate[];
  }) => Promise<{ importedCount: number; duplicateCount: number; errorCount: number }>;
  onUpdateRecord: (
    id: string,
    updates: {
      transactionType: ImportedTransactionType;
      amount: number;
      phoneNumber: string;
      description: string;
      referenceCode: string;
    }
  ) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onExportData: (format: 'csv' | 'json') => Promise<void>;
  onBack: () => void;
  onShowNotice: (text: string, variant?: 'success' | 'error') => void;
}

type ImportModeTab = 'clipboard' | 'ocr' | 'files' | 'records';

const SOURCE_LABELS: Record<ImportedSourceType, string> = {
  clipboard: 'حافظة النص',
  shared_text: 'مشاركة خارجية',
  screenshot_ocr: 'لقطة شاشة OCR',
  csv: 'ملف CSV',
  json: 'ملف JSON',
  excel: 'ملف Excel',
  manual: 'إدخال يدوي',
};

const TYPE_LABELS: Record<ImportedTransactionType, string> = {
  send: 'تحويل صادر',
  receive: 'استلام وارد',
  withdraw: 'سحب ATM',
  deposit: 'إيداع',
  other: 'أخرى',
};

const SAMPLE_CLIPBOARD_TEXT = `تم تحويل مبلغ 250.50 جنيه لرقم 01098074883 بتاريخ 20 نوفمبر 2026 - 02:35 م رقم العملية 025986446705
تم استلام 1500 جنيه من 01038391808 رقم العملية VFC-20261120-884120`;

export function ImportWalletDataScreen({
  records,
  batches,
  incomingSharedText,
  incomingSharedFiles,
  onConsumeIncomingShare,
  onSaveBatch,
  onUpdateRecord,
  onDeleteRecord,
  onExportData,
  onBack,
  onShowNotice,
}: ImportWalletDataScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportModeTab>('clipboard');

  // Clipboard & Shared text state
  const [rawPasteText, setRawPasteText] = useState('');
  const [textSourceType, setTextSourceType] = useState<ImportedSourceType>('clipboard');

  // OCR state
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');
  const [ocrEngineName, setOcrEngineName] = useState('');
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);

  // Preview candidates before committing import
  const [previewCandidates, setPreviewCandidates] = useState<ParsedTransactionCandidate[]>([]);
  const [previewSourceLabel, setPreviewSourceLabel] = useState<string>('manual');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  // Records Explorer Filters & Editing
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | ImportedSourceType>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ImportedTransactionType>('all');
  const [editingRecord, setEditingRecord] = useState<ImportedWalletRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<ImportedTransactionType>('send');
  const [editRef, setEditRef] = useState('');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // Handle incoming Share Target / Android Intent payload automatically when navigated
  useEffect(() => {
    if (incomingSharedText && incomingSharedText.trim()) {
      setActiveTab('clipboard');
      setTextSourceType('shared_text');
      setRawPasteText(incomingSharedText);
      const parsed = markCandidateDuplicates(
        parseTextBatchToCandidates(incomingSharedText, 'shared_text'),
        records
      );
      setPreviewCandidates(parsed);
      setPreviewSourceLabel('shared-text');
      onConsumeIncomingShare?.();
    } else if (incomingSharedFiles && incomingSharedFiles.length > 0) {
      const file = incomingSharedFiles[0];
      if (file.type.startsWith('image/')) {
        setActiveTab('ocr');
        void processOcrFile(file);
      } else {
        setActiveTab('files');
        void processDataFile(file);
      }
      onConsumeIncomingShare?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSharedText, incomingSharedFiles]);

  const handleExplicitPasteClick = async () => {
    const res = await readClipboardOnUserClick();
    if (res.error) {
      onShowNotice(res.error, 'error');
      return;
    }
    if (!res.text.trim()) {
      onShowNotice('الحافظة فارغة حالياً.', 'error');
      return;
    }
    setTextSourceType('clipboard');
    setRawPasteText(res.text);
    const parsed = markCandidateDuplicates(
      parseTextBatchToCandidates(res.text, 'clipboard'),
      records
    );
    setPreviewCandidates(parsed);
    setPreviewSourceLabel('clipboard-paste');
    onShowNotice(`تم تحليل ${parsed.length} سجل من الحافظة — راجعها قبل الحفظ.`, 'success');
  };

  const handleParseTextInput = () => {
    if (!rawPasteText.trim()) {
      onShowNotice('الصق أو اكتب نص المعاملة أولاً.', 'error');
      return;
    }
    const parsed = markCandidateDuplicates(
      parseTextBatchToCandidates(rawPasteText, textSourceType),
      records
    );
    setPreviewCandidates(parsed);
    setPreviewSourceLabel(textSourceType);
  };

  const processOcrFile = async (file: File) => {
    setOcrRunning(true);
    setOcrProgress(5);
    setOcrStatus('جاري تجهيز الصورة...');
    setFileErrors([]);

    const previewUrl = URL.createObjectURL(file);
    setOcrImagePreview(previewUrl);

    try {
      const result = await extractReceiptDataFromImage(file, (pct, label) => {
        setOcrProgress(pct);
        setOcrStatus(label);
      });
      setOcrRawText(result.rawText);
      setOcrEngineName(result.engine);
      const marked = markCandidateDuplicates(result.candidates, records);
      setPreviewCandidates(marked);
      setPreviewSourceLabel(file.name);
      onShowNotice('تم استخراج النص من الصورة — يرجى مراجعة الأرقام وتصحيحها قبل الحفظ.', 'success');
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'فشلت قراءة الصورة.', 'error');
    } finally {
      setOcrRunning(false);
    }
  };

  const processDataFile = async (file: File) => {
    setFileErrors([]);
    try {
      const parsed = await parseImportedFile(file);
      const marked = markCandidateDuplicates(parsed.candidates, records);
      setPreviewCandidates(marked);
      setPreviewSourceLabel(parsed.fileName);
      setFileErrors(parsed.errors);
      if (marked.length > 0) {
        onShowNotice(`تم فحص الملف (${marked.length} سجل مرشح للاستيراد).`, 'success');
      } else {
        onShowNotice('لم يتم العثور على صفوف صالحة للاستيراد في الملف.', 'error');
      }
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر قراءة الملف.', 'error');
    }
  };

  const handleOcrFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processOcrFile(file);
    e.target.value = '';
  };

  const handleDataFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processDataFile(file);
    e.target.value = '';
  };

  const updateCandidateField = (
    tempId: string,
    patch: Partial<ParsedTransactionCandidate>
  ) => {
    setPreviewCandidates((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c))
    );
  };

  const handleCommitSelected = async () => {
    const selected = previewCandidates.filter(
      (c) => c.selected && typeof c.amount === 'number' && c.amount > 0
    );
    if (selected.length === 0) {
      onShowNotice('حدد سجلاً واحداً على الأقل بمبلغ صحيح قبل الحفظ.', 'error');
      return;
    }

    setSavingBatch(true);
    try {
      const res = await onSaveBatch({
        sourceType: selected[0].sourceType,
        fileName: previewSourceLabel,
        candidates: selected,
      });
      setPreviewCandidates([]);
      setActiveTab('records');
      onShowNotice(
        `تم حفظ ${res.importedCount} سجل غير موثق (تكرارات متجاهلة: ${res.duplicateCount}).`,
        'success'
      );
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر حفظ السجلات.', 'error');
    } finally {
      setSavingBatch(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      if (sourceFilter !== 'all' && r.sourceType !== sourceFilter) return false;
      if (typeFilter !== 'all' && r.transactionType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.phoneNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.referenceCode.toLowerCase().includes(q) ||
        r.originalSourceText.toLowerCase().includes(q) ||
        String(r.amount).includes(q)
      );
    });
  }, [records, searchTerm, sourceFilter, typeFilter]);

  const startEditRecord = (rec: ImportedWalletRecord) => {
    setEditingRecord(rec);
    setEditAmount(String(rec.amount));
    setEditPhone(rec.phoneNumber);
    setEditDesc(rec.description);
    setEditType(rec.transactionType);
    setEditRef(rec.referenceCode);
  };

  const handleSaveEditRecord = async () => {
    if (!editingRecord) return;
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      onShowNotice('أدخل مبلغاً موجباً صحيحاً.', 'error');
      return;
    }
    try {
      await onUpdateRecord(editingRecord.id, {
        transactionType: editType,
        amount: amt,
        phoneNumber: editPhone.trim(),
        description: editDesc.trim(),
        referenceCode: editRef.trim(),
      });
      setEditingRecord(null);
      onShowNotice('تم تحديث البيانات التجريبية مع الإبقاء على النص الأصلي دون تغيير.', 'success');
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر تحديث السجل.', 'error');
    }
  };

  return (
    <div className="animate-view-enter min-h-full bg-[#F4F5F7] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="رجوع"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">استيراد بيانات المحفظة</h1>
              <p className="text-[11px] text-slate-500">استيراد السجلات والملفات ولقطات الشاشة</p>
            </div>
          </div>
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-900">
            غير موثق
          </span>
        </div>

        {/* 4 Import Mode Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { id: 'clipboard' as const, label: 'الحافظة' },
            { id: 'ocr' as const, label: 'صورة OCR' },
            { id: 'files' as const, label: 'ملفات' },
            { id: 'records' as const, label: `السجل (${records.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[34px] rounded-lg px-1 text-[11px] font-bold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-[#E60000] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Strict Unverified Demo Disclaimer */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
          <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            جميع البيانات المستوردة هنا <strong>بيانات تجريبية غير موثقة</strong> يقدمها المستخدم بنفسه، ولا تغيّر رصيد المحفظة الأساسي ولا تمثل اتصالاً ببيانات فودافون كاش الرسمية.
          </p>
        </div>

        {/* TAB 1: Clipboard & Share Target */}
        {activeTab === 'clipboard' && (
          <section className="rounded-2xl bg-white p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-5 w-5 text-[#E60000]" />
                <h2 className="text-sm font-extrabold text-slate-900">استيراد من الحافظة أو المشاركة</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTextSourceType('clipboard');
                  setRawPasteText(SAMPLE_CLIPBOARD_TEXT);
                  setPreviewCandidates(
                    markCandidateDuplicates(
                      parseTextBatchToCandidates(SAMPLE_CLIPBOARD_TEXT, 'clipboard'),
                      records
                    )
                  );
                  setPreviewSourceLabel('sample-text');
                }}
                className="text-[11px] font-bold text-[#007385] hover:underline cursor-pointer"
              >
                تجربة نص تجريبي
              </button>
            </div>

            <button
              type="button"
              onClick={handleExplicitPasteClick}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E60000] px-4 text-sm font-bold text-white shadow-xs hover:bg-[#C80000] cursor-pointer"
            >
              <ClipboardPaste className="h-4.5 w-4.5" />
              <span>لصق البيانات من الحافظة (Paste Data)</span>
            </button>

            <div>
              <label htmlFor="manual-paste-area" className="block text-xs font-bold text-slate-700 mb-1">
                أو الصق / عدّل النص يدوياً (يدعم العربية والإنجليزية):
              </label>
              <textarea
                id="manual-paste-area"
                rows={4}
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder="مثال: تم تحويل مبلغ 350 جنيه لرقم 01012345678 رقم العملية 0259123456"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleParseTextInput}
              className="min-h-[40px] w-full rounded-xl border border-slate-900 bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              تحليل النص ومعاينة السجلات
            </button>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-[#007385]" />
                <span>المشاركة من تطبيقات أخرى (ShareSheet / Web Share Target):</span>
              </p>
              <p>
                عند تثبيت التطبيق كـ PWA أو APK، يظهر ضمن قائمة «مشاركة» لاستقبال النصوص واللقطات وملفات CSV/JSON مباشرة بعد موافقة المستخدم دون أي وصول خلفي للنظام.
              </p>
            </div>
          </section>
        )}

        {/* TAB 2: Screenshot OCR */}
        {activeTab === 'ocr' && (
          <section className="rounded-2xl bg-white p-4 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#E60000]" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">استيراد من لقطة شاشة (OCR)</h2>
                <p className="text-[11px] text-slate-500">
                  استخراج النصوص العربية والإنجليزية من الإيصالات مع مراجعة وتصحيح يدوي قبل الحفظ
                </p>
              </div>
            </div>

            <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#E60000] hover:bg-rose-50/40">
              <Upload className="h-6 w-6 text-[#E60000]" />
              <span className="text-xs font-bold text-slate-800">
                اختر لقطة شاشة لإيصال أو رسالة (PNG / JPG)
              </span>
              <span className="text-[11px] text-slate-500">الحد الأقصى 8 ميجابايت</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleOcrFileChange}
                className="hidden"
              />
            </label>

            {ocrRunning && (
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{ocrStatus}</span>
                  <span className="font-mono-tabular">{ocrProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#E60000] transition-all"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

            {ocrImagePreview && (
              <div className="rounded-xl border border-slate-200 p-2 bg-slate-50">
                <img
                  src={ocrImagePreview}
                  alt="معاينة لقطة الشاشة"
                  className="mx-auto max-h-48 rounded-lg object-contain"
                />
              </div>
            )}

            {ocrRawText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    النص المستخرج ({ocrEngineName}) — يمكنك تصحيحه قبل التحليل:
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={ocrRawText}
                  onChange={(e) => setOcrRawText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = markCandidateDuplicates(
                      parseTextBatchToCandidates(ocrRawText, 'screenshot_ocr'),
                      records
                    );
                    setPreviewCandidates(parsed);
                    setPreviewSourceLabel('ocr-edited-text');
                  }}
                  className="min-h-[38px] w-full rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  إعادة تحليل النص بعد التصحيح
                </button>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: File Import (CSV, JSON, Excel) */}
        {activeTab === 'files' && (
          <section className="rounded-2xl bg-white p-4 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#E60000]" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">استيراد ملفات (CSV · JSON · Excel)</h2>
                <p className="text-[11px] text-slate-500">
                  فحص تلقائي للتنسيق واكتشاف التكرارات ومعاينة قبل الحفظ (حتى 500 صف)
                </p>
              </div>
            </div>

            <label className="flex min-h-[115px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#E60000] hover:bg-rose-50/40">
              <Upload className="h-6 w-6 text-[#E60000]" />
              <span className="text-xs font-bold text-slate-800">
                اختر ملف CSV أو JSON أو Excel (.xlsx)
              </span>
              <span className="text-[11px] text-slate-500">
                الأعمدة المدعومة: amount / المبلغ، phone / رقم الهاتف، type / النوع، date / التاريخ، description / الوصف
              </span>
              <input
                type="file"
                accept=".csv,.json,.xlsx,.xls,text/csv,application/json"
                onChange={handleDataFileChange}
                className="hidden"
              />
            </label>

            {fileErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
                <p className="font-bold">ملاحظات وأخطاء الصفوف ({fileErrors.length}):</p>
                <ul className="list-disc pr-4 space-y-0.5 max-h-28 overflow-y-auto text-[11px]">
                  {fileErrors.slice(0, 12).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* PREVIEW & CORRECTION PANEL (shared across Clipboard, Share, OCR, Files) */}
        {activeTab !== 'records' && previewCandidates.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  معاينة قبل الاستيراد ({previewCandidates.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  راجع وعدّل أي قيمة قبل إضافتها إلى سجلك التجريبي غير الموثق
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCandidates([])}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                مسح
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-0.5">
              {previewCandidates.map((cand) => (
                <div
                  key={cand.tempId}
                  className={`rounded-xl border p-3 space-y-2.5 ${
                    cand.isDuplicate
                      ? 'border-amber-200 bg-amber-50/50'
                      : cand.selected
                        ? 'border-slate-200 bg-slate-50/60'
                        : 'border-slate-100 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cand.selected}
                        onChange={(e) =>
                          updateCandidateField(cand.tempId, { selected: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#E60000]"
                      />
                      <span>تضمين في الاستيراد</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      {cand.isDuplicate && (
                        <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                          مكرر محتمل
                        </span>
                      )}
                      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {SOURCE_LABELS[cand.sourceType]}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500">النوع</span>
                      <select
                        value={cand.transactionType}
                        onChange={(e) =>
                          updateCandidateField(cand.tempId, {
                            transactionType: e.target.value as ImportedTransactionType,
                          })
                        }
                        className="mt-0.5 w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900"
                      >
                        <option value="send">تحويل صادر</option>
                        <option value="receive">استلام وارد</option>
                        <option value="withdraw">سحب ATM</option>
                        <option value="deposit">إيداع</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-500">المبلغ (ج.م)</span>
                      <input
                        type="number"
                        step="0.01"
                        dir="ltr"
                        value={cand.amount ?? ''}
                        onChange={(e) =>
                          updateCandidateField(cand.tempId, {
                            amount: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="mt-0.5 w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono-tabular text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500">رقم الهاتف</span>
                      <input
                        type="text"
                        dir="ltr"
                        value={cand.phoneNumber}
                        onChange={(e) =>
                          updateCandidateField(cand.tempId, { phoneNumber: e.target.value })
                        }
                        className="mt-0.5 w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono-tabular text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500">المرجع</span>
                      <input
                        type="text"
                        dir="ltr"
                        value={cand.referenceCode}
                        onChange={(e) =>
                          updateCandidateField(cand.tempId, { referenceCode: e.target.value })
                        }
                        className="mt-0.5 w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono-tabular text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500">الوصف التجريبي</span>
                    <input
                      type="text"
                      value={cand.description}
                      onChange={(e) =>
                        updateCandidateField(cand.tempId, { description: e.target.value })
                      }
                      className="mt-0.5 w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                    />
                  </div>

                  {cand.warnings.length > 0 && (
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{cand.warnings[0]}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={savingBatch}
              onClick={handleCommitSelected}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E60000] text-sm font-bold text-white hover:bg-[#C80000] disabled:opacity-60 cursor-pointer"
            >
              <Check className="h-4.5 w-4.5" />
              <span>
                {savingBatch
                  ? 'جاري الحفظ...'
                  : `تأكيد حفظ السجلات المحددة (${previewCandidates.filter((c) => c.selected).length})`}
              </span>
            </button>
          </section>
        )}

        {/* TAB 4: Imported Demo Records Explorer & Export */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            {/* Export Controls */}
            <section className="rounded-2xl bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    سجلات المحفظة المستوردة ({records.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    سجلات تعليمية غير موثقة — يمكنك تعديلها أو حذفها أو تصديرها
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onExportData('csv')}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#E60000]" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportData('json')}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#007385]" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* Search + Filters */}
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="ابحث بالرقم أو المبلغ أو المرجع أو النص الأصلي..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-xs text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | ImportedSourceType)}
                  className="min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="all">كل المصادر</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'all' | ImportedTransactionType)}
                  className="min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="all">كل الأنواع</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Records List */}
            {filteredRecords.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-xs">
                <Layers className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-900">لا توجد سجلات مستوردة مطابقة</p>
                <p className="mt-1 text-xs text-slate-500">
                  استخدم الحافظة أو لقطات الشاشة OCR أو ملفات CSV/JSON/Excel لاستيراد البيانات.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRecords.map((rec) => (
                  <article
                    key={rec.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            غير موثق
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {SOURCE_LABELS[rec.sourceType]}
                          </span>
                          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-[#E60000]">
                            {TYPE_LABELS[rec.transactionType]}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                          {rec.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {rec.phoneNumber ? `رقم: ${rec.phoneNumber} · ` : ''}
                          {rec.referenceCode ? `مرجع: ${rec.referenceCode} · ` : ''}
                          {formatDateTime(rec.txTimestamp).full}
                        </p>
                      </div>

                      <p dir="ltr" className="font-mono-tabular text-base font-black text-[#006B7D] shrink-0">
                        {formatCurrency(rec.amount)} EGP
                      </p>
                    </div>

                    {expandedSourceId === rec.id && (
                      <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-700 border border-slate-200">
                        <p className="font-bold text-slate-500 mb-1">
                          النص الأصلي المحفوظ (غير قابل للتعديل):
                        </p>
                        <p className="whitespace-pre-wrap break-words font-mono-tabular text-[11px]">
                          {rec.originalSourceText}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSourceId((prev) => (prev === rec.id ? null : rec.id))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{expandedSourceId === rec.id ? 'إخفاء المصدر الأصلي' : 'عرض المصدر الأصلي'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditRecord(rec)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Import Batch History */}
            {batches.length > 0 && (
              <section className="rounded-2xl bg-white p-4 shadow-xs space-y-2.5">
                <h3 className="text-xs font-extrabold text-slate-900">سجل عمليات الاستيراد (Batches)</h3>
                <ul className="divide-y divide-slate-100 text-xs">
                  {batches.slice(0, 10).map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{b.fileName}</p>
                        <p className="text-[11px] text-slate-500">
                          {SOURCE_LABELS[b.sourceType]} · {formatDateTime(b.createdAt).full}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-[11px] font-bold text-emerald-700 shrink-0">
                        +{b.importedCount} (مكرر {b.duplicateCount})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Edit Imported Demo Record Modal */}
      {editingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900">تعديل السجل التجريبي</h3>
            <p className="text-[11px] text-slate-500">
              سيبقى النص الأصلي المستورد محفوظاً دون تغيير لأغراض التوثيق.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="block text-xs font-bold text-slate-700">النوع</span>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as ImportedTransactionType)}
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold"
                >
                  <option value="send">تحويل صادر</option>
                  <option value="receive">استلام وارد</option>
                  <option value="withdraw">سحب ATM</option>
                  <option value="deposit">إيداع</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-700">المبلغ (ج.م)</span>
                <input
                  type="number"
                  step="0.01"
                  dir="ltr"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono-tabular text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700">رقم الهاتف</span>
              <input
                type="text"
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono-tabular text-sm"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700">المرجع</span>
              <input
                type="text"
                dir="ltr"
                value={editRef}
                onChange={(e) => setEditRef(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono-tabular text-sm"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700">الوصف</span>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEditRecord}
                className="min-h-[42px] rounded-xl bg-[#E60000] text-xs font-bold text-white hover:bg-[#C80000] cursor-pointer"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
