import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Copy,
  Eye,
  EyeOff,
  FileSearch,
  PlusCircle,
} from 'lucide-react';
import { useState } from 'react';
import { OperationMode, WalletAccount } from '../types/wallet';
import { formatCurrency, formatPhoneNumber } from '../utils/formatters';

interface WalletCardProps {
  account: WalletAccount;
  activeMode: OperationMode;
  onSelectMode: (mode: OperationMode) => void;
  onCopyAccountNumber: (accountNumber: string) => void;
}

const OPERATION_TABS: {
  mode: OperationMode;
  label: string;
  icon: typeof ArrowUpRight;
}[] = [
  { mode: 'send', label: 'تحويل', icon: ArrowUpRight },
  { mode: 'receive', label: 'استلام', icon: ArrowDownLeft },
  { mode: 'withdraw', label: 'سحب', icon: Banknote },
  { mode: 'deposit', label: 'إيداع', icon: PlusCircle },
  { mode: 'inquiry', label: 'استعلام', icon: FileSearch },
];

export function WalletCard({
  account,
  activeMode,
  onSelectMode,
  onCopyAccountNumber,
}: WalletCardProps) {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <section aria-label="ملخص المحفظة" className="space-y-3.5">
      <div className="rounded-2xl bg-[#C80000] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/85">
              محفظة فودافون كاش
            </p>
            <h1 className="mt-0.5 text-base font-bold tracking-tight text-white truncate">
              {account.holderName}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setBalanceVisible((prev) => !prev)}
            aria-label={balanceVisible ? 'إخفاء رصيد المحفظة' : 'إظهار رصيد المحفظة'}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            {balanceVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-white/80">رصيد المحفظة المتاح</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span dir="ltr" className="font-mono-tabular text-3xl font-bold tracking-tight">
              {balanceVisible ? formatCurrency(account.balance) : '••••••'}
            </span>
            <span className="text-sm font-semibold text-white/90">ج.م</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-3.5">
          <div className="min-w-0">
            <p className="text-[11px] text-white/80">رقم المحفظة</p>
            <p dir="ltr" className="mt-0.5 inline-block font-mono-tabular text-sm font-semibold tracking-wide text-white">
              {formatPhoneNumber(account.accountNumber)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onCopyAccountNumber(account.accountNumber)}
            aria-label="نسخ رقم المحفظة"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/25 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ الرقم</span>
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="خدمات المحفظة"
        className="grid grid-cols-5 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5"
      >
        {OPERATION_TABS.map(({ mode, label, icon: Icon }) => {
          const isActive = activeMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectMode(mode)}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#C80000] text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
