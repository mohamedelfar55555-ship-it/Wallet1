import {
  Bell,
  Check,
  ChevronLeft,
  Copy,
  CreditCard,
  FileText,
  Fingerprint,
  Lock,
  LogOut,
  MapPin,
  RotateCcw,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { TELECOM_DEMO_PROFILE } from '../data/telecomDemoData';
import { formatCurrency, isValidEgyptianMobile } from '../utils/formatters';

export interface ProfileScreenProps {
  open: boolean;
  subscriberName: string;
  mobileNumber: string;
  address: string;
  biometricEnabled: boolean;
  lineBalance: number;
  walletBalance: number;
  walletAccountNumber: string;
  onClose: () => void;
  onCopyText: (value: string, label: string) => void;
  onSaveProfile: (updates: {
    subscriberName: string;
    mobileNumber: string;
    address: string;
  }) => void;
  onToggleBiometric: (enabled: boolean) => void;
  onOpenPreviousPayments: () => void;
  onOpenNotifications: () => void;
  onResetData: () => void;
  onLogout?: () => void;
  onOpenAuthSim?: () => void;
  onShowNotice: (message: string) => void;
}

type ProfileSubSheet = 'accounts' | 'edit' | 'cards' | 'address' | 'password' | null;

export function ProfileScreen({
  open,
  subscriberName,
  mobileNumber,
  address,
  biometricEnabled,
  lineBalance,
  walletBalance,
  walletAccountNumber,
  onClose,
  onCopyText,
  onSaveProfile,
  onToggleBiometric,
  onOpenPreviousPayments,
  onOpenNotifications,
  onResetData,
  onLogout,
  onOpenAuthSim,
  onShowNotice,
}: ProfileScreenProps) {
  const [subSheet, setSubSheet] = useState<ProfileSubSheet>(null);
  const [draftName, setDraftName] = useState(subscriberName);
  const [draftPhone, setDraftPhone] = useState(mobileNumber);
  const [draftAddress, setDraftAddress] = useState(address);
  const [editError, setEditError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'عربي' | 'English'>('عربي');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubSheet(null);
      return;
    }
    setDraftName(subscriberName);
    setDraftPhone(mobileNumber);
    setDraftAddress(address);
    setEditError(null);
  }, [open, subscriberName, mobileNumber, address]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (subSheet) {
          setSubSheet(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, subSheet, onClose]);

  if (!open) return null;

  const fullProfileSummary = [
    `الاسم: ${subscriberName}`,
    `رقم الموبايل: ${mobileNumber}`,
    `رقم المحفظة: ${walletAccountNumber}`,
    `الباقة: ${TELECOM_DEMO_PROFILE.planName}`,
    `رصيد الخط: ${formatCurrency(lineBalance)} جنيه`,
    `رصيد فودافون كاش: ${formatCurrency(walletBalance)} ج.م`,
    `العنوان: ${address}`,
  ].join('\n');

  const handleSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    setEditError(null);
    const cleanName = draftName.trim();
    const cleanPhone = draftPhone.replace(/\D/g, '');
    const cleanAddress = draftAddress.trim();

    if (!cleanName) {
      setEditError('يرجى إدخال الاسم.');
      return;
    }
    if (!isValidEgyptianMobile(cleanPhone)) {
      setEditError('يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقماً.');
      return;
    }
    if (!cleanAddress) {
      setEditError('يرجى إدخال العنوان.');
      return;
    }

    onSaveProfile({
      subscriberName: cleanName,
      mobileNumber: cleanPhone,
      address: cleanAddress,
    });
    setSubSheet(null);
    onShowNotice('تم تحديث بيانات الملف الشخصي بنجاح.');
  };

  const handleSavePassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (currentPassword.length < 4 || newPassword.length < 6) {
      setPasswordError('يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setSubSheet(null);
    onShowNotice('تم تغيير كلمة المرور بنجاح.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-screen-title"
      className="fixed inset-0 z-50 flex justify-center bg-slate-950/35 backdrop-blur-xs"
    >
      <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-[#F7F8FA] text-slate-900 shadow-2xl">
        {/* Top Bar (matching IMG_5813) */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-center bg-[#F7F8FA]/95 px-4 backdrop-blur-md">
          <h1 id="profile-screen-title" className="text-[18px] font-bold text-slate-900">
            الملف الشخصي
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الملف الشخصي"
            className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="h-6 w-6 stroke-[1.8]" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 px-4 pb-8">
          {/* Card 1: Profile Name + Mobile Number (with copy) + حساباتي / تعديل */}
          <section className="mt-1 rounded-xl bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-right">
                <p className="text-[16px] font-extrabold tracking-tight text-slate-900 truncate">
                  {subscriberName}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyText(mobileNumber, `تم نسخ الرقم ${mobileNumber}`)}
                    aria-label="نسخ رقم الموبايل"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-800 transition-colors hover:bg-slate-200/80 cursor-pointer"
                  >
                    <span dir="ltr" className="font-mono-tabular text-[13px] font-bold">
                      {mobileNumber}
                    </span>
                    <Copy className="h-3.5 w-3.5 text-[#E60000]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onCopyText(fullProfileSummary, 'تم نسخ جميع بيانات الحساب')}
                className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-[#E60000]" aria-hidden="true" />
                <span>نسخ الكل</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSubSheet('accounts')}
                className="min-h-[42px] rounded-lg bg-[#E60000] px-4 text-sm font-bold text-white transition-colors hover:bg-[#CC0000] cursor-pointer"
              >
                حساباتي
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditError(null);
                  setSubSheet('edit');
                }}
                className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                تعديل
              </button>
            </div>
          </section>

          {/* App Version Status Row (matching IMG_5813) */}
          <div className="my-5 flex items-center justify-center gap-3.5 px-2">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3E8E1E] text-white shadow-xs"
            >
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div className="text-right">
              <p className="text-[15px] font-extrabold text-slate-900">التطبيق على آخر إصدار</p>
              <button
                type="button"
                onClick={() =>
                  onCopyText(
                    TELECOM_DEMO_PROFILE.appVersion,
                    `تم نسخ رقم الإصدار ${TELECOM_DEMO_PROFILE.appVersion}`
                  )
                }
                className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
              >
                <span>رقم الإصدار:</span>
                <span dir="ltr" className="font-mono-tabular">
                  {TELECOM_DEMO_PROFILE.appVersion}
                </span>
              </button>
            </div>
          </div>

          {/* Section 1: المدفوعات (matching IMG_5813) */}
          <section aria-label="المدفوعات">
            <h2 className="mb-2.5 text-[16px] font-extrabold text-slate-900">المدفوعات</h2>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setSubSheet('cards')}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5.5 w-5.5 text-slate-600 shrink-0" aria-hidden="true" />
                  <span className="text-[14px] font-bold text-slate-900">إدارة البطاقات الخاصة بي</span>
                </div>
                <ChevronLeft className="h-5 w-5 text-[#E60000] shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreviousPayments();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5.5 w-5.5 text-slate-600 shrink-0" aria-hidden="true" />
                  <span className="text-[14px] font-bold text-slate-900">المدفوعات السابقة</span>
                </div>
                <ChevronLeft className="h-5 w-5 text-[#E60000] shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setSubSheet('address')}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5.5 w-5.5 text-[#E60000] shrink-0" aria-hidden="true" />
                  <span className="text-[14px] font-bold text-slate-900">عنواني</span>
                </div>
                <ChevronLeft className="h-5 w-5 text-[#E60000] shrink-0" aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* Section 2: الإعدادات (matching IMG_5814) */}
          <section aria-label="الإعدادات" className="mt-6">
            <h2 className="mb-2.5 text-[16px] font-extrabold text-slate-900">الإعدادات</h2>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const nextLang = language === 'عربي' ? 'English' : 'عربي';
                  setLanguage(nextLang);
                  onShowNotice(`تم تحديد اللغة: ${nextLang}`);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-900">اللغة</span>
                <span className="text-sm font-bold text-[#E60000]">{language}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNotifications();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-900">إعدادات الإشعارات</span>
                <Bell className="h-5.5 w-5.5 text-slate-700 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setPasswordError(null);
                  setSubSheet('password');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-900">تغيير كلمة المرور</span>
                <Lock className="h-5.5 w-5.5 text-slate-700 shrink-0" aria-hidden="true" />
              </button>

              <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-3 min-w-0">
                  <Fingerprint className="h-6 w-6 text-slate-800 shrink-0" aria-hidden="true" />
                  <span className="text-[13.5px] font-bold leading-snug text-slate-900">
                    تفعيل تسجيل الدخول بالبصمة على هذا الحساب
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={biometricEnabled}
                  aria-label="تفعيل تسجيل الدخول بالبصمة على هذا الحساب"
                  onClick={() => {
                    const next = !biometricEnabled;
                    onToggleBiometric(next);
                    onShowNotice(
                      next ? 'تم تفعيل تسجيل الدخول بالبصمة' : 'تم إيقاف تسجيل الدخول بالبصمة'
                    );
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    biometricEnabled ? 'justify-end bg-[#007D8F]' : 'justify-start bg-slate-300'
                  }`}
                >
                  <span className="inline-block h-6 w-6 rounded-full bg-white shadow-xs transition-all" />
                </button>
              </div>

              {onOpenAuthSim && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthSim();
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-[14px] font-bold text-slate-900">الحساب برمز OTP وشريحة SIM</span>
                  <ChevronLeft className="h-5 w-5 text-[#E60000] shrink-0" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onLogout) {
                    onLogout();
                  } else {
                    onShowNotice('تم تسجيل الخروج من الجلسة الحالية');
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-right shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-[14px] font-bold text-slate-900">الخروج</span>
                <LogOut className="h-5.5 w-5.5 text-[#E60000] shrink-0" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>

        {/* Interactive Sub-Sheets for Profile Actions */}
        {subSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
            onClick={() => setSubSheet(null)}
          >
            <div
              className="w-full max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {subSheet === 'accounts' && 'حساباتي وبيانات الخط'}
                  {subSheet === 'edit' && 'تعديل الملف الشخصي'}
                  {subSheet === 'cards' && 'إدارة البطاقات الخاصة بي'}
                  {subSheet === 'address' && 'عنواني'}
                  {subSheet === 'password' && 'تغيير كلمة المرور'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSubSheet(null)}
                  aria-label="إغلاق"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {subSheet === 'accounts' && (
                <div className="space-y-3">
                  <dl className="divide-y divide-slate-100 text-sm">
                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">الاسم</dt>
                      <dd className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{subscriberName}</span>
                        <button
                          type="button"
                          onClick={() => onCopyText(subscriberName, 'تم نسخ الاسم')}
                          aria-label="نسخ الاسم"
                          className="text-slate-400 hover:text-[#E60000] cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </dd>
                    </div>

                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">رقم الموبايل</dt>
                      <dd className="flex items-center gap-2">
                        <span dir="ltr" className="font-mono-tabular text-xs font-bold text-slate-900">
                          {mobileNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopyText(mobileNumber, `تم نسخ الرقم ${mobileNumber}`)}
                          aria-label="نسخ رقم الموبايل"
                          className="text-slate-400 hover:text-[#E60000] cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </dd>
                    </div>

                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">رقم محفظة كاش</dt>
                      <dd className="flex items-center gap-2">
                        <span dir="ltr" className="font-mono-tabular text-xs font-bold text-slate-900">
                          {walletAccountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onCopyText(walletAccountNumber, `تم نسخ رقم المحفظة ${walletAccountNumber}`)
                          }
                          aria-label="نسخ رقم المحفظة"
                          className="text-slate-400 hover:text-[#E60000] cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </dd>
                    </div>

                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">الباقة الحالية</dt>
                      <dd className="text-xs font-semibold text-slate-800">
                        {TELECOM_DEMO_PROFILE.planName}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">رصيد الخط</dt>
                      <dd dir="ltr" className="font-mono-tabular text-xs font-bold text-slate-900">
                        {formatCurrency(lineBalance)} جنيه
                      </dd>
                    </div>

                    <div className="flex items-center justify-between py-2.5">
                      <dt className="text-xs text-slate-500">رصيد فودافون كاش</dt>
                      <dd dir="ltr" className="font-mono-tabular text-xs font-bold text-[#E60000]">
                        {formatCurrency(walletBalance)} ج.م
                      </dd>
                    </div>
                  </dl>

                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => onCopyText(fullProfileSummary, 'تم نسخ جميع بيانات الحساب')}
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#E60000] px-3 text-xs font-bold text-white hover:bg-[#CC0000] cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ كل البيانات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onResetData();
                        setSubSheet(null);
                      }}
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>إعادة ضبط البيانات</span>
                    </button>
                  </div>
                </div>
              )}

              {subSheet === 'edit' && (
                <form onSubmit={handleSaveEdit} className="space-y-3.5">
                  <div>
                    <label htmlFor="edit-name" className="block text-xs font-bold text-slate-700">
                      الاسم
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-phone" className="block text-xs font-bold text-slate-700">
                      رقم الموبايل
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      dir="ltr"
                      maxLength={11}
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono-tabular text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-address" className="block text-xs font-bold text-slate-700">
                      العنوان
                    </label>
                    <input
                      id="edit-address"
                      type="text"
                      value={draftAddress}
                      onChange={(e) => setDraftAddress(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>
                  {editError && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {editError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="min-h-[44px] w-full rounded-xl bg-[#E60000] text-sm font-bold text-white hover:bg-[#CC0000] cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                </form>
              )}

              {subSheet === 'cards' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-xs font-bold text-slate-900">CIB Mastercard</p>
                      <p dir="ltr" className="mt-0.5 font-mono-tabular text-xs text-slate-500">
                        •••• •••• •••• 4821
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      مفعّلة
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubSheet(null);
                      onShowNotice('تم تأكيد البطاقة البنكية المرتبطة بالمحفظة.');
                    }}
                    className="min-h-[42px] w-full rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    حسناً
                  </button>
                </div>
              )}

              {subSheet === 'address' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <p className="text-xs font-semibold text-slate-800">{address}</p>
                    <button
                      type="button"
                      onClick={() => onCopyText(address, 'تم نسخ العنوان')}
                      aria-label="نسخ العنوان"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white cursor-pointer"
                    >
                      <Copy className="h-4 w-4 text-[#E60000]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubSheet('edit')}
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
                  >
                    تعديل العنوان
                  </button>
                </div>
              )}

              {subSheet === 'password' && (
                <form onSubmit={handleSavePassword} className="space-y-3">
                  <div>
                    <label htmlFor="cur-pass" className="block text-xs font-bold text-slate-700">
                      كلمة المرور الحالية
                    </label>
                    <input
                      id="cur-pass"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-pass" className="block text-xs font-bold text-slate-700">
                      كلمة المرور الجديدة
                    </label>
                    <input
                      id="new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>
                  {passwordError && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {passwordError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="min-h-[44px] w-full rounded-xl bg-[#E60000] text-sm font-bold text-white hover:bg-[#CC0000] cursor-pointer"
                  >
                    تحديث كلمة المرور
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
