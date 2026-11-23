import { ArrowRight, Eye, EyeOff, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
  fetchAdminAuthStatus,
  loginAdmin,
  setupInitialAdmin,
} from '../services/apiClient';
import type { AdminAuthStatus } from '../types/wallet';

interface AdminLoginScreenProps {
  onBack: () => void;
  onAuthenticated: (status: AdminAuthStatus) => void;
  onShowNotice: (message: string, variant?: 'success' | 'error') => void;
}

export function AdminLoginScreen({
  onBack,
  onAuthenticated,
  onShowNotice,
}: AdminLoginScreenProps) {
  const [statusLoading, setStatusLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const res = await fetchAdminAuthStatus();
        if (!active) return;
        setAuthStatus(res);
        if (res.sessionAuthenticated) {
          onAuthenticated(res);
          return;
        }
        if (!res.configured && res.adminEmailHint) {
          setUsername(res.adminEmailHint);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'تعذر التحقق من حالة دخول المسؤول.');
      } finally {
        if (active) setStatusLoading(false);
      }
    };

    void loadStatus();
    return () => {
      active = false;
    };
  }, [onAuthenticated]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('يرجى إدخال اسم مستخدم صالح للمسؤول (3 أحرف على الأقل).');
      return;
    }

    if (!authStatus?.configured) {
      if (password.length < 8) {
        setError('يجب أن تتكون كلمة مرور المسؤول من 8 أحرف على الأقل.');
        return;
      }
      if (password !== confirmPassword) {
        setError('تأكيد كلمة المرور غير متطابق.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await setupInitialAdmin({ username: cleanUsername, password });
        onShowNotice('تم إعداد حساب المسؤول الوحيد وتسجيل الدخول بنجاح.', 'success');
        onAuthenticated({
          configured: true,
          sessionAuthenticated: true,
          expiresAt: res.expiresAt,
          admin: res.admin,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'فشل إعداد حساب المسؤول.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('يرجى إدخال كلمة مرور المسؤول.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin({ username: cleanUsername, password });
      onShowNotice('تم تسجيل دخول المسؤول بنجاح.', 'success');
      onAuthenticated({
        configured: true,
        sessionAuthenticated: true,
        expiresAt: res.expiresAt,
        admin: res.admin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحقق من بيانات المسؤول.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-view-enter min-h-full bg-[#F4F5F7] pb-8">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="رجوع"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100 cursor-pointer"
        >
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[15px] font-extrabold text-slate-900">دخول المسؤول</h1>
        <div className="w-9" aria-hidden="true" />
      </header>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
              {authStatus?.configured === false ? (
                <KeyRound className="h-5.5 w-5.5" aria-hidden="true" />
              ) : (
                <Lock className="h-5.5 w-5.5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-extrabold">
                {statusLoading
                  ? 'جاري فحص بوابة الإدارة...'
                  : authStatus?.configured
                    ? 'تسجيل دخول المسؤول الوحيد'
                    : 'الإعداد الأول لحساب المسؤول الوحيد'}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-300">
                وصول مقصور على حساب مسؤول واحد فقط عبر جلسة مشفرة ومحدودة المدة.
              </p>
            </div>
          </div>
        </div>

        {statusLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500">
            جاري التحقق من إعدادات الأمان...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
          >
            {!authStatus?.configured && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
                <p className="leading-relaxed">
                  لم يتم تعيين كلمة مرور المسؤول بعد. هذا الإعداد يتم لمرة واحدة فقط لإنشاء بيانات اعتماد المسؤول الوحيد وتخزينها بتجزئة <span dir="ltr">scrypt</span> آمنة.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="admin-username-input" className="block text-xs font-bold text-slate-700">
                اسم المستخدم للمسؤول
              </label>
              <input
                id="admin-username-input"
                type="text"
                dir="ltr"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="admin-password-input" className="block text-xs font-bold text-slate-700">
                {authStatus?.configured ? 'كلمة مرور المسؤول' : 'تعيين كلمة مرور قوية (8 أحرف فأكثر)'}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete={authStatus?.configured ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-left text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!authStatus?.configured && (
              <div>
                <label
                  htmlFor="admin-confirm-password-input"
                  className="block text-xs font-bold text-slate-700"
                >
                  تأكيد كلمة المرور
                </label>
                <input
                  id="admin-confirm-password-input"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              <ShieldCheck className="h-4.5 w-4.5 text-amber-400" aria-hidden="true" />
              <span>
                {submitting
                  ? 'جاري التحقق...'
                  : authStatus?.configured
                    ? 'دخول إلى لوحة الإدارة'
                    : 'حفظ كلمة المرور والدخول'}
              </span>
            </button>

            <p className="text-center text-[11px] leading-relaxed text-slate-500">
              تُحفظ الجلسة بصلاحية مؤقتة (4 ساعات) وتُرفض طلبات المستخدمين العاديين تلقائياً من الخادم.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
