import { ArrowRight, Gift, Wallet, Wifi } from 'lucide-react';
import { useState } from 'react';
import {
  DEMO_OFFERS,
  OFFER_CATEGORIES,
  OfferCategory,
  TELECOM_DEMO_PROFILE,
} from '../data/telecomDemoData';
import { AppRoute } from '../types/navigation';

interface PlaceholderSectionScreenProps {
  section: 'offers' | 'internet';
  onNavigate: (route: AppRoute) => void;
  onGoBack: () => void;
  onShowNotice: (message: string) => void;
}

export function PlaceholderSectionScreen({
  section,
  onNavigate,
  onGoBack,
  onShowNotice,
}: PlaceholderSectionScreenProps) {
  const [offerCategory, setOfferCategory] = useState<OfferCategory>('all');

  if (section === 'offers') {
    const filteredOffers =
      offerCategory === 'all'
        ? DEMO_OFFERS
        : DEMO_OFFERS.filter((item) => item.category === offerCategory);

    return (
      <div className="animate-view-enter space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">العروض</h1>
              <p className="text-xs text-slate-500">أحدث عروض باقات الإنترنت والمكالمات وفودافون كاش</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {OFFER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setOfferCategory(cat.id)}
                className={`min-h-[36px] rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  offerCategory === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <ul className="mt-3 divide-y divide-slate-100">
            {filteredOffers.map((offer) => (
              <li key={offer.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold" style={{ color: offer.accentColor }}>
                    {offer.badgeText} · {offer.categoryLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{offer.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{offer.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onShowNotice(`تم عرض تفاصيل: ${offer.title}`)}
                  className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 shrink-0 cursor-pointer"
                >
                  التفاصيل
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>رجوع</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E60000] px-4 text-xs font-semibold text-white hover:bg-[#C80000] cursor-pointer"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span>فودافون كاش</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  const usagePercent = Math.round(
    (TELECOM_DEMO_PROFILE.internet.remainingMb / TELECOM_DEMO_PROFILE.internet.totalMb) * 100
  );

  return (
    <div className="animate-view-enter space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
            <Wifi className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">إدارة الباقة والإنترنت</h1>
            <p className="text-xs text-slate-500">متابعة استهلاك باقة الإنترنت الشهرية</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">{TELECOM_DEMO_PROFILE.planName}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span dir="ltr" className="font-mono-tabular text-3xl font-bold text-slate-900">
              {TELECOM_DEMO_PROFILE.internet.remainingMb}
            </span>
            <span className="text-xs text-slate-600">
              متاحة من {TELECOM_DEMO_PROFILE.internet.totalMb} ميجا
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#E60000]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {TELECOM_DEMO_PROFILE.internet.daysLeft} يوم علي التجديد · {TELECOM_DEMO_PROFILE.internet.renewalDate}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onShowNotice('الباقة الحالية مفعّلة ولا تحتاج لتجديد مبكر حالياً')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E60000] px-4 text-xs font-semibold text-white hover:bg-[#C80000] cursor-pointer"
          >
            <span>تجديد الباقة</span>
          </button>
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>رجوع</span>
          </button>
        </div>
      </section>
    </div>
  );
}
