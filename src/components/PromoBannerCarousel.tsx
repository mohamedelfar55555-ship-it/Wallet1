import { TouchEvent, useEffect, useRef, useState } from 'react';

interface PromoBannerCarouselProps {
  onSelectSlide?: (slideId: string, title: string) => void;
}

const AUTO_SLIDE_MS = 4500;

function VodafoneRedBadge() {
  return (
    <div className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="#E60000" stroke="white" strokeWidth="1.5" />
        <path
          d="M12.6 5.8c-2.7.2-4.8 2.4-4.8 5.2 0 3.2 2.4 5.7 5.4 5.7 2.4 0 4.2-1.7 4.2-3.9 0-2-1.5-3.4-3.4-3.4-.9 0-1.6.3-2.1.8.2-1.9 1.2-3.3 2.7-4-.6-.3-1.3-.4-2-.4Z"
          fill="white"
        />
      </svg>
      <span className="text-[10px] font-black tracking-wider text-white">RED</span>
    </div>
  );
}

export function PromoBannerCarousel({ onSelectSlide }: PromoBannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const totalSlides = 5;

  useEffect(() => {
    if (isPaused) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, AUTO_SLIDE_MS);

    return () => window.clearInterval(timer);
  }, [isPaused]);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setIsPaused(true);
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current !== null && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      if (Math.abs(deltaX) > 36) {
        // In RTL: swiping right advances to next slide (enters from left), swiping left goes back
        if (deltaX > 0) {
          setActiveIndex((prev) => (prev + 1) % totalSlides);
        } else {
          setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
        }
      }
    }
    touchStartXRef.current = null;
    setIsPaused(false);
  };

  return (
    <div className="px-3.5 pt-3">
      <div
        className="relative overflow-hidden rounded-xl shadow-[0_4px_14px_rgba(15,23,42,0.12)]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* RTL sliding track: item i sits at -i * 100%, brought to view via +i * 100% */}
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          {/* SLIDE 1: CIB Plus 20% + 0% / 24 شهر */}
          <button
            type="button"
            onClick={() => onSelectSlide?.('cib-plus', 'خصومات إضافية حتى 20% ببطاقات CIB')}
            className="relative flex h-[142px] w-full shrink-0 items-stretch justify-between overflow-hidden bg-gradient-to-l from-[#7A0000] via-[#AE0000] to-[#4A0000] px-3.5 py-2.5 text-right text-white cursor-pointer"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-8 -top-8 h-36 w-36 rounded-full bg-red-500/25 blur-2xl"
            />
            {/* Right text block */}
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between pl-2">
              <div className="flex items-start justify-between gap-2">
                <div className="relative inline-block -rotate-1 rounded bg-[#F5EFE2] px-2.5 py-1 text-center shadow-xs">
                  <span
                    aria-hidden="true"
                    className="absolute -left-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E60000] text-[8px] font-black text-white shadow-xs"
                  >
                    ★
                  </span>
                  <p className="text-[11px] font-extrabold leading-tight text-slate-900">
                    خصومات إضافية
                  </p>
                  <p className="text-[14px] font-black leading-tight text-slate-950">
                    حتى 20%
                  </p>
                </div>
              </div>

              <div className="my-0.5 text-center">
                <p className="text-[10.5px] font-bold leading-tight text-amber-100">
                  لما تقسط
                </p>
                <p className="text-[11px] font-extrabold leading-tight text-white">
                  ببطاقات ائتمان CIB
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="grid flex-1 grid-cols-4 divide-x divide-x-reverse divide-white/40 text-center">
                  <div className="px-0.5">
                    <p dir="ltr" className="font-mono-tabular text-[11px] font-extrabold leading-none">
                      0%
                    </p>
                    <p className="mt-0.5 text-[7px] leading-tight text-white/90">مصاريف إدارية</p>
                  </div>
                  <div className="px-0.5">
                    <p dir="ltr" className="font-mono-tabular text-[11px] font-extrabold leading-none">
                      0%
                    </p>
                    <p className="mt-0.5 text-[7px] leading-tight text-white/90">مقدم</p>
                  </div>
                  <div className="px-0.5">
                    <p dir="ltr" className="font-mono-tabular text-[11px] font-extrabold leading-none">
                      0%
                    </p>
                    <p className="mt-0.5 text-[7px] leading-tight text-white/90">فوائد</p>
                  </div>
                  <div className="px-0.5">
                    <p dir="ltr" className="font-mono-tabular text-[11px] font-extrabold leading-none">
                      24
                    </p>
                    <p className="mt-0.5 text-[7px] leading-tight text-white/90">شهر</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Left visual: Black Friday tag + TV + Phone + CIB | Plus + O | RED */}
            <div className="relative z-10 flex w-[124px] shrink-0 flex-col items-center justify-between">
              <div className="flex w-full items-start justify-end">
                <span className="-rotate-3 rounded bg-slate-950/90 px-1.5 py-0.5 text-[7.5px] font-black leading-tight text-white border border-white/20">
                  هتعوز إيه تاني؟
                </span>
              </div>

              <svg viewBox="0 0 116 66" className="h-[68px] w-full" fill="none" aria-hidden="true">
                {/* Mini LED TV */}
                <rect
                  x="16"
                  y="6"
                  width="70"
                  height="42"
                  rx="2.5"
                  fill="#0F172A"
                  stroke="#E2E8F0"
                  strokeWidth="1.4"
                />
                <rect x="19" y="9" width="64" height="36" rx="1.5" fill="url(#tvGrad)" />
                <text
                  x="58"
                  y="40"
                  textAnchor="middle"
                  fill="white"
                  fontSize="7"
                  fontWeight="800"
                >
                  Mini LED
                </text>
                {/* Coffee maker / appliance */}
                <rect x="86" y="12" width="20" height="44" rx="4" fill="#CBD5E1" stroke="#475569" strokeWidth="1" />
                <rect x="90" y="18" width="12" height="14" rx="2" fill="#334155" />
                {/* Smartphone */}
                <rect
                  x="8"
                  y="22"
                  width="20"
                  height="35"
                  rx="3.5"
                  fill="#F97316"
                  stroke="white"
                  strokeWidth="1.4"
                />
                <rect x="10.5" y="25" width="15" height="28" rx="2" fill="#1E293B" />
                {/* Speaker */}
                <rect x="0" y="26" width="10" height="30" rx="3" fill="#0F172A" stroke="#64748B" strokeWidth="1" />
                <defs>
                  <linearGradient id="tvGrad" x1="19" y1="9" x2="83" y2="45" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F43F5E" />
                    <stop offset="0.5" stopColor="#F97316" />
                    <stop offset="1" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="flex w-full items-center justify-between text-[10px] font-black">
                <span className="text-white/95">CIB | Plus</span>
                <VodafoneRedBadge />
              </div>
            </div>
          </button>

          {/* SLIDE 2: لف عجلة الحظ من الخميس للسبت - 25,000 جنيه */}
          <button
            type="button"
            onClick={() => onSelectSlide?.('spin-win', 'لف عجلة الحظ واكسب كوبونات خصم حتى 25,000 جنيه')}
            className="relative flex h-[142px] w-full shrink-0 items-stretch justify-between overflow-hidden bg-gradient-to-l from-[#6A0000] via-[#9E0000] to-[#300000] px-3.5 py-2.5 text-right text-white cursor-pointer"
          >
            {/* Confetti / sparkles */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
              <span className="absolute right-8 top-3 h-1.5 w-1.5 rounded-full bg-amber-300" />
              <span className="absolute right-24 top-10 h-1 w-1 rounded-full bg-white" />
              <span className="absolute left-28 top-4 h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="absolute left-10 bottom-8 h-1 w-1 rounded-full bg-amber-200" />
            </div>

            {/* Right copy */}
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between pl-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-black leading-tight text-white">لف عجلة الحظ</p>
                  <p className="text-[13px] font-black leading-tight text-[#FFD166]">
                    من الخميس للسبت
                  </p>
                </div>
                <VodafoneRedBadge />
              </div>

              <div>
                <p className="text-[9.5px] font-semibold text-white/90">
                  واكسب كوبونات خصم إضافية تصل إلى
                </p>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span dir="ltr" className="font-mono-tabular text-[22px] font-black leading-none text-white">
                    25,000
                  </span>
                  <span className="text-[12px] font-extrabold text-[#FFD166]">جنيه</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[8.5px] text-white/85">
                <span>استخدمها على Vodafone eShop</span>
                <span className="text-white/65">تطبق الشروط</span>
              </div>
            </div>

            {/* Left Prize Wheel + Brands pill */}
            <div className="relative z-10 flex w-[114px] shrink-0 flex-col items-center justify-between">
              <svg viewBox="0 0 100 84" className="h-[88px] w-full" fill="none" aria-hidden="true">
                {/* Pointer */}
                <path d="M50 2l-4.5 9h9L50 2Z" fill="#FFD166" />
                {/* Wheel outer ring */}
                <circle cx="50" cy="46" r="34" fill="#1E0000" stroke="#FFD166" strokeWidth="2.5" />
                {/* Wheel slices */}
                <path d="M50 46L50 14A32 32 0 0 1 82 46Z" fill="#E60000" />
                <path d="M50 46L82 46A32 32 0 0 1 50 78Z" fill="#270303" />
                <path d="M50 46L50 78A32 32 0 0 1 18 46Z" fill="#B91C1C" />
                <path d="M50 46L18 46A32 32 0 0 1 50 14Z" fill="#450A0A" />
                {/* Wedge labels */}
                <text x="64" y="34" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="800">
                  25,000
                </text>
                <text x="64" y="61" textAnchor="middle" fill="#FFD166" fontSize="6.5" fontWeight="800">
                  2,000
                </text>
                <text x="35" y="61" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="800">
                  500
                </text>
                <text x="35" y="34" textAnchor="middle" fill="#FFD166" fontSize="6.5" fontWeight="800">
                  400
                </text>
                {/* Center hub */}
                <circle cx="50" cy="46" r="8" fill="#FFD166" stroke="white" strokeWidth="1.5" />
                <circle cx="50" cy="46" r="3" fill="#B91C1C" />
              </svg>

              <div className="flex w-full items-center justify-around rounded-full bg-white/95 px-1.5 py-0.5 text-[6.5px] font-black tracking-tight text-slate-800 shadow-xs">
                <span>realme</span>
                <span>Xiaomi</span>
                <span>OPPO</span>
                <span>HONOR</span>
              </div>
            </div>
          </button>

          {/* SLIDE 3: عروض RED نوفمبر */}
          <button
            type="button"
            onClick={() => onSelectSlide?.('red-november', 'عروض RED لشهر نوفمبر')}
            className="relative flex h-[142px] w-full shrink-0 flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#F00000] via-[#D60000] to-[#980000] px-4 py-3 text-center text-white cursor-pointer"
          >
            <div className="flex w-full items-start justify-between">
              <div className="w-12" />
              <div>
                <p className="text-[15px] font-black leading-tight text-white">عروض RED</p>
                <p className="text-[20px] font-black leading-none text-white">نوفمبر</p>
              </div>
              <VodafoneRedBadge />
            </div>

            <div className="flex w-full items-center justify-around gap-2 rounded-xl bg-white px-3 py-2.5 text-slate-900 shadow-md">
              <span className="font-serif text-[15px] font-black italic tracking-tight text-slate-900">
                tbc
              </span>
              <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
              <span className="text-[12px] font-black tracking-widest text-slate-800">
                MAGRABI
              </span>
              <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E60000] text-[7px] font-black leading-tight text-white">
                THE
                <br />
                CAKE
              </span>
            </div>

            <p className="text-[9.5px] font-bold text-white/90">
              خصومات ومزايا حصرية لعملاء RED طوال الشهر
            </p>
          </button>

          {/* SLIDE 4: خصم 50% على SUPER WiFi - Home DSL 485 EGP */}
          <button
            type="button"
            onClick={() => onSelectSlide?.('super-wifi', 'خصم 50% على باقات Super WiFi و Home DSL')}
            className="relative flex h-[142px] w-full shrink-0 items-stretch justify-between overflow-hidden bg-gradient-to-l from-[#2A0004] via-[#7A000A] to-[#1A0002] px-3.5 py-2.5 text-right text-white cursor-pointer"
          >
            {/* Diagonal red glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -bottom-10 h-36 w-52 -rotate-12 bg-red-600/25 blur-xl"
            />

            {/* Right copy */}
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between pl-2">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-block -rotate-3 rounded-md bg-[#FACC15] px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-xs">
                  سعور إيه بس؟
                </span>
                <VodafoneRedBadge />
              </div>

              <div>
                <p className="text-[15px] font-black leading-tight text-white">
                  خصم <span className="text-[#FACC15]">50%</span> على
                </p>
                <p className="text-[15px] font-black tracking-wide text-white">
                  SUPER <span className="text-red-400">WiFi</span>
                </p>
              </div>

              <div>
                <span className="inline-block rounded-full bg-[#FACC15] px-2.5 py-0.5 text-[8.5px] font-black text-slate-950">
                  عرض حصري في كل مكان
                </span>
              </div>
            </div>

            {/* Left Price Tag + Router + Extender */}
            <div className="relative z-10 flex w-[124px] shrink-0 flex-col items-center justify-between">
              <div className="flex w-full items-center justify-between gap-1">
                <div className="rounded-lg bg-white px-2 py-1 text-center text-slate-900 shadow-sm">
                  <p className="text-[7.5px] font-bold text-slate-400 line-through">970 EGP</p>
                  <p dir="ltr" className="font-mono-tabular text-[11px] font-black leading-none text-[#C80000]">
                    485 EGP
                  </p>
                </div>
                <span className="text-[9px] font-black text-white/95">Home DSL</span>
              </div>

              <svg viewBox="0 0 120 68" className="h-[72px] w-full" fill="none" aria-hidden="true">
                {/* Main Router */}
                <rect x="12" y="16" width="54" height="38" rx="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
                <rect x="16" y="48" width="46" height="4" rx="2" fill="#E2E8F0" />
                <circle cx="39" cy="34" r="7" fill="#E60000" />
                <circle cx="40.5" cy="34" r="3" fill="white" />
                {/* Mesh Extender */}
                <rect x="74" y="24" width="34" height="30" rx="5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                <circle cx="91" cy="39" r="5" fill="#E60000" />
                <circle cx="92" cy="39" r="2" fill="white" />
                {/* WiFi arcs */}
                <path d="M52 10c6-4 14-4 20 0" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M56 14c4-2.5 8-2.5 12 0" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </button>

          {/* SLIDE 5: المتحف المصري الكبير GEM.eg */}
          <button
            type="button"
            onClick={() => onSelectSlide?.('gem-tickets', 'احجز تذاكر المتحف المصري الكبير عبر GEM.eg')}
            className="relative flex h-[142px] w-full shrink-0 items-stretch justify-between overflow-hidden bg-gradient-to-l from-[#1C1208] via-[#3A240E] to-[#110B05] px-3.5 py-3 text-right text-white cursor-pointer"
          >
            {/* Illuminated Grand Egyptian Museum architectural skyline on left */}
            <svg
              viewBox="0 0 180 120"
              className="pointer-events-none absolute left-0 bottom-0 h-full w-36 opacity-80"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="gemGlow" x1="90" y1="10" x2="90" y2="115" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FBBF24" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#78350F" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {/* Pyramid facade */}
              <polygon points="10,110 75,34 140,110" fill="url(#gemGlow)" stroke="#F59E0B" strokeOpacity="0.45" />
              {/* Obelisk */}
              <polygon points="118,110 123,28 127,20 131,28 136,110" fill="#D97706" fillOpacity="0.6" />
              {/* Warm plaza ground */}
              <rect x="0" y="108" width="180" height="12" fill="#92400E" fillOpacity="0.45" />
            </svg>

            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-black leading-snug text-white">
                  احجز تذاكر المتحف المصري الكبير
                </p>
                <VodafoneRedBadge />
              </div>

              <p className="text-[10.5px] font-semibold text-amber-100/90">
                مباشرة عبر الموقع الرسمي للمتحف
              </p>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-[#F59E0B] to-[#D97706] px-3 py-1 text-[9.5px] font-black text-slate-950 shadow-sm">
                  <span>اضغط هنا</span>
                  <span className="opacity-60">|</span>
                  <span dir="ltr" className="font-mono-tabular">
                    www.GEM.eg
                  </span>
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 5 Pagination Dots on light background matching IMG_5825 */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="شريط العروض">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={activeIndex === idx}
            aria-label={`إعلان ${idx + 1}`}
            onClick={() => setActiveIndex(idx)}
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 cursor-pointer ${
              activeIndex === idx ? 'bg-[#E60000]' : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
