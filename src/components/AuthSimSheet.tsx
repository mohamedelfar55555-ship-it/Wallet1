import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  KeyRound,
  LogOut,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { requestOtp, updateSimPreference, verifyOtp } from '../services/apiClient';
import { detectDeviceSimCapabilities } from '../services/androidDeviceBridge';
import type {
  DemoUserProfile,
  DeviceSimCapabilityReport,
  SimSubscriptionInfo,
} from '../types/wallet';
import { formatPhoneNumber, isValidEgyptianMobile, normalizePhoneInput } from '../utils/formatters';

interface AuthSimSheetProps {
  open: boolean;
  currentUser: DemoUserProfile | null;
  onClose: () => void;
  onAuthenticated: (payload: {
    user: DemoUserProfile;
    walletState?: unknown;
    lineBalance?: number;
    billAmount?: number;
    billPaid?: boolean;
    address?: string;
    biometricEnabled?: boolean;
  }) => void;
  onUserUpdated: (user: DemoUserProfile) => void;
  onLogout: () => Promise<void>;
  onShowNotice: (msg: string, variant?: 'success' | 'error') => void;
}

export function AuthSimSheet({
  open,
  currentUser,
  onClose,
  onAuthenticated,
  onUserUpdated,
  onLogout,
  onShowNotice,
}: AuthSimSheetProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'sim'>('auth');

  // Auth / OTP state
  const [phoneInput, setPhoneInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpPreview, setDemoOtpPreview] = useState<string | null>(null);
  const [providerMsg, setProviderMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // SIM Device Capability state
  const [simReport, setSimReport] = useState<DeviceSimCapabilityReport | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(currentUser?.preferredSimSlot ?? 0);
  const [manualCarrier, setManualCarrier] = useState(currentUser?.simCarrier || 'Vodafone EG');
  const [manualSimPhone, setManualSimPhone] = useState(
    currentUser?.simDetectedNumber || currentUser?.phone || ''
  );
  const [savingSim, setSavingSim] = useState(false);

  const loadSimInfo = async () => {
    setSimLoading(true);
    try {
      const report = await detectDeviceSimCapabilities();
      setSimReport(report);
      if (report.subscriptions.length > 0) {
        const first = report.subscriptions[0];
        setSelectedSlot(first.slotIndex);
        setManualCarrier(first.carrierName);
        if (first.phoneNumber) setManualSimPhone(first.phoneNumber);
      }
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setAuthError(null);
    loadSimInfo();
  }, [open]);

  useEffect(() => {
    if (currentUser) {
      if (typeof currentUser.preferredSimSlot === 'number') {
        setSelectedSlot(currentUser.preferredSimSlot);
      }
      if (currentUser.simCarrier) setManualCarrier(currentUser.simCarrier);
      if (currentUser.simDetectedNumber) setManualSimPhone(currentUser.simDetectedNumber);
    }
  }, [currentUser]);

  if (!open) return null;

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanPhone = normalizePhoneInput(phoneInput);
    if (!isValidEgyptianMobile(cleanPhone)) {
      setAuthError('يرجى إدخال رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 010 / 011 / 012 / 015).');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await requestOtp({
        phone: cleanPhone,
        displayName: displayNameInput.trim() || undefined,
        email: emailInput.trim() || undefined,
      });
      setChallengeId(res.challengeId);
      setProviderMsg(res.message);
      setDemoOtpPreview(res.demoOtpPreview ?? null);
      if (res.displayNameHint && !displayNameInput.trim()) {
        setDisplayNameInput(res.displayNameHint);
      }
      onShowNotice('تم تجهيز رمز التحقق OTP.', 'success');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!challengeId) return;
    setAuthError(null);

    const cleanCode = otpCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setAuthError('أدخل رمز التحقق المكون من 6 أرقام.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await verifyOtp({
        challengeId,
        phone: normalizePhoneInput(phoneInput),
        code: cleanCode,
        displayName: displayNameInput.trim() || undefined,
        email: emailInput.trim() || undefined,
      });
      if (res.authenticated && res.user) {
        onAuthenticated(res as Parameters<AuthSimSheetProps['onAuthenticated']>[0]);
        setChallengeId(null);
        setOtpCode('');
        setDemoOtpPreview(null);
        onShowNotice(`مرحباً ${res.user.displayName} — تم تسجيل الدخول بنجاح.`, 'success');
        onClose();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'فشل التحقق من الرمز.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectNativeSim = (sub: SimSubscriptionInfo) => {
    setSelectedSlot(sub.slotIndex);
    setManualCarrier(sub.carrierName);
    if (sub.phoneNumber) {
      setManualSimPhone(normalizePhoneInput(sub.phoneNumber));
    }
  };

  const handleSaveSimPreference = async (e: FormEvent) => {
    e.preventDefault();
    const cleanNum = manualSimPhone ? normalizePhoneInput(manualSimPhone) : '';
    if (cleanNum && !isValidEgyptianMobile(cleanNum)) {
      onShowNotice('رقم الموبايل المدخل للشريحة غير صالح.', 'error');
      return;
    }

    if (!currentUser) {
      if (cleanNum) {
        setPhoneInput(cleanNum);
        setActiveTab('auth');
        onShowNotice('تم نقل الرقم إلى نموذج تسجيل الدخول برمز OTP.', 'success');
      } else {
        onShowNotice('يرجى تسجيل الدخول أولاً لحفظ تفضيل الشريحة على حسابك.', 'error');
      }
      return;
    }

    setSavingSim(true);
    try {
      const res = await updateSimPreference({
        preferredSimSlot: selectedSlot,
        simCarrier: manualCarrier.trim() || null,
        simOperator: simReport?.subscriptions[selectedSlot]?.mccMnc ?? null,
        simDetectedNumber: cleanNum || null,
      });
      onUserUpdated(res.user);
      onShowNotice('تم حفظ إعدادات الشريحة على حسابك.', 'success');
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر حفظ تفضيلات الشريحة.', 'error');
    } finally {
      setSavingSim(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-sim-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#F4F5F7] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 id="auth-sim-sheet-title" className="text-base font-extrabold text-slate-900">
              الحساب والشريحة (SIM)
            </h2>
            <p className="text-[11px] text-slate-500">
              تسجيل دخول مستقل برمز OTP وإدارة شرائح الجهاز
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-xs hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* 2 Tabs: الحساب والـ OTP | معلومات الشريحة SIM */}
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'auth'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            حساب المستخدم و OTP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sim')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'sim'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الشريحة (Dual-SIM)
          </button>
        </div>

        {activeTab === 'auth' && (
          <div className="space-y-3.5">
            {currentUser && (
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <UserCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-extrabold text-slate-900">
                          {currentUser.displayName}
                        </p>
                        {currentUser.role === 'admin' && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p dir="ltr" className="text-right font-mono-tabular text-xs text-slate-600">
                        {formatPhoneNumber(currentUser.phone)}
                      </p>
                      {currentUser.email && (
                        <p dir="ltr" className="text-right text-[11px] text-slate-500">
                          {currentUser.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await onLogout();
                      onShowNotice('تم تسجيل الخروج وحذف الجلسة الحالية.', 'success');
                    }}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>خروج</span>
                  </button>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-500">
                  جلستك محفوظة ومعزولة بالكامل. يمكنك التبديل إلى حساب رقم آخر أدناه في أي وقت.
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-xs">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4.5 w-4.5 text-[#E60000]" aria-hidden="true" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {currentUser ? 'التبديل أو تسجيل حساب جديد (OTP)' : 'تسجيل الدخول / إنشاء حساب'}
                </h3>
              </div>

              {!challengeId ? (
                <form onSubmit={handleRequestOtp} className="space-y-3">
                  <div>
                    <label htmlFor="otp-phone" className="block text-xs font-bold text-slate-700">
                      رقم الموبايل (مصر)
                    </label>
                    <div className="relative mt-1">
                      <Phone
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="otp-phone"
                        type="tel"
                        dir="ltr"
                        maxLength={11}
                        placeholder="01012345678"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(normalizePhoneInput(e.target.value))}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-right font-mono-tabular text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="otp-name" className="block text-xs font-bold text-slate-700">
                      الاسم (اختياري للحسابات الجديدة)
                    </label>
                    <input
                      id="otp-name"
                      type="text"
                      placeholder="مثال: أحمد محمد"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="otp-email" className="block text-xs font-bold text-slate-700">
                      البريد الإلكتروني (اختياري — لصلاحية الإدارة)
                    </label>
                    <input
                      id="otp-email"
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>

                  {authError && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {authError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="min-h-[44px] w-full rounded-xl bg-[#E60000] text-sm font-bold text-white transition-colors hover:bg-[#C80000] disabled:opacity-60 cursor-pointer"
                  >
                    {authLoading ? 'جاري الإرسال...' : 'إرسال رمز التحقق OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  {providerMsg && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                      <p className="font-semibold">{providerMsg}</p>
                      {demoOtpPreview && (
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-sky-200">
                          <span className="text-[11px] font-bold text-slate-600">
                            رمز التحقق المؤقت:
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono-tabular text-base font-black tracking-widest text-[#E60000]"
                          >
                            {demoOtpPreview}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="otp-code" className="block text-xs font-bold text-slate-700">
                      أدخل رمز التحقق (6 أرقام) للرقم {phoneInput}
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      maxLength={6}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1 w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-center font-mono-tabular text-lg font-extrabold tracking-[0.35em] text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                    />
                  </div>

                  {authError && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {authError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setChallengeId(null);
                        setOtpCode('');
                        setDemoOtpPreview(null);
                      }}
                      className="min-h-[42px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      تغيير الرقم
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="min-h-[42px] rounded-xl bg-[#E60000] text-xs font-bold text-white hover:bg-[#C80000] disabled:opacity-60 cursor-pointer"
                    >
                      {authLoading ? 'جاري التحقق...' : 'تأكيد الدخول'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sim' && (
          <div className="space-y-3.5">
            {/* Security Disclaimer */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed font-medium">
                <strong>تنويه أمان:</strong> اكتشاف رقم الشريحة من الجهاز لا يثبت ملكية حساب فودافون كاش حقيقي، ولا يتصل التطبيق ببيانات أو أرصدة أي تطبيق آخر.
              </p>
            </div>

            {/* Runtime Capability Box */}
            <div className="rounded-2xl bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4.5 w-4.5 text-[#007385]" aria-hidden="true" />
                  <h3 className="text-sm font-extrabold text-slate-900">حالة قراءة شرائح SIM</h3>
                </div>
                <button
                  type="button"
                  onClick={loadSimInfo}
                  disabled={simLoading}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${simLoading ? 'animate-spin' : ''}`} />
                  <span>فحص</span>
                </button>
              </div>

              {simReport && (
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">بيئة التشغيل:</span>
                    <span className="font-bold text-slate-900">
                      {simReport.platform === 'android-capacitor'
                        ? 'Android Native (Capacitor)'
                        : 'متصفح الويب / PWA'}
                    </span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-600">
                    {simReport.reasonMessage}
                  </p>
                </div>
              )}

              {/* Detected Native SIM Subscriptions if running on Android Capacitor */}
              {simReport && simReport.subscriptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">الشرائح المكتشفة على الجهاز:</p>
                  {simReport.subscriptions.map((sub) => {
                    const isSelected = selectedSlot === sub.slotIndex;
                    return (
                      <button
                        key={sub.subscriptionId}
                        type="button"
                        onClick={() => handleSelectNativeSim(sub)}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#E60000] bg-rose-50/70'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Smartphone className="h-5 w-5 text-[#E60000]" aria-hidden="true" />
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">
                              SIM {sub.slotIndex + 1} · {sub.carrierName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {sub.phoneNumber
                                ? sub.phoneNumber
                                : 'الرقم مخفي من شركة الاتصالات / نظام Android'}
                            </p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4.5 w-4.5 text-[#E60000]" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Dual-SIM Manual Fallback / Preference Selection */}
              <form onSubmit={handleSaveSimPreference} className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختيار الشريحة المفضلة (Dual-SIM)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`min-h-[40px] rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          selectedSlot === slot
                            ? 'border-[#E60000] bg-rose-50 text-[#E60000]'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        شريحة SIM {slot + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="sim-carrier" className="block text-xs font-bold text-slate-700">
                    الشبكة / المشغل (Carrier)
                  </label>
                  <select
                    id="sim-carrier"
                    value={manualCarrier}
                    onChange={(e) => setManualCarrier(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                  >
                    <option value="Vodafone EG">Vodafone EG (60202)</option>
                    <option value="Orange EG">Orange EG (60201)</option>
                    <option value="etisalat by e&">etisalat by e& (60203)</option>
                    <option value="WE (Telecom Egypt)">WE (60204)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sim-phone" className="block text-xs font-bold text-slate-700">
                    إدخال رقم الشريحة يدوياً (عند تعذر القراءة التلقائية)
                  </label>
                  <input
                    id="sim-phone"
                    type="tel"
                    dir="ltr"
                    maxLength={11}
                    placeholder="01012345678"
                    value={manualSimPhone}
                    onChange={(e) => setManualSimPhone(normalizePhoneInput(e.target.value))}
                    className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono-tabular text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                  />
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                    <span>تتطلب القراءة التلقائية على Android أذونات READ_PHONE_STATE و READ_PHONE_NUMBERS.</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingSim}
                  className="min-h-[42px] w-full rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingSim
                    ? 'جاري الحفظ...'
                    : currentUser
                      ? 'حفظ إعدادات الشريحة على حسابي'
                      : 'استخدام الرقم لتسجيل الدخول'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
