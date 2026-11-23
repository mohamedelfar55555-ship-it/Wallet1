import { ArrowRight, Bell, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  unreadNotifications: number;
  canGoBack: boolean;
  isHome: boolean;
  onBack: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

export function Header({
  title,
  unreadNotifications,
  canGoBack,
  isHome,
  onBack,
  onOpenSearch,
  onOpenNotifications,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#E60000] text-white">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Right side (RTL start): Brand emblem on Home OR Back + title on sub-screens */}
        <div className="flex items-center gap-2.5 min-w-0">
          {canGoBack && !isHome ? (
            <>
              <button
                type="button"
                onClick={onBack}
                aria-label="رجوع"
                className="flex h-10 w-10 -mr-1 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 shrink-0 cursor-pointer"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="text-base font-bold text-white truncate">{title}</span>
            </>
          ) : (
            <div className="flex items-center">
              <div
                aria-label="الرئيسية"
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#E60000]"
              >
                <img
                  src="/assets/aistudio/IMG_5815_f405a8c4.png"
                  alt="شعار التطبيق"
                  draggable={false}
                  style={{
                    width: '248px',
                    height: '538px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-49.96%, -51.34%)',
                  }}
                  className="pointer-events-none absolute max-w-none select-none brightness-[0.95] contrast-[1.06]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Left side (RTL end): Search + Notifications */}
        <div className="flex items-center gap-1 shrink-0">

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="بحث"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 cursor-pointer"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="الإشعارات"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 cursor-pointer"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 left-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-900 px-1 font-mono-tabular text-[10px] font-bold text-white">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
