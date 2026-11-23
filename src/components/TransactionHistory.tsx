import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  Banknote,
  Calendar,
  ChevronLeft,
  Copy,
  PlusCircle,
  Search,
  X,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types/wallet';
import {
  formatCurrency,
  formatDateTime,
  formatPhoneNumber,
  getTransactionStatusLabel,
  getTransactionTypeLabel,
  isCreditTransaction,
} from '../utils/formatters';

export type TransactionFilterType = 'all' | TransactionType;
export type DateFilterType = 'all' | 'today' | '7days' | '30days';
export type SortOrder = 'newest' | 'oldest';

interface TransactionHistoryProps {
  transactions: Transaction[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: TransactionFilterType;
  onFilterChange: (filter: TransactionFilterType) => void;
  dateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onCopyPhone: (phoneNumber: string) => void;
  maxItems?: number;
  onViewAll?: () => void;
  title?: string;
}

const FILTER_TABS: { value: TransactionFilterType; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'send', label: 'تحويل' },
  { value: 'receive', label: 'استلام' },
  { value: 'withdraw', label: 'سحب' },
  { value: 'deposit', label: 'إيداع' },
];

const DATE_FILTERS: { value: DateFilterType; label: string }[] = [
  { value: 'all', label: 'كل التواريخ' },
  { value: 'today', label: 'اليوم' },
  { value: '7days', label: 'آخر 7 أيام' },
  { value: '30days', label: 'آخر 30 يوماً' },
];

function getTypeIcon(type: TransactionType) {
  switch (type) {
    case 'send':
      return { Icon: ArrowUpRight, bg: 'bg-rose-50 text-rose-700' };
    case 'receive':
      return { Icon: ArrowDownLeft, bg: 'bg-emerald-50 text-emerald-700' };
    case 'withdraw':
      return { Icon: Banknote, bg: 'bg-amber-50 text-amber-800' };
    case 'deposit':
      return { Icon: PlusCircle, bg: 'bg-sky-50 text-sky-700' };
  }
}

export function filterAndSortTransactions(
  transactions: Transaction[],
  searchQuery: string,
  activeFilter: TransactionFilterType,
  dateFilter: DateFilterType,
  sortOrder: SortOrder,
  referenceNow: Date = new Date()
): Transaction[] {
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const cleanSearchDigits = searchQuery.replace(/\D/g, '');

  const startOfToday = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  ).getTime();

  const filtered = transactions.filter((tx) => {
    if (activeFilter !== 'all' && tx.type !== activeFilter) {
      return false;
    }

    if (dateFilter !== 'all') {
      const txTime = new Date(tx.timestamp).getTime();
      if (Number.isNaN(txTime)) return false;

      if (dateFilter === 'today') {
        if (txTime < startOfToday) return false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = referenceNow.getTime() - 7 * 24 * 60 * 60 * 1000;
        if (txTime < sevenDaysAgo) return false;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = referenceNow.getTime() - 30 * 24 * 60 * 60 * 1000;
        if (txTime < thirtyDaysAgo) return false;
      }
    }

    if (!trimmedSearch) return true;

    const matchesRef = tx.id.toLowerCase().includes(trimmedSearch);
    const matchesPhoneDigits =
      cleanSearchDigits.length > 0 && tx.phoneNumber.includes(cleanSearchDigits);
    const matchesPhoneRaw = tx.phoneNumber.toLowerCase().includes(trimmedSearch);

    return matchesRef || matchesPhoneDigits || matchesPhoneRaw;
  });

  return [...filtered].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });
}

