import {
  ArrowUpDown,
  ChevronLeft,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { TouchEvent, useEffect, useRef, useState } from 'react';
import { TELECOM_DEMO_PROFILE } from '../data/telecomDemoData';
import { AppRoute } from '../types/navigation';
import { formatCurrency } from '../utils/formatters';
import { PromoBannerCarousel } from './PromoBannerCarousel';

interface HomeScreenProps {
  lineBalance: number;
  lastUpdatedTime: string;
  refreshSignal: number;
  isRefreshing: boolean;
  onRefreshTime: () => void;
  onNavigate: (route: AppRoute) => void;
  onOpenRecharge: () => void;
  onShowNotice: (message: string) => void;
}

const USAGE_SLIDES = [
  {
    id: 'internet',
    label: 'إنترنت',
    remainingValue: 15477,
    totalValue: 31964,
    totalText: 'متاحة من 31964 ميجا',
    renewal: '25 يوم علي التجديد',
  },
  {
    id: 'flex',
    label: 'فليكسات',
    remainingValue: 1420,
    totalValue: 2000,
    totalText: 'متاحة من 2000 فليكس',
    renewal: '25 يوم علي التجديد',
  },
  {
    id: 'minutes',
    label: 'دقائق لكل الشبكات',
    remainingValue: 850,
    totalValue: 1200,
    totalText: 'متاحة من 1200 دقيقة',
    renewal: '25 يوم علي التجديد',
  },
  {
    id: 'roaming',
    label: 'باقة التجوال',
    remainingValue: 1640,
    totalValue: 2048,
    totalText: 'متاحة من 2048 ميجا',
    renewal: '25 يوم علي التجديد',
  },
  {
    id: 'social',
    label: 'باقة السوشيال',
    remainingValue: 3100,
    totalValue: 5000,
    totalText: 'متاحة من 5000 ميجا',
    renewal: '25 يوم علي التجديد',
  },
];

export function HomeScreen({
  lineBalance,
  lastUpdatedTime,
  refreshSignal,
  isRefreshing,
  onRefreshTime,
  onNavigate,
  onOpenRecharge,
  onShowNotice,
}: HomeScreenProps) {
  const [usageIndex, setUsageIndex] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  const currentUsage = USAGE_SLIDES[usageIndex % USAGE_SLIDES.length];

  const [animatedRemaining, setAnimatedRemaining] = useState<number>(currentUsage.totalValue);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setAnimatedRemaining(currentUsage.remainingValue);
      return;
    }

    const startVal = currentUsage.totalValue;
    const endVal = currentUsage.remainingValue;
    const duration = 1150;
    let startTimestamp: number | null = null;
    let frameId = 0;

    setAnimatedRemaining(startVal);

    const step = (timestamp: number) => {
      if (startTimestamp === null) {
        startTimestamp = timestamp;
      }
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth cubic ease-out matching the live countdown in the screen recording
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal - (startVal - endVal) * eased);
      setAnimatedRemaining(nextVal);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [currentUsage.remainingValue, currentUsage.totalValue, refreshSignal, usageIndex]);

  const animatedPercent = Math.max(
    4,
    Math.min(100, Math.round((animatedRemaining / currentUsage.totalValue) * 100))
  );

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (window.scrollY <= 2 && e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || e.changedTouches.length === 0) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (deltaY > 55 && !isRefreshing) {
      onRefreshTime();
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="animate-view-enter space-y-3 pb-4"
    >
      {/* Pull-to-refresh / Open activity spinner on light page background */}
      {isRefreshing && (
        <div
          role="status"
          aria-label="جاري تحديث البيانات"
          className="flex items-center justify-center pt-3 pb-0.5"
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      )}

      {/* 1. Animated 5-Slide Hero Promotional Banner Carousel on light background */}
      <PromoBannerCarousel
        onSelectSlide={(_slideId, title) => {
          onShowNotice(title);
          onNavigate('offers');
        }}
      />

      {/* 2. RED MEMBER Strip matching IMG_5825 */}
      <div className="px-3.5">
        <button
          type="button"
          onClick={() => onShowNotice(`باقتك الحالية: ${TELECOM_DEMO_PROFILE.planName}`)}
          className="flex w-full items-center justify-end gap-2.5 rounded-xl bg-gradient-to-l from-[#9D0000] via-[#D80000] to-[#AE0000] px-4 py-3 text-white shadow-sm transition-opacity hover:opacity-95 cursor-pointer"
        >
          <span className="text-xs font-extrabold tracking-wider uppercase">RED MEMBER</span>
          <Smartphone className="h-4.5 w-4.5 text-white/95 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* 3. Main Animated Internet Usage Card (matching 00:00 -> 00:03 countdown) */}
      <section aria-label="استهلاك الإنترنت" className="px-3.5">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-4 w-4 text-slate-800" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900">{currentUsage.label}</span>
            </div>

            <div className="flex items-center gap-1.5" role="tablist" aria-label="تفاصيل الاستهلاك">
              {USAGE_SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={usageIndex === idx}
                  aria-label={slide.label}
                  onClick={() => setUsageIndex(idx)}
                  className={`h-1.5 w-1.5 rounded-full transition-colors cursor-pointer ${
                    usageIndex === idx ? 'bg-[#E60000]' : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span dir="ltr" className="font-mono-tabular text-2xl font-bold text-slate-900">
              {animatedRemaining}
            </span>
            <span className="text-xs font-medium text-slate-600">{currentUsage.totalText}</span>
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[#E60000]"
              style={{ width: `${animatedPercent}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{currentUsage.renewal}</span>
            <button
              type="button"
              onClick={() => onNavigate('internet')}
              className="min-h-[36px] rounded-lg border border-[#E60000] bg-white px-5 text-xs font-bold text-[#E60000] transition-colors hover:bg-rose-50 cursor-pointer"
            >
              إدارة الباقة
            </button>
          </div>
        </div>
      </section>

      {/* 4. Two-Column Action Area matching IMG_5825 (Recharge + Vodafone Cash only) */}
      <section aria-label="شحن الرصيد وفودافون كاش" className="px-3.5">
        <div className="grid grid-cols-2 gap-3">
          {/* Right Column (RTL first): شحن الرصيد + فودافون كاش */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenRecharge}
              className="flex w-full flex-col justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-right shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {/* Smartphone + upward arrow + stacked coins matching IMG_5832 */}
                <svg viewBox="0 0 28 28" className="h-6 w-6 text-[#2D2D2D] shrink-0" fill="none" aria-hidden="true">
                  <rect x="8.5" y="2.5" width="13" height="20.5" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M13 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M15 15.5V9.2m0 0-2.4 2.4m2.4-2.4 2.4 2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <ellipse cx="7.5" cy="18.2" rx="4.2" ry="1.6" fill="white" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3.3 18.2v2.4c0 .88 1.88 1.6 4.2 1.6s4.2-.72 4.2-1.6v-2.4" fill="white" />
                  <path d="M3.3 18.2v2.4c0 .88 1.88 1.6 4.2 1.6s4.2-.72 4.2-1.6v-2.4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3.3 20.6v2.2c0 .88 1.88 1.6 4.2 1.6s4.2-.72 4.2-1.6v-2.2" fill="white" />
                  <path d="M3.3 20.6v2.2c0 .88 1.88 1.6 4.2 1.6s4.2-.72 4.2-1.6v-2.2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <span className="text-[15px] font-extrabold text-[#2D2D2D]">شحن الرصيد</span>
              </div>

              <div className="mt-4 flex w-full items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span dir="ltr" className="font-mono-tabular text-[18px] font-extrabold text-[#2D2D2D]">
                    {formatCurrency(lineBalance)}
                  </span>
                  <span className="text-xs font-medium text-slate-600">جنيه</span>
                </div>
                <ChevronLeft className="h-4.5 w-4.5 stroke-[1.6] text-[#E60000]" aria-hidden="true" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-l from-[#8A0000] via-[#3A0000] to-[#000000] px-4 py-4 text-right text-white shadow-[0_3px_12px_rgba(40,0,0,0.28)] transition-transform active:scale-[0.99] cursor-pointer"
            >
              <div>
                <p className="text-[16px] font-extrabold leading-tight text-white">فودافون</p>
                <p className="text-[16px] font-extrabold leading-tight text-white">كاش</p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                {/* Smartphone with curved 100 banknote + winged كاش emblem matching IMG_5832 */}
                <svg viewBox="0 0 64 56" className="h-13 w-15" fill="none" aria-hidden="true">
                  {/* Smartphone frame */}
                  <rect x="20" y="3" width="22" height="33" rx="3.2" stroke="white" strokeWidth="1.7" />
                  <path d="M28 5.8h6" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M27.5 33h7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  {/* Flying 100 banknote */}
                  <path
                    d="M15 21.5C22 21.5 29 18 35.5 11.5L47 18.2C40.5 24.5 33 26.8 23.5 25.5L15 21.5Z"
                    fill="white"
                    stroke="#0A0000"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M27 21.2c2.5-.8 5-2.6 7-4.8"
                    stroke="#110000"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                  <circle cx="32" cy="19.5" r="2.2" fill="#110000" />
                  <text
                    x="37.5"
                    y="17.8"
                    fill="#110000"
                    fontSize="4.2"
                    fontWeight="800"
                    transform="rotate(28 37.5 17.8)"
                  >
                    100
                  </text>
                  {/* Stylized winged كاش calligraphy beneath */}
                  <path d="M12 42h9M11 45h8.5M10 48h8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                  <text
                    x="35"
                    y="50.5"
                    textAnchor="middle"
                    fill="white"
                    fontSize="13.5"
                    fontWeight="900"
                    fontFamily="Cairo, sans-serif"
                    fontStyle="italic"
                  >
                    كاش
                  </text>
                </svg>
              </div>
            </button>
          </div>

          {/* Left Column intentionally open as in IMG_5825 */}
          <div aria-hidden="true" />
        </div>
      </section>

      {/* 5. Real-time Last Updated & RED Benefits Peek */}
      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onRefreshTime}
          aria-label="تحديث البيانات الآن"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
        >
          <RefreshCw
            className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-[#E60000]' : ''}`}
            aria-hidden="true"
          />
          <span>آخر تحديث:</span>
          <span dir="ltr" className="font-mono-tabular">
            {lastUpdatedTime}
          </span>
        </button>
      </div>

      <section aria-label="مميزات RED" className="px-3.5 pt-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-extrabold text-slate-900">مميزات RED</h2>
          <button
            type="button"
            onClick={() => onNavigate('offers')}
            className="text-xs font-bold text-[#E60000] cursor-pointer"
          >
            عرض الكل
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('offers')}
            className="rounded-xl border border-slate-100 bg-white p-3 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            <p className="text-xs font-bold text-slate-900">عروض RED</p>
            <p className="mt-0.5 text-[11px] text-slate-500">خصومات حصرية</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('internet')}
            className="rounded-xl border border-slate-100 bg-white p-3 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            <p className="text-xs font-bold text-slate-900">باقات الإنترنت</p>
            <p className="mt-0.5 text-[11px] text-slate-500">متابعة الاستهلاك</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="rounded-xl border border-slate-100 bg-white p-3 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            <p className="text-xs font-bold text-slate-900">فودافون كاش</p>
            <p className="mt-0.5 text-[11px] text-slate-500">تحويل ودفع فوري</p>
          </button>
        </div>
      </section>
    </div>
  );
}
