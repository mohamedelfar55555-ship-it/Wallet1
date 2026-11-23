import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Landmark,
  QrCode,
  Share2,
  Wallet,
} from 'lucide-react';
import { Transaction } from '../types/wallet';
import {
  formatTransactionSummaryForCopy,
  isCreditTransaction,
} from '../utils/formatters';
import { classifyTransactionCategory } from './WalletTransactionsPage';

interface TransactionDetailsScreenProps {
  transaction: Transaction | null;
  walletAccountNumber: string;
  onBack: () => void;
  onCopyPhone: (phoneNumber: string) => void;
  onCopyId: (id: string) => void;
  onCopyAmount: (amountText: string) => void;
  onCopyFullInfo: (summary: string) => void;
}

function formatReceiptAmount(amount: number): string {
  const fixed = Number(amount.toFixed(2));
  if (Number.isInteger(fixed)) {
    return String(fixed);
  }
  return fixed.toFixed(2);
}

function formatReceiptFee(fee: number): string {
  const fixed = Number(fee.toFixed(2));
  if (Number.isInteger(fixed)) {
    return `${fixed}.0`;
  }
  return fixed.toFixed(2);
}

function formatArabicReceiptTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  const months = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  const rawHours = date.getHours();
  const period = rawHours >= 12 ? 'م' : 'ص';
  const hour12 = String(rawHours % 12 || 12).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} - ${hour12}:${mins} ${period}`;
}

function VodafoneCashSquareBadge() {
  return (
    <div
      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center text-[#E60000]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 24" className="h-6 w-7" fill="none">
        <rect x="6" y="1.5" width="13" height="19" rx="2.2" stroke="#E60000" strokeWidth="1.6" />
        <path d="M9 8.5l7-3v5.5l-7 3V8.5Z" fill="#E60000" />
        <path d="M4.5 18.5c2.5-1.2 14.5-1.2 17 0" stroke="#E60000" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="-mt-0.5 text-[8px] font-black leading-none text-[#E60000]">كاش</span>
    </div>
  );
}

function VodafoneDualFooterEmblems() {
  return (
    <div className="flex items-center justify-center gap-3.5 py-3.5" aria-hidden="true">
      {/* Vodafone red circle */}
      <svg viewBox="0 0 36 36" className="h-7 w-7" fill="none">
        <circle cx="18" cy="18" r="16" fill="#E60000" />
        <path
          d="M18.8 9.2c-4.2.3-7.4 3.7-7.4 8 0 4.9 3.7 8.7 8.4 8.7 3.7 0 6.5-2.6 6.5-6 0-3.1-2.3-5.2-5.2-5.2-1.4 0-2.5.5-3.2 1.2.3-2.9 1.9-5 4.2-6.1-.9-.4-2-.6-3.3-.6Z"
          fill="white"
        />
      </svg>

      {/* Thin vertical divider matching IMG_5829 / IMG_5830 */}
      <span className="h-7 w-px bg-slate-300" />

      {/* Vodafone Cash emblem */}
      <div className="flex flex-col items-center text-[#E60000]">
        <svg viewBox="0 0 36 30" className="h-6 w-7" fill="none">
          <rect x="9" y="2" width="16" height="23" rx="2.5" stroke="#E60000" strokeWidth="1.8" />
          <path d="M13 10l8-3.8v6.6l-8 3.8V10Z" fill="#E60000" />
          <path d="M7 22c3-1.4 19-1.4 22 0" stroke="#E60000" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="-mt-0.5 text-[9px] font-black leading-none text-[#E60000]">كاش</span>
      </div>
    </div>
  );
}

export function TransactionDetailsScreen({
  transaction,
  walletAccountNumber,
  onBack,
  onCopyPhone,
  onCopyId,
  onCopyAmount,
  onCopyFullInfo,
}: TransactionDetailsScreenProps) {
  if (!transaction) {
    return (
      <div className="animate-view-enter flex min-h-screen flex-col items-center justify-center bg-[#F7F8FA] p-6 text-center">
        <p className="text-sm font-bold text-slate-900">لم يتم العثور على المعاملة</p>
        <p className="mt-1 text-xs text-slate-500">
          يمكنك الرجوع إلى سجل المعاملات لاختيار معاملة أخرى.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>رجوع</span>
        </button>
      </div>
    );
  }

  const isCredit = isCreditTransaction(transaction.type);
  const fee = transaction.fee ?? 0;
  const principalAmount =
    !isCredit && fee > 0 && transaction.amount > fee
      ? Number((transaction.amount - fee).toFixed(2))
      : transaction.amount;

  const receiptId =
    transaction.receiptNumber ??
    transaction.id.replace(/[^\d]/g, '').slice(0, 14).padStart(13, '0');
  const receiptDateTime = formatArabicReceiptTimestamp(transaction.timestamp);
  const { kind } = classifyTransactionCategory(transaction);

  const handleShareReceipt = async () => {
    const summary = formatTransactionSummaryForCopy(transaction);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'إيصال فودافون كاش',
          text: summary,
        });
        return;
      } catch {
        // Fallback to copy if share is cancelled or unsupported in iframe
      }
    }
    onCopyFullInfo(summary);
  };

  const renderCounterpartyBadge = () => {
    if (kind === 'bank') {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2D7E3B] text-white">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    }
    if (kind === 'wallet-pay') {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3B626] text-white">
          <QrCode className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    }
    if (kind === 'atm') {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#7D1219] text-white">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    }
    if (isCredit) {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2D7E3B] text-white">
          <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    }
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#A41421] text-white">
        <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  };

  return (
    <div className="animate-view-enter flex min-h-screen flex-col justify-between bg-[#F7F8FA]">
      <div>
        {/* Clean Off-White Header + Large Scalloped Green Seal matching IMG_5829 */}
        <div className="bg-[#F7F8FA] pb-5">
          <header className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="رجوع"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-black/5 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="text-[17px] font-extrabold text-slate-900">تم بنجاح</h1>
            <span className="w-9" aria-hidden="true" />
          </header>

          <div className="mt-2 flex flex-col items-center px-4 text-center">
            {/* Large 72px Scalloped Green Seal matching IMG_5829 */}
            <svg viewBox="0 0 72 72" className="h-[72px] w-[72px]" fill="none" aria-hidden="true">
              <path
                d="M36 4.5l5.1 4.9 7-.8 2.7 6.4 6.6 2.2-.3 7 5.2 4.7-3 6.3 3 6.3-5.2 4.7.3 7-6.6 2.2-2.7 6.4-7-.8L36 67.5l-5.1-4.9-7 .8-2.7-6.4-6.6-2.2.3-7-5.2-4.7 3-6.3-3-6.3 5.2-4.7-.3-7 6.6-2.2 2.7-6.4 7 .8L36 4.5Z"
                fill="#1E9E49"
              />
              <path
                d="M25.2 36.6l7.1 7.1L47.2 28.8"
                stroke="white"
                strokeWidth="4.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <p dir="ltr" className="mt-4 text-[13px] font-medium text-slate-700">
              Your transaction was successful
            </p>

            {/* Large Teal Amount + Dark جنيه matching IMG_5829 */}
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span
                dir="ltr"
                className="font-mono-tabular text-[40px] font-black leading-none tracking-tight text-[#006B7D]"
              >
                {formatReceiptAmount(principalAmount)}
              </span>
              <span className="text-[26px] font-extrabold leading-none text-slate-950">جنيه</span>
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-slate-400">المبلغ الإجمالي</p>
          </div>
        </div>

        {/* Receipt Cards Stack matching IMG_5829 */}
        <div className="space-y-3.5 px-4">
          {/* Card 1: من / إلى with 40px Icon on RIGHT */}
          <div className="divide-y divide-slate-100 rounded-2xl bg-white px-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            {/* Row 1: من */}
            <div className="py-4">
              {isCredit ? (
                <button
                  type="button"
                  onClick={() => onCopyPhone(transaction.phoneNumber)}
                  className="flex w-full items-center gap-3.5 text-right cursor-pointer"
                >
                  {renderCounterpartyBadge()}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-400">من</p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-right font-mono-tabular text-[15px] font-bold text-slate-900"
                    >
                      {transaction.phoneNumber}
                    </p>
                    {transaction.counterpartyName &&
                      transaction.counterpartyName !== transaction.phoneNumber && (
                        <p className="text-xs font-medium text-slate-500">
                          {transaction.counterpartyName}
                        </p>
                      )}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCopyPhone(walletAccountNumber)}
                  className="flex w-full items-center gap-3.5 text-right cursor-pointer"
                >
                  <VodafoneCashSquareBadge />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-400">من</p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-right font-mono-tabular text-[15px] font-extrabold text-slate-950"
                    >
                      {walletAccountNumber}
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Row 2: إلى */}
            <div className="py-4">
              {isCredit ? (
                <button
                  type="button"
                  onClick={() => onCopyPhone(walletAccountNumber)}
                  className="flex w-full items-center gap-3.5 text-right cursor-pointer"
                >
                  <VodafoneCashSquareBadge />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-400">إلى</p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-right font-mono-tabular text-[15px] font-extrabold text-slate-950"
                    >
                      {walletAccountNumber}
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCopyPhone(transaction.phoneNumber)}
                  className="flex w-full items-center gap-3.5 text-right cursor-pointer"
                >
                  {renderCounterpartyBadge()}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-400">إلى</p>
                    <p
                      dir="ltr"
                      className="mt-0.5 text-right font-mono-tabular text-[15px] font-bold text-slate-900"
                    >
                      {transaction.phoneNumber}
                    </p>
                    {transaction.counterpartyName && (
                      <p dir="ltr" className="text-right text-xs font-medium text-slate-500">
                        {transaction.counterpartyName}
                      </p>
                    )}
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: المبلغ الكلي المستحق & الرسوم with exact RTL wording order from IMG_5829 */}
          <div className="space-y-3.5 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-slate-800">المبلغ الكلي المستحق</span>
              <button
                type="button"
                onClick={() =>
                  onCopyAmount(`${isCredit ? '+' : '-'} ${formatReceiptAmount(transaction.amount)} جنيه`)
                }
                dir="rtl"
                className="text-[15px] font-extrabold text-slate-950 hover:text-[#E60000] cursor-pointer"
              >
                {isCredit ? '+' : '-'} جنيه{' '}
                <span className="font-mono-tabular">{formatReceiptAmount(transaction.amount)}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-slate-800">الرسوم</span>
              <span dir="rtl" className="text-[15px] font-extrabold text-slate-950">
                جنيه <span className="font-mono-tabular">{formatReceiptFee(fee)}</span>
              </span>
            </div>
          </div>

          {/* Card 3: تاريخ العملية & رقم العملية */}
          <div className="space-y-3.5 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-slate-800">تاريخ العملية</span>
              <span className="text-[14px] font-extrabold text-slate-950">{receiptDateTime}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-slate-800">رقم العملية</span>
              <button
                type="button"
                onClick={() => onCopyId(receiptId)}
                dir="ltr"
                className="font-mono-tabular text-[15px] font-extrabold text-slate-950 hover:text-[#E60000] cursor-pointer"
              >
                {receiptId}
              </button>
            </div>
          </div>

          {/* Dual Brand Emblems above Footer */}
          <VodafoneDualFooterEmblems />
        </div>
      </div>

      {/* Bottom Sticky Action Footer: شارك (red) + تم (dark outline) matching IMG_5829 */}
      <footer className="sticky bottom-0 z-30 bg-[#F7F8FA] px-4 pt-2 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleShareReceipt}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#E60000] px-4 text-[15px] font-bold text-white shadow-xs transition-colors hover:bg-[#CC0000] cursor-pointer"
          >
            <Share2 className="h-4.5 w-4.5" aria-hidden="true" />
            <span>شارك</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-white px-4 text-[15px] font-bold text-slate-950 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <span>تم</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
