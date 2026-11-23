import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Fingerprint,
  HelpCircle,
  Info,
  Lock,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Upload,
  User,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { TELECOM_DEMO_PROFILE } from '../data/telecomDemoData';
import { AppRoute } from '../types/navigation';
import { DemoUserProfile } from '../types/wallet';
import { formatCurrency, formatPhoneNumber } from '../utils/formatters';

interface MoreScreenProps {
  subscriberName: string;
  mobileNumber: string;
  lineBalance: number;
  walletBalance: number;
  biometricEnabled: boolean;
  unreadNotifications: number;
  currentUser: DemoUserProfile | null;
  importedCount: number;
  adminAuthenticated: boolean;
  onNavigate: (route: AppRoute) => void;
  onOpenProfile: () => void;
  onOpenAuthSim: () => void;
  onOpenNotifications: () => void;
  onToggleBiometric: (enabled: boolean) => void;
  onResetData: () => void;
  onCopyText: (value: string, label: string) => void;
  onShowNotice: (message: string) => void;
}

export function MoreScreen({
  subscriberName,
  mobileNumber,
  lineBalance,
  walletBalance,
  biometricEnabled,
  unreadNotifications,
  currentUser,
  importedCount,
  adminAuthenticated,
  onNavigate,
  onOpenProfile,
  onOpenAuthSim,
  onOpenNotifications,
  onToggleBiometric,
  onResetData,
  onCopyText,
  onShowNotice,
}: MoreScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  return (
    <div className="animate-view-enter space-y-5 p-4 pb-8">
      {/* Subscriber Summary Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#E60000]">
              <User className="h-5.5 w-5.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-extrabold text-slate-900 truncate">
                {subscriberName}
              </h1>
              <p dir="ltr" className="text-right font-mono-tabular text-xs font-semibold text-slate-500">
                {formatPhoneNumber(mobileNumber)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            <span>الملف الشخصي</span>
            <ChevronLeft className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">رصيد الخط</p>
            <p dir="ltr" className="text-right font-mono-tabular text-sm font-extrabold text-slate-900">
              {formatCurrency(lineBalance)} جنيه
            </p>
          </div>
          <div className="rounded-xl bg-rose-50/60 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-600">فودافون كاش</p>
            <p dir="ltr" className="text-right font-mono-tabular text-sm font-extrabold text-[#E60000]">
              {formatCurrency(walletBalance)} ج.م
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: إعدادات الحساب */}
      <section aria-label="إعدادات الحساب" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">إعدادات الحساب</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            onClick={onOpenAuthSim}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#007385]">
                <Smartphone className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-slate-900">
                  {currentUser ? 'الحساب المرتبط وشريحة SIM' : 'تسجيل الدخول وربط الشريحة'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {currentUser
                    ? `مسجل برقم ${formatPhoneNumber(currentUser.phone)}`
                    : 'تسجيل الدخول برمز OTP وحفظ بيانات محفظتك'}
                </p>
              </div>
            </div>
            <ChevronLeft className="h-4.5 w-4.5 text-[#E60000] shrink-0" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
                <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-slate-900">محفظة فودافون كاش</p>
                <p className="text-[11px] text-slate-500">التحويلات، الدفع، وسجل المعاملات</p>
              </div>
            </div>
            <ChevronLeft className="h-4.5 w-4.5 text-[#E60000] shrink-0" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('import-data')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
                <Upload className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-slate-900">
                  استيراد بيانات المحفظة ({importedCount})
                </p>
                <p className="text-[11px] text-slate-500">استيراد الحافظة، صور الشاشة، CSV و Excel</p>
              </div>
            </div>
            <ChevronLeft className="h-4.5 w-4.5 text-[#E60000] shrink-0" aria-hidden="true" />
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <RotateCcw className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[13.5px] font-bold text-slate-900">إعادة ضبط البيانات الافتراضية</p>
                  <p className="text-[11px] text-slate-500">استعادة الرصيد والمعاملات التجريبية الأولية</p>
                </div>
              </div>
              <ChevronLeft className="h-4.5 w-4.5 text-slate-400 shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <div className="bg-amber-50/70 px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-slate-900">
                هل تريد استعادة البيانات الافتراضية للمحفظة والخط؟
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetData();
                  }}
                  className="min-h-[34px] rounded-xl bg-[#E60000] px-3.5 text-xs font-bold text-white hover:bg-[#C80000] cursor-pointer"
                >
                  تأكيد الاستعادة
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[34px] rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: المعلومات الشخصية */}
      <section aria-label="المعلومات الشخصية" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">المعلومات الشخصية</h2>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <dl className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between py-3">
              <dt className="text-slate-500">الاسم</dt>
              <dd className="font-bold text-slate-900">{subscriberName}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-slate-500">رقم الهاتف</dt>
              <dd className="flex items-center gap-2">
                <span dir="ltr" className="font-mono-tabular font-bold text-slate-900">
                  {formatPhoneNumber(mobileNumber)}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyText(mobileNumber, `تم نسخ الرقم ${mobileNumber}`)}
                  aria-label="نسخ رقم الهاتف"
                  className="text-slate-400 hover:text-[#E60000] cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-slate-500">الباقة</dt>
              <dd className="font-bold text-slate-900">{TELECOM_DEMO_PROFILE.planName}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onOpenProfile}
            className="mb-2 mt-1 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <span>تعديل المعلومات الشخصية وإدارة البطاقات</span>
            <ChevronLeft className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Section 3: الإشعارات */}
      <section aria-label="الإشعارات" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">الإشعارات</h2>
        <button
          type="button"
          onClick={onOpenNotifications}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-right shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Bell className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-slate-900">تنبيهات الحساب والمعاملات</p>
              <p className="text-[11px] text-slate-500">
                {unreadNotifications > 0
                  ? `لديك ${unreadNotifications} إشعارات غير مقروءة`
                  : 'جميع الإشعارات مقروءة'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadNotifications > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E60000] px-1.5 text-[10px] font-bold text-white">
                {unreadNotifications}
              </span>
            )}
            <ChevronLeft className="h-4.5 w-4.5 text-[#E60000]" aria-hidden="true" />
          </div>
        </button>
      </section>

      {/* Section 4: الخصوصية والأمان */}
      <section aria-label="الخصوصية والأمان" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">الخصوصية والأمان</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Fingerprint className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-slate-900">تفعيل البصمة</p>
                <p className="text-[11px] text-slate-500">
                  تأكيد إظهار الرصيد والعمليات الحساسة بالبصمة
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={biometricEnabled}
              aria-label="تفعيل البصمة"
              onClick={() => {
                const next = !biometricEnabled;
                onToggleBiometric(next);
                onShowNotice(next ? 'تم تفعيل القفل بالبصمة' : 'تم إيقاف القفل بالبصمة');
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                biometricEnabled ? 'justify-end bg-[#007D8F]' : 'justify-start bg-slate-300'
              }`}
            >
              <span className="inline-block h-6 w-6 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="text-[11.5px] leading-relaxed text-slate-600">
              <p className="font-bold text-slate-900">عزل البيانات والخصوصية</p>
              <p className="mt-0.5">
                جميع السجلات المستوردة محفوظة بشكل معزول لكل مستخدم وموسومة كبيانات مدخلة غير موثّقة، ولا يصل التطبيق لأي تطبيقات مالية خارجية أو أرقام سرية حقيقية.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: المساعدة والدعم */}
      <section aria-label="المساعدة والدعم" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">المساعدة والدعم</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            onClick={() => setHelpExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
                <HelpCircle className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-slate-900">الأسئلة الشائعة وخدمة العملاء</p>
                <p className="text-[11px] text-slate-500">دعم المحفظة، الشريحة، والاستيراد</p>
              </div>
            </div>
            <ChevronDown
              className={`h-4.5 w-4.5 text-slate-500 transition-transform ${
                helpExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {helpExpanded && (
            <div className="space-y-2.5 bg-slate-50/70 px-4 py-3.5 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 border border-slate-200">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
                  <div>
                    <p className="font-bold text-slate-900">الخط المختصر لخدمة كاش</p>
                    <p dir="ltr" className="text-right font-mono-tabular text-[11px] text-slate-500">
                      7001
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyText('7001', 'تم نسخ رقم الدعم 7001')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  نسخ
                </button>
              </div>
              <p className="leading-relaxed text-[11.5px] text-slate-600">
                لإدخال معاملات محفوظة لديك في جدول السجلات أو قراءة نص إيصال، افتح قسم «استيراد بيانات المحفظة» من الأعلى وراجع المسودة قبل الحفظ.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Section 6: معلومات التطبيق */}
      <section aria-label="معلومات التطبيق" className="space-y-2">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">معلومات التطبيق</h2>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Check className="h-4.5 w-4.5 stroke-[2.5]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-slate-900">{TELECOM_DEMO_PROFILE.brandName}</p>
                <p className="text-[11px] text-slate-500">
                  الإصدار{' '}
                  <span dir="ltr" className="font-mono-tabular font-semibold">
                    {TELECOM_DEMO_PROFILE.appVersion}
                  </span>{' '}
                  · محدث لآخر إصدار
                </p>
              </div>
            </div>
            <Info className="h-4.5 w-4.5 text-slate-400 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Section 7: دخول المسؤول (Strict Single-Admin Entry Point — hidden from Home, no admin tools exposed to ordinary users) */}
      <section aria-label="دخول المسؤول" className="space-y-2 pt-1">
        <h2 className="px-1 text-xs font-extrabold text-slate-500">الإدارة</h2>
        <button
          type="button"
          onClick={() => onNavigate(adminAuthenticated ? 'admin' : 'admin-login')}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-right shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Lock className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-slate-900">دخول المسؤول</p>
              <p className="text-[11px] text-slate-500">
                {adminAuthenticated
                  ? 'جلسة المسؤول نشطة · فتح لوحة الإدارة المركزية'
                  : 'بوابة الإدارة المركزية للمسؤول الوحيد المصرح له'}
              </p>
            </div>
          </div>
          <ChevronLeft className="h-4.5 w-4.5 text-slate-700 shrink-0" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
