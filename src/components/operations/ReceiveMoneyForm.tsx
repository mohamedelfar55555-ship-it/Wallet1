import { ArrowDownLeft, Copy } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DEMO_CONTACTS } from '../../data/demoData';
import { OperationPayload, OperationResult } from '../../types/wallet';
import { formatPhoneNumber, normalizePhoneInput } from '../../utils/formatters';

interface ReceiveMoneyFormProps {
  ownAccountNumber: string;
  onCopyAccountNumber: (accountNumber: string) => void;
  onExecute: (payload: OperationPayload) => OperationResult;
}

export function ReceiveMoneyForm({
  ownAccountNumber,
  onCopyAccountNumber,
  onExecute,
}: ReceiveMoneyFormProps) {
  const [senderPhone, setSenderPhone] = useState(DEMO_CONTACTS[0].phoneNumber);
  const [amount, setAmount] = useState('500');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleReceive = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanPhone = normalizePhoneInput(senderPhone);
    if (cleanPhone === ownAccountNumber) {
      setError('يجب أن يختلف رقم المرسل عن رقم محفظتك.');
      return;
    }

    const numericAmount = Number.parseFloat(amount);
    const matchedContact = DEMO_CONTACTS.find((c) => c.phoneNumber === cleanPhone);
    const defaultNote = matchedContact
      ? `استلام تحويل من ${matchedContact.name}`
      : `استلام تحويل من ${formatPhoneNumber(cleanPhone)}`;

    const result = onExecute({
      type: 'receive',
      amount: numericAmount,
      phoneNumber: cleanPhone,
      description: description.trim() || defaultNote,
    });

    if (!result.success) {
      setError(result.error ?? 'تعذر استلام التحويل.');
      return;
    }

    setAmount('');
    setDescription('');
  };

  return (
    <section
      aria-labelledby="receive-money-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 id="receive-money-heading" className="text-base font-semibold text-slate-900">
          استلام الأموال · رمز QR
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          شارك رقم محفظتك أو امسح رمز QR لاستلام التحويلات فوراً
        </p>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-center gap-4 rounded-xl bg-slate-50 p-4">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2"
        >
          <svg viewBox="0 0 64 64" className="h-full w-full text-slate-900">
            <rect x="4" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="10" y="10" width="6" height="6" fill="currentColor" />
            <rect x="42" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="48" y="10" width="6" height="6" fill="currentColor" />
            <rect x="4" y="42" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="10" y="48" width="6" height="6" fill="currentColor" />
            <rect x="28" y="8" width="6" height="6" fill="currentColor" />
            <rect x="28" y="20" width="6" height="12" fill="currentColor" />
            <rect x="8" y="28" width="14" height="6" fill="currentColor" />
            <rect x="28" y="38" width="10" height="6" fill="currentColor" />
            <rect x="44" y="30" width="14" height="6" fill="currentColor" />
            <rect x="42" y="42" width="8" height="8" fill="#E60000" />
            <rect x="52" y="52" width="8" height="8" fill="currentColor" />
            <rect x="28" y="50" width="10" height="10" fill="currentColor" />
          </svg>
        </div>

        <div className="flex-1 text-center sm:text-right min-w-0">
          <p className="text-xs font-medium text-slate-500">رقم محفظتك</p>
          <p dir="ltr" className="mt-1 inline-block font-mono-tabular text-lg font-semibold text-slate-900">
            {formatPhoneNumber(ownAccountNumber)}
          </p>
          <div>
            <button
              type="button"
              onClick={() => onCopyAccountNumber(ownAccountNumber)}
              className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>نسخ الرقم</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleReceive} className="mt-5 space-y-4 border-t border-slate-100 pt-5" noValidate>
        <div>
          <p className="text-xs font-semibold text-slate-900">تسجيل تحويل وارد</p>
          <p className="mt-0.5 text-xs text-slate-500">
            أضف مبلغاً وارداً إلى رصيد المحفظة
          </p>
        </div>

        <div>
          <label htmlFor="receive-sender" className="block text-xs font-semibold text-slate-700">
            رقم هاتف المرسل
          </label>
          <input
            id="receive-sender"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            placeholder="010XXXXXXXX"
            value={senderPhone}
            onChange={(e) => {
              setSenderPhone(normalizePhoneInput(e.target.value));
              setError(null);
            }}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-right font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="receive-amount" className="block text-xs font-semibold text-slate-700">
            المبلغ (ج.م)
          </label>
          <input
            id="receive-amount"
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
        </div>

        <div>
          <label htmlFor="receive-note" className="block text-xs font-semibold text-slate-700">
            الوصف (اختياري)
          </label>
          <input
            id="receive-note"
            type="text"
            maxLength={120}
            placeholder="مثال: دفعة عميل، استرداد مبلغ، مصاريف مشتركة"
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
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer"
        >
          <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
          <span>تأكيد الاستلام</span>
        </button>
      </form>
    </section>
  );
}
