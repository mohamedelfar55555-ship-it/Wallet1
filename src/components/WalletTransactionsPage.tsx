import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileDown,
  Landmark,
  QrCode,
  Search,
  SlidersHorizontal,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '../types/wallet';
import { formatCurrency, formatPhoneNumber, isCreditTransaction } from '../utils/formatters';
import { VodafoneRingLoader } from './LoadingOverlay';
import {
  DateFilterType,
  filterAndSortTransactions,
  SortOrder,
  TransactionFilterType,
} from './TransactionHistory';

export type WalletHistoryTab = 'transactions' | 'expenses';

interface WalletTransactionsPageProps {
  transactions: Transaction[];
  initialTab: WalletHistoryTab;
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
  onExportPdfStatement: (summary: string) => void;
  onBack: () => void;
  importedRecordsCount?: number;
  onOpenImportData?: () => void;
}

const FILTER_TABS: { value: TransactionFilterType; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'send', label: 'تحويل' },
  { value: 'receive', label: 'استلام' },
  { value: 'withdraw', label: 'سحب' },
  { value: 'deposit', label: 'إيداع' },
];

const DATE_FILTERS: { value: DateFilterType; label: string; rangeText: string }[] = [
  { value: 'all', label: 'كل التواريخ', rangeText: '21 أكتوبر - 21 نوفمبر' },
  { value: 'today', label: 'اليوم', rangeText: 'اليوم' },
  { value: '7days', label: 'آخر 7 أيام', rangeText: 'آخر 7 أيام' },
  { value: '30days', label: 'آخر 30 يوماً', rangeText: '21 أكتوبر - 21 نوفمبر' },
];

export type TxCategoryKind =
  | 'wallet-pay'
  | 'transfer-out'
  | 'atm'
  | 'recharge'
  | 'receive'
  | 'bank';

function formatCompactEgp(amount: number): string {
  const fixed = Number(amount.toFixed(2));
  if (Number.isInteger(fixed)) {
    return String(fixed);
  }
  return fixed.toFixed(2);
}

export function classifyTransactionCategory(tx: Transaction): {
  kind: TxCategoryKind;
  title: string;
  subtitle: string;
  secondaryPhone?: string;
} {
  const desc = tx.description || '';
  if (tx.type === 'receive') {
    const cleanSub = desc
      .replace(/^استلام من الآخرين\s*·?\s*/u, '')
      .replace(/^تحويل للآخرين\s*·?\s*/u, '')
      .replace(/^تحويل وارد من\s*/u, '')
      .trim();
    if (desc.startsWith('تحويل للآخرين') && tx.counterpartyName) {
      return {
        kind: 'receive',
        title: 'تحويل للآخرين',
        subtitle: tx.counterpartyName,
        secondaryPhone: cleanSub && cleanSub !== tx.counterpartyName ? cleanSub : undefined,
      };
    }
    return {
      kind: 'receive',
      title: 'استلام من الآخرين',
      subtitle: tx.phoneNumber,
      secondaryPhone: tx.counterpartyName && tx.counterpartyName !== tx.phoneNumber ? tx.counterpartyName : undefined,
    };
  }
  if (tx.type === 'deposit') {
    const cleanSub = desc
      .replace(/^تحويل بنكي\s*·?\s*/u, '')
      .replace(/^إيداع نقدي\s*·?\s*/u, '')
      .trim();
    return {
      kind: 'bank',
      title: 'تحويل بنكي',
      subtitle: tx.counterpartyName || cleanSub || formatPhoneNumber(tx.phoneNumber),
    };
  }
  if (tx.type === 'withdraw') {
    return {
      kind: 'atm',
      title: 'سحب نقدي من ATM',
      subtitle: formatPhoneNumber(tx.phoneNumber),
    };
  }
  // tx.type === 'send'
  if (desc.includes('شحن الرصيد') || desc.includes('شحن رصيد') || desc.includes('باقة')) {
    return {
      kind: 'recharge',
      title: 'شحن الرصيد',
      subtitle: tx.counterpartyName || formatPhoneNumber(tx.phoneNumber),
    };
  }
  if (
    desc.includes('مدفوعات المحفظة') ||
    desc.includes('فاتورة') ||
    desc.includes('سداد')
  ) {
    const cleanSub = desc.replace(/^مدفوعات المحفظة\s*·?\s*/u, '').trim();
    return {
      kind: 'wallet-pay',
      title: 'مدفوعات المحفظة',
      subtitle: tx.counterpartyName || cleanSub || formatPhoneNumber(tx.phoneNumber),
    };
  }
  const cleanSub = desc
    .replace(/^تحويل للآخرين\s*·?\s*/u, '')
    .replace(/^تحويل إلى\s*/u, '')
    .trim();
  return {
    kind: 'transfer-out',
    title: 'تحويل للآخرين',
    subtitle: tx.counterpartyName || cleanSub || formatPhoneNumber(tx.phoneNumber),
    secondaryPhone: tx.counterpartyName ? tx.phoneNumber : undefined,
  };
}

