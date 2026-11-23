import { Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { WalletState } from '../../types/wallet';
import { formatCurrency, formatDateTime, formatPhoneNumber, isCreditTransaction } from '../../utils/formatters';

interface BalanceInquiryPanelProps {
  walletState: WalletState;
  onCopySummary: (summaryText: string) => void;
}

export function BalanceInquiryPanel({ walletState, onCopySummary }: BalanceInquiryPanelProps) {
  const [checkedAt, setCheckedAt] = useState<string>(() => new Date().toISOString());

  const completed = walletState.transactions.filter((tx) => tx.status === 'completed');
  const totalIn = completed
    .filter((tx) => isCreditTransaction(tx.type))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalOut = completed
    .filter((tx) => !isCreditTransaction(tx.type))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const { full } = formatDateTime(checkedAt);

  const buildInquiryText = () =>
    [
      'ملخص مصروفات ورصيد فودافون كاش',
      `رقم المحفظة: ${formatPhoneNumber(walletState.account.accountNumber)}`,
      `الرصيد الحالي: ${formatCurrency(walletState.account.balance)} ج.م`,
      `إجمالي الوارد: +${formatCurrency(totalIn)} ج.م`,
      `إجمالي المصروفات: -${formatCurrency(totalOut)} ج.م`,
      `تاريخ الاستعلام: ${full}`,
    ].join('\n');

  return (
    <section
      aria-labelledby="balance-inquiry-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="balance-inquiry-heading" className="text-base font-bold text-slate-900">
            مصروفاتك والرصيد
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ملخص الرصيد وإجمالي المعاملات الواردة والصادرة
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCheckedAt(new Date().toISOString())}
          aria-label="تحديث"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>تحديث</span>
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="text-xs text-slate-500">الرصيد المتاح حالياً</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span dir="ltr" className="font-mono-tabular text-2xl font-bold text-slate-900">
            {formatCurrency(walletState.account.balance)}
          </span>
          <span className="text-xs font-semibold text-slate-600">ج.م</span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">آخر تحديث: {full}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3.5">
          <p className="text-[11px] text-slate-500">إجمالي المبالغ الواردة</p>
          <p dir="ltr" className="mt-1 font-mono-tabular text-sm font-bold text-emerald-700">
            +{formatCurrency(totalIn)} ج.م
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5">
          <p className="text-[11px] text-slate-500">إجمالي المصروفات</p>
          <p dir="ltr" className="mt-1 font-mono-tabular text-sm font-bold text-slate-900">
            -{formatCurrency(totalOut)} ج.م
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>المحفظة مفعّلة ومؤمّنة</span>
        </div>
        <span className="font-mono-tabular font-semibold">{walletState.transactions.length} معاملة</span>
      </div>

      <button
        type="button"
        onClick={() => onCopySummary(buildInquiryText())}
        className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
        <span>نسخ ملخص المصروفات</span>
      </button>
    </section>
  );
}
