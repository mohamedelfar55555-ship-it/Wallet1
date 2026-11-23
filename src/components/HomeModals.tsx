import { Bell, CheckCheck, CreditCard, Receipt, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DemoNotification } from '../data/telecomDemoData';
import { formatCurrency } from '../utils/formatters';

interface NotificationsModalProps {
  open: boolean;
  notifications: DemoNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}

export function NotificationsModal({
  open,
  notifications,
  onClose,
  onMarkAllRead,
}: NotificationsModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4.5 w-4.5 text-[#E60000]" aria-hidden="true" />
            <h2 id="notifications-modal-title" className="text-base font-bold text-slate-900">
              الإشعارات
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الإشعارات"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {notifications.map((item) => (
            <li key={item.id} className="py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-xs font-bold ${item.unread ? 'text-slate-900' : 'text-slate-600'}`}>
                  {item.title}
                </p>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.timeLabel}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <CheckCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>تحديد الكل كمقروء</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}


interface RechargeModalProps {
  open: boolean;
  walletBalance: number;
  onClose: () => void;
  onConfirmRecharge: (amount: number, useWallet: boolean) => string | null;
}

export function RechargeModal({
  open,
  walletBalance,
  onClose,
  onConfirmRecharge,
}: RechargeModalProps) {
  const [amount, setAmount] = useState('50');
  const [useWallet, setUseWallet] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const num = Number.parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError('أدخل مبلغ شحن أكبر من 0 ج.م.');
      return;
    }
    const err = onConfirmRecharge(num, useWallet);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recharge-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4.5 w-4.5 text-[#E60000]" aria-hidden="true" />
            <h2 id="recharge-modal-title" className="text-base font-bold text-slate-900">
              شحن الرصيد
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق شحن الرصيد"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="recharge-amount" className="block text-xs font-semibold text-slate-700">
              قيمة الشحن (جنيه)
            </label>
            <input
              id="recharge-amount"
              type="number"
              dir="ltr"
              min="5"
              step="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-right font-mono-tabular text-sm text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
            />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[25, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setAmount(String(val));
                    setError(null);
                  }}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white font-mono-tabular text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-slate-900">الدفع عبر محفظة فودافون كاش</p>
              <p className="text-[11px] text-slate-500">
                الرصيد المتاح: <span dir="ltr" className="font-mono-tabular">{formatCurrency(walletBalance)} ج.م</span>
              </p>
            </div>
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="h-4.5 w-4.5 accent-[#E60000]"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="min-h-[46px] w-full rounded-xl bg-[#E60000] px-4 text-sm font-semibold text-white hover:bg-[#C80000] cursor-pointer"
          >
            اشحن الآن
          </button>
        </form>
      </div>
    </div>
  );
}

interface BillPayModalProps {
  open: boolean;
  billAmount: number;
  billPaid: boolean;
  walletBalance: number;
  onClose: () => void;
  onConfirmPayBill: () => string | null;
}

export function BillPayModal({
  open,
  billAmount,
  billPaid,
  walletBalance,
  onClose,
  onConfirmPayBill,
}: BillPayModalProps) {
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handlePay = () => {
    setError(null);
    const err = onConfirmPayBill();
    if (err) {
      setError(err);
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-[#E60000]" aria-hidden="true" />
            <h2 id="bill-modal-title" className="text-base font-bold text-slate-900">
              فواتير الموبايل
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الفواتير"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">الفاتورة المستحقة</p>
          <p dir="ltr" className="mt-1 inline-block font-mono-tabular text-3xl font-bold text-slate-900">
            {billPaid ? '0.00' : formatCurrency(billAmount)} ج.م
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {billPaid ? 'لا يوجد فواتير مستحقة حالياً' : 'الدفع عبر محفظة فودافون كاش'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            رصيد المحفظة: <span dir="ltr" className="font-mono-tabular">{formatCurrency(walletBalance)} ج.م</span>
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] flex-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            إغلاق
          </button>
          {!billPaid && (
            <button
              type="button"
              onClick={handlePay}
              className="min-h-[46px] flex-1 rounded-xl bg-[#E60000] text-xs font-semibold text-white hover:bg-[#C80000] cursor-pointer"
            >
              دفع الفاتورة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
