import { Clipboard } from '@capacitor/clipboard';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DeviceSimCapabilityReport, SimSubscriptionInfo } from '../types/wallet';

// Native Capacitor Android Plugin interfaces (implemented in android-capacitor/*.kt)
interface SimInfoNativePlugin {
  requestPermissionsAndGetSims(): Promise<{
    permissionStatus: 'granted' | 'denied';
    subscriptions: SimSubscriptionInfo[];
    note?: string;
  }>;
}

interface ShareBridgeNativePlugin {
  getPendingSharedPayload(): Promise<{
    hasPayload: boolean;
    title?: string;
    text?: string;
    mimeType?: string;
    fileBase64?: string;
    fileName?: string;
  }>;
  clearPendingSharedPayload(): Promise<void>;
}

interface MlKitOcrNativePlugin {
  recognizeText(options: { imageBase64: string }): Promise<{ text: string; engine: string }>;
}

const SimInfoPlugin = registerPlugin<SimInfoNativePlugin>('SimInfo');
const ShareBridgePlugin = registerPlugin<ShareBridgeNativePlugin>('ShareBridge');
const MlKitOcrPlugin = registerPlugin<MlKitOcrNativePlugin>('MlKitOcr');

export const SHARE_CACHE_NAME = 'demo-wallet-share-inbox-v1';
export const SHARE_META_CACHE_URL = '/__share-target/latest-meta.json';

export function isNativeAndroidRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function detectDeviceSimCapabilities(): Promise<DeviceSimCapabilityReport> {
  if (isNativeAndroidRuntime()) {
    try {
      const result = await SimInfoPlugin.requestPermissionsAndGetSims();
      const subs = Array.isArray(result.subscriptions) ? result.subscriptions : [];
      return {
        platform: 'android-capacitor',
        nativeSimApiAvailable: true,
        permissionStatus: result.permissionStatus,
        subscriptions: subs,
        reasonMessage:
          subs.length > 0
            ? 'تم قراءة بيانات الشرائح من واجهة Android SubscriptionManager الرسمية. ملاحظة: بعض شركات الاتصالات تخفي رقم الهاتف الفعلي عن الشريحة ولذلك قد يظهر فارغاً.'
            : result.note ||
              'تم رفض إذن قراءة الهاتف أو لم يتم العثور على شرائح فعّالة. يمكنك إدخال الرقم يدوياً.',
      };
    } catch {
      return {
        platform: 'android-capacitor',
        nativeSimApiAvailable: false,
        permissionStatus: 'denied',
        subscriptions: [],
        reasonMessage:
          'تعذر الوصول إلى الإضافة البرمجية SimInfo في مشروع Android. تأكد من مزامنة الإضافة عبر Capacitor.',
      };
    }
  }

  return {
    platform: 'web-pwa',
    nativeSimApiAvailable: false,
    permissionStatus: 'unsupported_browser',
    subscriptions: [],
    reasonMessage:
      'متصفحات الويب وPWA لا تسمح بالوصول إلى شرائح SIM أو رقم الهاتف لأسباب الخصوصية والأمان في نظام التشغيل. يعمل الكشف التلقائي للشرائح (Dual-SIM) فقط داخل تطبيق Android المثبت (Capacitor APK). يمكنك اختيار الشريحة وإدخال رقمك يدوياً أدناه.',
  };
}

/**
 * Reads clipboard ONLY when triggered by explicit user click on "Paste Data".
 * Never polls or reads clipboard silently in the background.
 */
export async function readClipboardOnUserClick(): Promise<{
  text: string;
  error?: string;
}> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Clipboard.read();
      return { text: value ?? '' };
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return { text };
    }
    return {
      text: '',
      error: 'المتصفح الحالي لا يدعم قراءة الحافظة مباشرة؛ يمكنك اللصق يدوياً في مربع النص.',
    };
  } catch {
    return {
      text: '',
      error:
        'رفض المتصفح إذن قراءة الحافظة التلقائي. اضغط داخل مربع النص أدناه واستخدم (لصق / Paste).',
    };
  }
}

export interface IncomingSharedPayload {
  source: 'pwa-share-target' | 'android-intent' | 'url-query';
  title: string;
  text: string;
  url: string;
  files: File[];
}

export async function checkIncomingSharedPayload(): Promise<IncomingSharedPayload | null> {
  // 1. Check Native Android Share Intent bridge if inside Capacitor Android
  if (isNativeAndroidRuntime()) {
    try {
      const nativeShare = await ShareBridgePlugin.getPendingSharedPayload();
      if (nativeShare.hasPayload) {
        const files: File[] = [];
        if (nativeShare.fileBase64 && nativeShare.fileName) {
          const binary = atob(nativeShare.fileBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          files.push(
            new File([bytes], nativeShare.fileName, {
              type: nativeShare.mimeType || 'application/octet-stream',
            })
          );
        }
        await ShareBridgePlugin.clearPendingSharedPayload();
        return {
          source: 'android-intent',
          title: nativeShare.title || '',
          text: nativeShare.text || '',
          url: '',
          files,
        };
      }
    } catch {
      // Native share plugin unavailable
    }
  }

  // 2. Check PWA Web Share Target Cache Storage (populated by sw.ts on POST /share-target)
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(SHARE_CACHE_NAME);
      const metaRes = await cache.match(SHARE_META_CACHE_URL);
      if (metaRes) {
        const meta = (await metaRes.json()) as {
          title?: string;
          text?: string;
          url?: string;
          files?: Array<{ name: string; type: string; cacheUrl: string }>;
        };
        const files: File[] = [];
        for (const fileMeta of meta.files ?? []) {
          const fileRes = await cache.match(fileMeta.cacheUrl);
          if (fileRes) {
            const blob = await fileRes.blob();
            files.push(new File([blob], fileMeta.name, { type: fileMeta.type }));
            await cache.delete(fileMeta.cacheUrl);
          }
        }
        await cache.delete(SHARE_META_CACHE_URL);

        return {
          source: 'pwa-share-target',
          title: meta.title || '',
          text: meta.text || '',
          url: meta.url || '',
          files,
        };
      }
    } catch {
      // Ignore cache read failures
    }
  }

  // 3. Check GET query fallback (?shared_text=... or ?text=...)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const qText = params.get('text') || params.get('shared_text') || '';
    const qTitle = params.get('title') || '';
    const qUrl = params.get('url') || '';
    if (qText || qTitle || qUrl) {
      return {
        source: 'url-query',
        title: qTitle,
        text: qText,
        url: qUrl,
        files: [],
      };
    }
  }

  return null;
}

export async function runNativeMlKitOcrIfAvailable(
  file: File
): Promise<{ text: string; engine: string } | null> {
  if (!isNativeAndroidRuntime()) return null;
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return await MlKitOcrPlugin.recognizeText({ imageBase64: base64 });
  } catch {
    return null;
  }
}
