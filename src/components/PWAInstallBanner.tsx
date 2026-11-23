import { Download, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAStatusBar() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIosInstallHint, setIsIosInstallHint] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    try {
      const ua = window.navigator.userAgent || '';
      const isIos = /iPad|iPhone|iPod/.test(ua);
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      if (isIos && !isStandalone) {
        setIsIosInstallHint(true);
      }
    } catch {
      // Ignore UA checks
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (isOnline && ((!installPrompt && !isIosInstallHint) || dismissed)) return null;

  return (
    <div className="space-y-1 px-3.5 pt-2">
      {!isOnline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>أنت غير متصل بالإنترنت — وضع القراءة والتخزين المحلي نشط</span>
        </div>
      )}

      {installPrompt && !dismissed && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-900">تثبيت التطبيق (PWA)</p>
            <p className="text-[11px] text-slate-600 truncate">
              لتفعيل استقبال المشاركات (Share Target) والعمل كتطبيق مستقل
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                if (choice.outcome === 'accepted') setInstallPrompt(null);
              }}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#E60000] px-2.5 text-[11px] font-bold text-white hover:bg-[#C80000] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تثبيت</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="min-h-[32px] rounded-lg px-2 text-[11px] font-semibold text-slate-500 hover:bg-rose-100 cursor-pointer"
            >
              لاحقاً
            </button>
          </div>
        </div>
      )}

      {!installPrompt && isIosInstallHint && !dismissed && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-900">تثبيت على iPhone</p>
            <p className="text-[11px] text-slate-600">
              اضغط زر المشاركة في Safari ثم اختر «إضافة إلى الصفحة الرئيسية»
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-[30px] shrink-0 rounded-lg bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-600 cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}
    </div>
  );
}
