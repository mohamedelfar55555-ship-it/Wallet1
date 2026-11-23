import { ArrowLeftRight, Flame, LayoutGrid, User, Wallet } from 'lucide-react';
import { AppRoute, MainTab } from '../types/navigation';

interface BottomNavProps {
  activeTab: MainTab;
  currentRoute: AppRoute;
  onSelectTab: (tab: MainTab) => void;
  onOpenProfile: () => void;
  onOpenWalletSend: () => void;
  onOpenWalletHistory: () => void;
}

function DevicesHomeIcon({ active }: { active: boolean }) {
  const color = active ? '#E60000' : '#334155';
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-7" fill="none" aria-hidden="true">
      {/* Background monitor */}
      <rect x="6" y="2.5" width="20" height="13.5" rx="1.8" stroke={color} strokeWidth="1.7" />
      <path d="M13.5 16v3M18.5 16v3M11.5 19h9" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      {/* Left tablet/phone */}
      <rect x="4" y="6.5" width="8.5" height="14" rx="1.5" fill="white" stroke={color} strokeWidth="1.7" />
      <circle cx="8.25" cy="18.3" r="0.7" fill={color} />
      {/* Right phone */}
      <rect x="21.5" y="9" width="6.5" height="11.5" rx="1.3" fill="white" stroke={color} strokeWidth="1.7" />
      <circle cx="24.75" cy="18.6" r="0.6" fill={color} />
    </svg>
  );
}

function ShopCartIcon({ active }: { active: boolean }) {
  const strokeColor = active ? '#E60000' : '#475569';
  return (
    <svg viewBox="0 0 26 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h3.2l2.4 10.5a1.5 1.5 0 0 0 1.46 1.15h9.6a1.5 1.5 0 0 0 1.45-1.13L22.5 7H6.8"
        stroke={strokeColor}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="19.5" r="1.7" stroke="#E60000" strokeWidth="1.6" />
      <circle cx="18.5" cy="19.5" r="1.7" stroke="#E60000" strokeWidth="1.6" />
    </svg>
  );
}

function MoreLinesIcon({ active }: { active: boolean }) {
  const color = active ? '#E60000' : '#334155';
  return (
    <svg viewBox="0 0 24 24" className="h-5.5 w-6" fill="none" aria-hidden="true">
      <path
        d="M4 6.5h16M4 12h16M4 17.5h16"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav({
  activeTab,
  currentRoute,
  onSelectTab,
  onOpenProfile,
  onOpenWalletSend,
  onOpenWalletHistory,
}: BottomNavProps) {
  const isWalletMode =
    currentRoute === 'wallet' ||
    currentRoute === 'wallet-history' ||
    currentRoute === 'wallet-tx-detail';

  if (isWalletMode) {
    return (
      <nav
        aria-label="شريط تنقل المحفظة"
        className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md"
      >
        <div className="grid h-[64px] grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => onSelectTab('wallet')}
            className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
              currentRoute === 'wallet' ? 'text-[#C80000]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Wallet className="h-5 w-5" aria-hidden="true" />
            <span>المحفظة</span>
          </button>

          <button
            type="button"
            onClick={onOpenWalletSend}
            className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-[#C80000] cursor-pointer"
          >
            <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
            <span>تحويل أموال</span>
          </button>

          <button
            type="button"
            onClick={onOpenWalletHistory}
            className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              currentRoute === 'wallet-history' || currentRoute === 'wallet-tx-detail'
                ? 'text-[#C80000]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            <span>الخدمات</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="شريط التنقل الرئيسي"
      className="sticky bottom-0 z-40 h-[78px] select-none pointer-events-none"
    >
      {/* Curved white bar with center U-notch cradle */}
      <svg
        viewBox="0 0 440 78"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_-4px_14px_rgba(15,23,42,0.06)]"
      >
        <path
          d="M 0 28 Q 0 10 18 10 L 158 10 C 179 10, 181 69, 220 69 C 259 69, 261 10, 282 10 L 422 10 Q 440 10 440 28 L 440 78 L 0 78 Z"
          fill="#FFFFFF"
        />
      </svg>

      {/* Raised center profile button inside the U-cradle */}
      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="الملف الشخصي"
        className="pointer-events-auto absolute left-1/2 top-[3px] z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_3px_14px_rgba(15,23,42,0.09)] transition-transform hover:scale-105 hover:text-[#E60000] cursor-pointer"
      >
        <User className="h-6 w-6 stroke-[1.7]" aria-hidden="true" />
      </button>

      {/* 5-slot navigation items aligned inside the curved bar */}
      <div className="pointer-events-auto relative z-10 grid h-full grid-cols-5 items-end pb-2 pt-3">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-extrabold text-slate-900 transition-colors cursor-pointer"
        >
          <DevicesHomeIcon active={activeTab === 'home'} />
          <span>الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('offers')}
          aria-current={activeTab === 'offers' ? 'page' : undefined}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
            activeTab === 'offers' ? 'text-[#E60000]' : 'text-slate-900 hover:text-[#E60000]'
          }`}
        >
          <Flame
            className={`h-5.5 w-5.5 stroke-[1.7] ${
              activeTab === 'offers' ? 'text-[#E60000]' : 'text-slate-800'
            }`}
            aria-hidden="true"
          />
          <span>عروض</span>
        </button>

        {/* Center spacer for floating Profile circle */}
        <div aria-hidden="true" />

        <button
          type="button"
          onClick={() => onSelectTab('internet')}
          aria-current={activeTab === 'internet' ? 'page' : undefined}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
            activeTab === 'internet' ? 'text-[#E60000]' : 'text-slate-900 hover:text-[#E60000]'
          }`}
        >
          <ShopCartIcon active={activeTab === 'internet'} />
          <span>تسوّق</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('more')}
          aria-current={activeTab === 'more' ? 'page' : undefined}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
            activeTab === 'more' ? 'text-[#E60000]' : 'text-slate-900 hover:text-[#E60000]'
          }`}
        >
          <MoreLinesIcon active={activeTab === 'more'} />
          <span>المزيد</span>
        </button>
      </div>
    </nav>
  );
}