export function TxCategoryBadge({ kind }: { kind: TxCategoryKind }) {
  switch (kind) {
    case 'wallet-pay':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3B626] text-white shadow-xs">
          <QrCode className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    case 'receive':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D7E3B] text-white shadow-xs">
          <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    case 'bank':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D7E3B] text-white shadow-xs">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    case 'transfer-out':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#A41421] text-white shadow-xs">
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    case 'atm':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7D1219] text-white shadow-xs">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    case 'recharge':
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E60000] text-white shadow-xs">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
      );
  }
}

function formatArabicTxTimestamp(isoString: string): string {
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

function getDateGroupLabel(isoString: string): string {
  const txDate = new Date(isoString);
  if (Number.isNaN(txDate.getTime())) return 'معاملات سابقة';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const txTime = txDate.getTime();

  // Also treat 2026-11-20 relative to demo seed anchor as أمس if needed
  const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime();
  if (dayStart >= startOfToday) return 'اليوم';
  if (dayStart >= startOfYesterday || txTime >= startOfYesterday) return 'أمس';
  if (txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()) {
    return 'هذا الشهر';
  }
  return 'سابقاً';
}

export function WalletTransactionsPage({
  transactions,
  initialTab,
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
  onExportPdfStatement,
  onBack,
  importedRecordsCount = 0,
  onOpenImportData,
}: WalletTransactionsPageProps) {
  const [activeTab, setActiveTab] = useState<WalletHistoryTab>(initialTab);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [periodMode, setPeriodMode] = useState<'monthly' | 'weekly'>('monthly');
  const tabTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current);
    };
  }, []);

  const handleSwitchTab = (nextTab: WalletHistoryTab) => {
    if (nextTab === activeTab) return;
    if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current);
    setActiveTab(nextTab);
    setIsTabLoading(true);
    tabTimerRef.current = window.setTimeout(() => {
      setIsTabLoading(false);
    }, 450);
  };

  const processedTransactions = useMemo(
    () =>
      filterAndSortTransactions(
        transactions,
        searchQuery,
        activeFilter,
        dateFilter,
        sortOrder
      ),
    [transactions, searchQuery, activeFilter, dateFilter, sortOrder]
  );

  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    for (const tx of processedTransactions) {
      const label = getDateGroupLabel(tx.timestamp);
      const existing = groups.find((g) => g.label === label);
      if (existing) {
        existing.items.push(tx);
      } else {
        groups.push({ label, items: [tx] });
      }
    }
    return groups;
  }, [processedTransactions]);

  const analytics = useMemo(() => {
    const valid = transactions.filter((t) => t.status !== 'failed');
    let walletPaySum = 0;
    let walletPayCount = 0;
    let transferOutSum = 0;
    let transferOutCount = 0;
    let atmSum = 0;
    let atmCount = 0;
    let rechargeSum = 0;
    let rechargeCount = 0;

    let receiveSum = 0;
    let receiveCount = 0;
    let bankSum = 0;
    let bankCount = 0;

    for (const tx of valid) {
      const { kind } = classifyTransactionCategory(tx);
      if (kind === 'wallet-pay') {
        walletPaySum += tx.amount;
        walletPayCount += 1;
      } else if (kind === 'transfer-out') {
        transferOutSum += tx.amount;
        transferOutCount += 1;
      } else if (kind === 'atm') {
        atmSum += tx.amount;
        atmCount += 1;
      } else if (kind === 'recharge') {
        rechargeSum += tx.amount;
        rechargeCount += 1;
      } else if (kind === 'receive') {
        receiveSum += tx.amount;
        receiveCount += 1;
      } else if (kind === 'bank') {
        bankSum += tx.amount;
        bankCount += 1;
      }
    }

    const totalExpenses = walletPaySum + transferOutSum + atmSum + rechargeSum;
    const totalIncome = receiveSum + bankSum;

    return {
      totalExpenses,
      totalIncome,
      expenseItems: [
        {
          kind: 'wallet-pay' as const,
          label: 'مدفوعات المحفظة',
          amount: walletPaySum,
          count: walletPayCount,
          color: '#E5BC66',
        },
        {
          kind: 'transfer-out' as const,
          label: 'تحويل للآخرين',
          amount: transferOutSum,
          count: transferOutCount,
          color: '#B91C1C',
        },
        {
          kind: 'atm' as const,
          label: 'سحب نقدي من ATM',
          amount: atmSum,
          count: atmCount,
          color: '#5B0E14',
        },
        {
          kind: 'recharge' as const,
          label: 'شحن الرصيد',
          amount: rechargeSum,
          count: rechargeCount,
          color: '#E60000',
        },
      ],
      incomeItems: [
        {
          kind: 'receive' as const,
          label: 'استلام من الآخرين',
          amount: receiveSum,
          count: receiveCount,
          color: '#166534',
        },
        {
          kind: 'bank' as const,
          label: 'تحويل بنكي',
          amount: bankSum,
          count: bankCount,
          color: '#2D7E3B',
        },
      ],
    };
  }, [transactions]);

  const activeDateRangeText =
    DATE_FILTERS.find((d) => d.value === dateFilter)?.rangeText ?? '21 أكتوبر - 21 نوفمبر';

  const hasActiveFilters =
    Boolean(searchQuery) || activeFilter !== 'all' || dateFilter !== 'all';

  const handlePdfExport = () => {
    const lines = [
      'كشف حساب فودافون كاش',
      `عدد المعاملات: ${processedTransactions.length}`,
      ...processedTransactions
        .slice(0, 10)
        .map(
          (tx) =>
            `${tx.id} | ${classifyTransactionCategory(tx).title} | ${isCreditTransaction(tx.type) ? '+' : '-'}${formatCurrency(tx.amount)} ج.م | ${tx.phoneNumber}`
        ),
    ];
    onExportPdfStatement(lines.join('\n'));
  };

  // Build SVG donut segments for Expenses
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;
  const expenseSegments = analytics.expenseItems
    .filter((item) => item.amount > 0)
    .map((item) => {
      const ratio = analytics.totalExpenses > 0 ? item.amount / analytics.totalExpenses : 0;
      const length = Math.max(ratio * circumference - 3, 0);
      const offset = -accumulatedOffset;
      accumulatedOffset += ratio * circumference;
      return { ...item, dashArray: `${length} ${circumference}`, dashOffset: offset };
    });

  return (
    <div className="animate-view-enter min-h-full bg-[#F2F3F6] pb-6">
      {/* Native White Header (matching IMG_5818 / IMG_5820) */}
      <header className="sticky top-0 z-30 bg-white">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[40px] items-center gap-0.5 text-sm font-medium text-slate-800 hover:text-slate-950 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5 text-slate-900" aria-hidden="true" />
            <span>رجوع</span>
          </button>

          <h1 className="text-[17px] font-bold text-slate-900">آخر المعاملات</h1>

          <div className="flex min-w-[52px] justify-end">
            {activeTab === 'transactions' && (
              <button
                type="button"
                onClick={handlePdfExport}
                aria-label="نسخ وتصدير كشف المعاملات PDF"
                title="تصدير كشف المعاملات"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <FileDown className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* 2-Tab Navigation: معاملات | مصروفات جديد */}
        <div
          role="tablist"
          aria-label="أقسام آخر المعاملات"
          className="grid grid-cols-2 border-b border-slate-200 bg-white"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transactions'}
            onClick={() => handleSwitchTab('transactions')}
            className={`relative flex min-h-[46px] items-center justify-center text-sm transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'font-extrabold text-slate-900'
                : 'font-semibold text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>معاملات</span>
            {activeTab === 'transactions' && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#E60000]" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'expenses'}
            onClick={() => handleSwitchTab('expenses')}
            className={`relative flex min-h-[46px] items-center justify-center gap-1.5 text-sm transition-colors cursor-pointer ${
              activeTab === 'expenses'
                ? 'font-extrabold text-slate-900'
                : 'font-semibold text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>مصروفات</span>
            <span className="rounded-full bg-[#E60000] px-2 py-0.5 text-[10px] font-extrabold text-white">
              جديد
            </span>
            {activeTab === 'expenses' && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#E60000]" />
            )}
          </button>
        </div>
      </header>

      {/* Inline Vodafone Ring Loader over dimmed content matching IMG_5827 / IMG_5828 */}
      {isTabLoading && (
        <div className="relative min-h-[420px]">
          <div className="px-4 pt-3 opacity-60 pointer-events-none">
            <p className="mb-1.5 text-right text-xs font-medium text-slate-500">فلتر معاملاتك</p>
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
              <span className="inline-flex min-h-[34px] items-center rounded-full bg-[#E7EDF0] px-3.5 text-xs font-bold text-[#007385]">
                {activeDateRangeText}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>

          <div
            role="status"
            aria-label="جاري التحميل"
            className="absolute inset-0 flex items-center justify-center bg-[#C2C2C4]/85"
          >
            <VodafoneRingLoader sizeClass="h-[88px] w-[88px]" />
          </div>
        </div>
      )}

      {/* TAB 1: معاملات (matching IMG_5820) */}
      {!isTabLoading && activeTab === 'transactions' && (
        <div className="px-4 pt-3 space-y-3">
          {onOpenImportData && (
            <button
              type="button"
              onClick={onOpenImportData}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-right text-xs transition-colors hover:bg-amber-100/70 cursor-pointer"
            >
              <span className="font-bold text-amber-950">
                السجلات التجريبية المستوردة (غير موثقة): {importedRecordsCount}
              </span>
              <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#E60000] shadow-xs">
                إدارة / استيراد
              </span>
            </button>
          )}
          <div>
            <p className="mb-1.5 text-right text-xs font-medium text-slate-500">فلتر معاملاتك</p>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs">
              <button
                type="button"
                onClick={() => setFiltersExpanded((prev) => !prev)}
                className="inline-flex min-h-[34px] items-center rounded-full bg-[#E7EDF0] px-3.5 text-xs font-bold text-[#007385] transition-colors hover:bg-[#dce5e9] cursor-pointer"
              >
                {activeDateRangeText}
              </button>

              <button
                type="button"
                onClick={() => setFiltersExpanded((prev) => !prev)}
                aria-expanded={filtersExpanded}
                aria-label="خيارات البحث والتصفية"
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  filtersExpanded || hasActiveFilters
                    ? 'border-[#E60000] bg-rose-50 text-[#E60000]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {filtersExpanded && (
              <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    aria-label="البحث برقم الهاتف أو الرقم المرجعي"
                    placeholder="ابحث برقم الهاتف أو المرجع (VFC-)..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#E60000] focus:bg-white focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      aria-label="مسح البحث"
                      className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                  {FILTER_TABS.map((tab) => {
                    const isSelected = activeFilter === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => onFilterChange(tab.value)}
                        className={`min-h-[32px] flex-1 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
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

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DATE_FILTERS.map((df) => (
                      <button
                        key={df.value}
                        type="button"
                        onClick={() => onDateFilterChange(df.value)}
                        className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer ${
                          dateFilter === df.value
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {df.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSortOrderChange(sortOrder === 'newest' ? 'oldest' : 'newest')
                    }
                    className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    <span>{sortOrder === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}</span>
                  </button>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      onFilterChange('all');
                      onDateFilterChange('all');
                    }}
                    className="w-full min-h-[34px] rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    إعادة تعيين التصفية
                  </button>
                )}
              </div>
            )}
          </div>

          {groupedTransactions.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-xs">
              <p className="text-sm font-bold text-slate-900">لا توجد معاملات مطابقة</p>
              <p className="mt-1 text-xs text-slate-500">
                جرّب تغيير كلمة البحث أو التصفية حسب النوع أو التاريخ.
              </p>
            </div>
          ) : (
            groupedTransactions.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="my-2.5 text-center text-xs font-semibold text-slate-500">
                  {group.label}
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-xs">
                  {group.items.map((tx) => {
                    const { kind, title, subtitle, secondaryPhone } = classifyTransactionCategory(tx);
                    const isCredit = isCreditTransaction(tx.type);
                    const formattedTime = formatArabicTxTimestamp(tx.timestamp);

                    return (
                      <li key={tx.id} className="transition-colors hover:bg-slate-50/80">
                        <div className="flex items-center gap-3 px-3.5 py-3.5">
                          <button
                            type="button"
                            onClick={() => onSelectTransaction(tx)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-right cursor-pointer"
                          >
                            <TxCategoryBadge kind={kind} />

                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-extrabold text-slate-900 truncate">
                                {title}
                              </p>
                              <p
                                dir="ltr"
                                className="mt-0.5 text-right text-xs font-semibold text-slate-800 truncate"
                              >
                                {subtitle}
                              </p>
                              {secondaryPhone && (
                                <p
                                  dir="ltr"
                                  className="text-right text-[11px] font-medium text-slate-600 truncate"
                                >
                                  {secondaryPhone}
                                </p>
                              )}
                              <p className="mt-0.5 text-[11px] text-slate-500">{formattedTime}</p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onCopyPhone(tx.phoneNumber)}
                              aria-label={`نسخ رقم ${tx.phoneNumber}`}
                              title="نسخ الرقم"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectTransaction(tx)}
                              className="flex items-center gap-1 cursor-pointer"
                            >
                              <span
                                dir="ltr"
                                className={`font-mono-tabular text-[13px] font-extrabold whitespace-nowrap ${
                                  tx.status === 'failed'
                                    ? 'text-slate-400 line-through'
                                    : isCredit
                                      ? 'text-[#2D7E3B]'
                                      : 'text-[#E60000]'
                                }`}
                              >
                                {isCredit ? '+' : '-'} جنيه {formatCompactEgp(tx.amount)}
                              </span>
                              <ChevronLeft className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {/* TAB 2: مصروفات (matching IMG_5818 + IMG_5819) */}
      {!isTabLoading && activeTab === 'expenses' && (
        <div className="px-4 pt-4 space-y-5">
          {/* Period Switcher Pills */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPeriodMode('monthly')}
              className={`min-h-[34px] rounded-full px-4 text-xs font-bold transition-colors cursor-pointer ${
                periodMode === 'monthly'
                  ? 'bg-[#006677] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              شهري
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('weekly')}
              className={`min-h-[34px] rounded-full px-4 text-xs font-bold transition-colors cursor-pointer ${
                periodMode === 'weekly'
                  ? 'bg-[#006677] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              أسبوعي
            </button>
          </div>

          {/* Area Chart Card (matching IMG_5818) */}
          <section className="rounded-2xl bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="w-6" aria-hidden="true" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">
                  {periodMode === 'monthly' ? 'نوفمبر' : 'هذا الأسبوع'}
                </p>
                <p className="mt-0.5 text-xl font-extrabold text-slate-900">
                  <span dir="ltr" className="font-mono-tabular">
                    {formatCurrency(analytics.totalExpenses)}
                  </span>{' '}
                  جنيه
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPeriodMode((prev) => (prev === 'monthly' ? 'weekly' : 'monthly'))
                }
                aria-label="تبديل الفترة"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Teal Area Chart SVG */}
            <div className="relative mt-4">
              <div className="mb-1 flex justify-end pl-4">
                <span className="rounded-full bg-[#006677] px-3 py-1 text-[11px] font-bold text-white shadow-xs">
                  يوم 21 -{' '}
                  <span dir="ltr" className="font-mono-tabular">
                    {formatCurrency(analytics.totalExpenses)}
                  </span>{' '}
                  جنيه
                </span>
              </div>

              <svg viewBox="0 0 320 140" className="h-36 w-full" aria-hidden="true">
                <defs>
                  <linearGradient id="vfcExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006677" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#006677" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {[20, 45, 70, 95, 120].map((y) => (
                  <line
                    key={y}
                    x1="10"
                    y1={y}
                    x2="275"
                    y2={y}
                    stroke="#CBD5E1"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                ))}

                {/* Y-axis ticks on left */}
                <text x="282" y="24" fontSize="9" fill="#64748B">
                  12,000
                </text>
                <text x="282" y="49" fontSize="9" fill="#64748B">
                  9,000
                </text>
                <text x="282" y="74" fontSize="9" fill="#64748B">
                  6,000
                </text>
                <text x="282" y="99" fontSize="9" fill="#64748B">
                  3,000
                </text>
                <text x="282" y="123" fontSize="9" fill="#64748B">
                  0
                </text>

                {/* Area fill */}
                <path
                  d="M270 105 L245 105 L220 96 L195 96 L170 92 L135 92 L118 46 L96 46 L82 40 L82 120 L270 120 Z"
                  fill="url(#vfcExpenseGrad)"
                />
                {/* Top stroke line */}
                <path
                  d="M270 105 L245 105 L220 96 L195 96 L170 92 L135 92 L118 46 L96 46 L82 40"
                  fill="none"
                  stroke="#006677"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />

                {/* Vertical marker & point */}
                <line
                  x1="65"
                  y1="4"
                  x2="65"
                  y2="46"
                  stroke="#006677"
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />
                <circle cx="65" cy="46" r="3.5" fill="#006677" />

                {/* X-axis day numbers */}
                <text x="242" y="135" fontSize="9" fill="#475569">
                  5
                </text>
                <text x="200" y="135" fontSize="9" fill="#475569">
                  10
                </text>
                <text x="155" y="135" fontSize="9" fill="#475569">
                  15
                </text>
                <text x="110" y="135" fontSize="9" fill="#475569">
                  20
                </text>
                <text x="65" y="135" fontSize="9" fill="#475569">
                  25
                </text>
                <text x="22" y="135" fontSize="9" fill="#475569">
                  30
                </text>
              </svg>
            </div>
          </section>

          {/* المصاريف Donut & Breakdown (matching IMG_5818 bottom + IMG_5819 top) */}
          <section aria-label="تفاصيل المصاريف" className="space-y-3">
            <h2 className="text-right text-xl font-extrabold text-slate-900">المصاريف</h2>

            <div className="flex justify-center py-2">
              <div className="relative flex h-44 w-44 items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="9"
                  />
                  {expenseSegments.map((seg) => (
                    <circle
                      key={seg.kind}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span dir="ltr" className="font-mono-tabular text-xl font-extrabold text-slate-900">
                    {formatCurrency(analytics.totalExpenses)}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">جنيه</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {analytics.expenseItems.map((item) => (
                <div
                  key={item.kind}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <TxCategoryBadge kind={item.kind} />
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.count} معاملة</p>
                    </div>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">
                    <span dir="ltr" className="font-mono-tabular">
                      {formatCurrency(item.amount)}
                    </span>{' '}
                    جنيه
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* الدخل Donut & Breakdown (matching IMG_5819 bottom) */}
          <section aria-label="تفاصيل الدخل" className="space-y-3 pt-2">
            <h2 className="text-right text-xl font-extrabold text-slate-900">الدخل</h2>

            <div className="flex justify-center py-2">
              <div className="relative flex h-44 w-44 items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="9"
                  />
                  {analytics.totalIncome > 0 && (
                    <circle
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke="#166534"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${circumference - 6} ${circumference}`}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span dir="ltr" className="font-mono-tabular text-xl font-extrabold text-slate-900">
                    {formatCurrency(analytics.totalIncome)}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">جنيه</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {analytics.incomeItems.map((item) => (
                <div
                  key={item.kind}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <TxCategoryBadge kind={item.kind} />
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.count} معاملة</p>
                    </div>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">
                    <span dir="ltr" className="font-mono-tabular">
                      {formatCurrency(item.amount)}
                    </span>{' '}
                    جنيه
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
