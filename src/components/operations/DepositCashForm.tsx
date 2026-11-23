import { PlusCircle } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { OperationPayload, OperationResult } from '../../types/wallet';

interface DepositCashFormProps {
  ownAccountNumber: string;
  onExecute: (payload: OperationPayload) => OperationResult;
}

const DEPOSIT_PRESETS = [500, 1000, 2500, 5000];

export function DepositCashForm({ ownAccountNumber, onExecute }: DepositCashFormProps) {
  const [source, setSource] = useState<'atm' | 'agent'>('agent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const numericAmount = Number.parseFloat(amount);
    const defaultDescription =
      source === 'atm'
        ? `إيداع نقدي عبر ماكينة ATM${note.trim() ? ` · ${note.trim()}` : ''}`
        : `إيداع نقدي عبر فرع معتمد${note.trim() ? ` · ${note.trim()}` : ''}`;

    const result = onExecute({
      type: 'deposit',
      amount: numericAmount,
      phoneNumber: ownAccountNumber,
      description: defaultDescription,
    });

    if (!result.success) {
      setError(result.error ?? 'تعذر إتمام الإيداع.');
      return;
    }

    setAmount('');
    setNote('');
  };

  return (
    <section
      aria-labelledby="deposit-cash-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 id="deposit-cash-heading" className="text-base font-semibold text-slate-900">
          إيداع الأموال
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          إضافة رصيد عبر فرع معتمد أو ماكينة ATM
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <span className="block text-xs font-semibold text-slate-700">قناة الإيداع</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSource('agent')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                source === 'agent' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منفذ بيع معتمد
            </button>
            <button
              type="button"
              onClick={() => setSource('atm')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                source === 'atm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ماكينة ATM
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="deposit-amount" className="block text-xs font-semibold text-slate-700">
            مبلغ الإيداع (ج.م)
          </label>
          <input
            id="deposit-amount"
            type="number"
            dir="ltr"
            min="10"
            step="0.01"
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
            {DEPOSIT_PRESETS.map((preset) => (
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

        <div>
          <label htmlFor="deposit-note" className="block text-xs font-semibold text-slate-700">
            الموقع أو ملاحظة مرجعية (اختياري)
          </label>
          <input
            id="deposit-note"
            type="text"
            maxLength={100}
            placeholder="مثال: فرع المعادي"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          <span>تأكيد الإيداع</span>
        </button>
      </form>
    </section>
  );
}
