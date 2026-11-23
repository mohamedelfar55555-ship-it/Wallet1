import { Banknote, Copy } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { OperationPayload, OperationResult } from '../../types/wallet';
import { formatCurrency, generateSimulatedOtp } from '../../utils/formatters';

interface WithdrawCashFormProps {
  ownAccountNumber: string;
  availableBalance: number;
  onExecute: (payload: OperationPayload) => OperationResult;
  onCopyCode: (code: string) => void;
}

const WITHDRAW_PRESETS = [200, 500, 1000, 2000];

export function WithdrawCashForm({
  ownAccountNumber,
  availableBalance,
  onExecute,
  onCopyCode,
}: WithdrawCashFormProps) {
  const [channel, setChannel] = useState<'atm' | 'agent'>('atm');
  const [amount, setAmount] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<{ code: string; amount: number; channel: 'atm' | 'agent' } | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const numericAmount = Number.parseFloat(amount);
    const otp = generateSimulatedOtp();
    const channelText =
      channel === 'atm'
        ? `سحب نقدي بدون بطاقة عبر ماكينة ATM · رقم سري متغير #${otp}`
        : `سحب نقدي عبر فرع معتمد${agentCode.trim() ? ` (${agentCode.trim()})` : ''} · رقم سري متغير #${otp}`;

    const result = onExecute({
      type: 'withdraw',
      amount: numericAmount,
      phoneNumber: ownAccountNumber,
      description: channelText,
    });

    if (!result.success) {
      setError(result.error ?? 'تعذر إتمام السحب.');
      return;
    }

    setGeneratedOtp({ code: otp, amount: numericAmount, channel });
    setAmount('');
    setAgentCode('');
  };

  return (
    <section
      aria-labelledby="withdraw-cash-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 id="withdraw-cash-heading" className="text-base font-semibold text-slate-900">
            عمليات ATM والسحب النقدي
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            إصدار رقم سري متغير للسحب من ماكينات الصراف الآلي أو الفروع
          </p>
        </div>
        <span dir="ltr" className="font-mono-tabular text-xs font-medium text-slate-500 whitespace-nowrap">
          {formatCurrency(availableBalance)} ج.م
        </span>
      </div>

      {generatedOtp && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950">
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-800">
              الرقم السري المتغير ({generatedOtp.channel === 'atm' ? 'ATM' : 'فرع فودافون'}) ·{' '}
              <span dir="ltr" className="font-mono-tabular">{formatCurrency(generatedOtp.amount)} ج.م</span>
            </p>
            <p dir="ltr" className="mt-1 inline-block font-mono-tabular text-xl font-bold tracking-widest">
              {generatedOtp.code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCopyCode(generatedOtp.code)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 shrink-0 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ الرمز</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <span className="block text-xs font-semibold text-slate-700">قناة السحب</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setChannel('atm')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                channel === 'atm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ماكينة ATM
            </button>
            <button
              type="button"
              onClick={() => setChannel('agent')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                channel === 'agent' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منفذ بيع معتمد
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="withdraw-amount" className="block text-xs font-semibold text-slate-700">
            مبلغ السحب (ج.م)
          </label>
          <input
            id="withdraw-amount"
            type="number"
            dir="ltr"
            min="20"
            step="10"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-right font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
          />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {WITHDRAW_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(String(preset));
                  setError(null);
                }}
                className="min-h-[36px] rounded-lg border border-slate-200 bg-white font-mono-tabular text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {channel === 'agent' && (
          <div>
            <label htmlFor="withdraw-agent" className="block text-xs font-semibold text-slate-700">
              اسم أو كود المنفذ (اختياري)
            </label>
            <input
              id="withdraw-agent"
              type="text"
              maxLength={80}
              placeholder="مثال: فرع المعادي"
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E60000] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#CC0000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E60000] cursor-pointer"
        >
          <Banknote className="h-4 w-4" aria-hidden="true" />
          <span>إصدار الرقم السري</span>
        </button>
      </form>
    </section>
  );
}
