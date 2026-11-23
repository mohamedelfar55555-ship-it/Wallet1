import { CheckCircle2, Clock, Copy, FileText, Phone, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Transaction } from '../types/wallet';
import {
  formatCurrency,
  formatDateTime,
  formatPhoneNumber,
  formatTransactionSummaryForCopy,
  getTransactionStatusLabel,
  getTransactionTypeLabel,
  isCreditTransaction,
} from '../utils/formatters';

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onCopyPhone: (phoneNumber: string) => void;
  onCopyId: (id: string) => void;
  onCopyFullInfo: (summary: string) => void;
}

export function TransactionDetailsModal({
  transaction,
  onClose,
  onCopyPhone,
  onCopyId,
  onCopyFullInfo,
}: TransactionDetailsModalProps) {
  useEffect(() => {
    if (!transaction) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transaction, onClose]);

  if (!transaction) return null;

  const isCredit = isCreditTransaction(transaction.type);
  const { full } = formatDateTime(transaction.timestamp);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-details-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />

        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-medium text-slate-500">إيصال معاملة فودافون كاش</p>
            <h2 id="tx-details-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              {getTransactionTypeLabel(transaction.type)}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل المعاملة"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-5 text-center border-b border-slate-100">
          <p className="text-xs font-medium text-slate-500">المبلغ</p>
          <p
            dir="ltr"
            className={`mt-1 inline-block font-mono-tabular text-3xl font-bold tracking-tight ${
              transaction.status === 'failed'
                ? 'text-slate-400 line-through'
                : isCredit
                  ? 'text-emerald-700'
                  : 'text-slate-900'
            }`}
          >
            {isCredit ? '+' : '-'}
            {formatCurrency(transaction.amount)} EGP
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold">
            {transaction.status === 'completed' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700">{getTransactionStatusLabel(transaction.status)}</span>
              </>
            )}
            {transaction.status === 'pending' && (
              <>
                <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span className="text-amber-700">{getTransactionStatusLabel(transaction.status)}</span>
              </>
            )}
            {transaction.status === 'failed' && (
              <>
                <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                <span className="text-rose-700">{getTransactionStatusLabel(transaction.status)}</span>
              </>
            )}
          </div>
        </div>

        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-xs font-medium text-slate-500">رقم المعاملة</dt>
            <dd className="flex items-center gap-1.5 font-mono-tabular text-xs font-semibold text-slate-900">
              <span dir="ltr">{transaction.id}</span>
              <button
                type="button"
                onClick={() => onCopyId(transaction.id)}
                aria-label="نسخ رقم المعاملة"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-xs font-medium text-slate-500">رقم الهاتف</dt>
            <dd className="flex items-center gap-1.5 font-mono-tabular text-xs font-semibold text-slate-900">
              <span dir="ltr">{formatPhoneNumber(transaction.phoneNumber)}</span>
              <button
                type="button"
                onClick={() => onCopyPhone(transaction.phoneNumber)}
                aria-label="نسخ رقم الهاتف"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-xs font-medium text-slate-500">التاريخ والوقت</dt>
            <dd className="text-xs font-medium text-slate-900">{full}</dd>
          </div>

          <div className="py-3">
            <dt className="text-xs font-medium text-slate-500">الوصف</dt>
            <dd className="mt-1 text-xs leading-relaxed text-slate-800">{transaction.description}</dd>
          </div>
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onCopyPhone(transaction.phoneNumber)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ الهاتف</span>
          </button>

          <button
            type="button"
            onClick={() => onCopyId(transaction.id)}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>نسخ رقم المعاملة</span>
          </button>

          <button
            type="button"
            onClick={() => onCopyFullInfo(formatTransactionSummaryForCopy(transaction))}
            className="col-span-2 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 cursor-pointer"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>نسخ تفاصيل المعاملة كاملة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