export function TransactionHistory({
  transactions,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  dateFilter,
  onDateFilterChange,
  sortOrder,
  onSortOrderChange,
  onSelectTransaction,
  onCopyPhone,
  maxItems,
  onViewAll,
  title = 'سجل المعاملات',
}: TransactionHistoryProps) {
  const processedTransactions = filterAndSortTransactions(
    transactions,
    searchQuery,
    activeFilter,
    dateFilter,
    sortOrder
  );

  const visibleTransactions =
    typeof maxItems === 'number'
      ? processedTransactions.slice(0, maxItems)
      : processedTransactions;

  const hasActiveFilters =
    Boolean(searchQuery) || activeFilter !== 'all' || dateFilter !== 'all';

  return (
    <section
      aria-labelledby="transaction-history-heading"
      className="rounded-2xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="transaction-history-heading" className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <div className="flex items-center gap-3">
            <span className="font-mono-tabular text-xs font-medium text-slate-500">
              {processedTransactions.length} معاملة
            </span>
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="text-xs font-semibold text-[#C80000] hover:underline cursor-pointer whitespace-nowrap"
              >
                عرض الكل
              </button>
            )}
          </div>
        </div>

        <div className="mt-3.5 relative">
          <Search
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="البحث برقم الهاتف أو الرقم المرجعي"
            placeholder="ابحث برقم الهاتف أو المرجع (مثل 0101234 أو VFC-)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C80000] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="مسح البحث"
              className="absolute left-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="تصفية المعاملات حسب النوع"
          className="mt-3 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
        >
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onFilterChange(tab.value)}
                className={`min-h-[36px] flex-1 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            {DATE_FILTERS.map((df) => {
              const active = dateFilter === df.value;
              return (
                <button
                  key={df.value}
                  type="button"
                  onClick={() => onDateFilterChange(df.value)}
                  className={`min-h-[32px] rounded-lg px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {df.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onSortOrderChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>{sortOrder === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}</span>
          </button>
        </div>
      </div>

      {visibleTransactions.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-900">لا توجد معاملات مطابقة</p>
          <p className="mt-1 text-xs text-slate-500">
            جرّب تغيير البحث أو التصفية حسب النوع أو التاريخ.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onFilterChange('all');
                onDateFilterChange('all');
              }}
              className="mt-4 inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              إعادة تعيين التصفية
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visibleTransactions.map((tx) => {
            const { Icon, bg } = getTypeIcon(tx.type);
            const isCredit = isCreditTransaction(tx.type);
            const isFailed = tx.status === 'failed';
            const { date, time } = formatDateTime(tx.timestamp);

            return (
              <li key={tx.id} className="group transition-colors hover:bg-slate-50/80">
                <div className="flex items-center gap-2.5 px-4 py-3.5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C80000] rounded-xl cursor-pointer"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg}`}
                      aria-hidden="true"
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {getTransactionTypeLabel(tx.type)}
                        </span>
                        <span
                          dir="ltr"
                          className={`font-mono-tabular text-sm font-semibold whitespace-nowrap ${
                            isFailed
                              ? 'text-slate-400 line-through'
                              : isCredit
                                ? 'text-emerald-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatCurrency(tx.amount)} ج.م
                        </span>
                      </div>

                      <p className="mt-0.5 text-xs text-slate-600 truncate">{tx.description}</p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                        <span dir="ltr" className="font-mono-tabular">{formatPhoneNumber(tx.phoneNumber)}</span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="font-mono-tabular">{tx.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{date} {time}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            tx.status === 'completed'
                              ? 'font-semibold text-emerald-700'
                              : tx.status === 'failed'
                                ? 'font-semibold text-rose-700'
                                : 'font-semibold text-amber-700'
                          }
                        >
                          {getTransactionStatusLabel(tx.status)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCopyPhone(tx.phoneNumber)}
                      aria-label={`نسخ رقم الهاتف ${formatPhoneNumber(tx.phoneNumber)}`}
                      title="نسخ رقم الهاتف"
                      className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-800 cursor-pointer"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTransaction(tx)}
                      aria-label={`عرض تفاصيل المعاملة ${tx.id}`}
                      className="flex min-h-[44px] min-w-[30px] items-center justify-center rounded-xl text-slate-400 transition-colors group-hover:text-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
