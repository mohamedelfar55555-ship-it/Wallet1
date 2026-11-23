import { ArrowUpRight } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DEMO_CONTACTS } from '../../data/demoData';
import { OperationPayload, OperationResult } from '../../types/wallet';
import { formatCurrency, formatPhoneNumber, normalizePhoneInput } from '../../utils/formatters';

interface SendMoneyFormProps {
  ownAccountNumber: string;
  availableBalance: number;
  onExecute: (payload: OperationPayload) => OperationResult;
}

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export function SendMoneyForm({
  ownAccountNumber,
  availableBalance,
  onExecute,
}: SendMoneyFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanPhone = normalizePhoneInput(phoneNumber);
    if (cleanPhone === ownAccountNumber) {
      setError('لا يمكن التحويل إلى نفس رقم محفظتك.');
      return;
    }

    const numericAmount = Number.parseFloat(amount);
    const matchedContact = DEMO_CONTACTS.find((c) => c.phoneNumber === cleanPhone);
    const defaultNote = matchedContact
      ? `تحويل محفظة إلى ${matchedContact.name}`
      : `تحويل محفظة إلى ${formatPhoneNumber(cleanPhone)}`;

    const result = onExecute({
      type: 'send',
      amount: numericAmount,
      phoneNumber: cleanPhone,
      description: description.trim() || defaultNote,
    });

    if (!result.success) {
      setError(result.error ?? 'تعذر إتمام التحويل.');
      return;
    }

    setPhoneNumber('');
    setAmount('');
    setDescription('');
  };

  return (
    <section
      aria-labelledby="send-money-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 id="send-money-heading" className="text-base font-semibold text-slate-900">
            تحويل الأموال
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            تحويل فوري إلى أي رقم محفظة في مصر
          </p>
        </div>
        <span dir="ltr" className="font-mono-tabular text-xs font-medium text-slate-500 whitespace-nowrap">
          {formatCurrency(availableBalance)} ج.م
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="send-phone" className="block text-xs font-semibold text-slate-700">
            رقم هاتف المستلم
          </label>
          <input
            id="send-phone"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            placeholder="010XXXXXXXX"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(normalizePhoneInput(e.target.value));
              setError(null);
            }}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-right font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMO_CONTACTS.map((contact) => (
              <button
                key={contact.phoneNumber}
                type="button"
                onClick={() => {
                  setPhoneNumber(contact.phoneNumber);
                  setError(null);
                }}
                className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {contact.name.split(' ')[0]} · <span dir="ltr" className="font-mono-tabular">{contact.phoneNumber.slice(-4)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="send-amount" className="block text-xs font-semibold text-slate-700">
            المبلغ (ج.م)
          </label>
          <input
            id="send-amount"
            type="number"
            dir="ltr"
            min="1"
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
            {QUICK_AMOUNTS.map((preset) => (
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
          <label htmlFor="send-note" className="block text-xs font-semibold text-slate-700">
            ملاحظة أو وصف (اختياري)
          </label>
          <input
            id="send-note"
            type="text"
            maxLength={120}
            placeholder="مثال: مشاركة مصاريف، إيجار شهري، فاتورة"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E60000] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#CC0000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E60000] cursor-pointer"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          <span>تأكيد التحويل</span>
        </button>
      </form>
    </section>
  );
}
