import { createWorker } from 'tesseract.js';
import type { ParsedTransactionCandidate } from '../types/wallet';
import { runNativeMlKitOcrIfAvailable } from './androidDeviceBridge';
import { parseTextBatchToCandidates } from './transactionParser';

export interface OcrExtractionResult {
  rawText: string;
  engine: string;
  candidates: ParsedTransactionCandidate[];
}

export async function extractReceiptDataFromImage(
  file: File,
  onProgress?: (percent: number, statusLabel: string) => void
): Promise<OcrExtractionResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (PNG / JPG / WebP).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم الصورة يتجاوز الحد المسموح (8 ميجابايت).');
  }

  onProgress?.(10, 'جاري تهيئة محرك قراءة النصوص...');

  // Prefer native Google ML Kit plugin when running inside Capacitor Android wrapper
  const nativeRes = await runNativeMlKitOcrIfAvailable(file);
  if (nativeRes && nativeRes.text.trim()) {
    onProgress?.(100, 'تم استخراج النص عبر Android ML Kit');
    const candidates = parseTextBatchToCandidates(nativeRes.text, 'screenshot_ocr');
    return {
      rawText: nativeRes.text,
      engine: nativeRes.engine || 'Android ML Kit Text Recognition',
      candidates,
    };
  }

  // Web / PWA OCR via Tesseract.js (Arabic + English)
  const worker = await createWorker(['ara', 'eng'], undefined, {
    logger: (m) => {
      if (typeof m.progress === 'number') {
        const pct = Math.min(96, Math.max(12, Math.round(m.progress * 100)));
        onProgress?.(pct, 'جاري استخراج النص العربي والإنجليزي من اللقطة...');
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    onProgress?.(100, 'اكتمل استخراج النص.');
    const cleaned = text.trim();
    const candidates = parseTextBatchToCandidates(cleaned, 'screenshot_ocr');
    return {
      rawText: cleaned,
      engine: 'Tesseract.js (ara+eng)',
      candidates,
    };
  } finally {
    await worker.terminate();
  }
}
