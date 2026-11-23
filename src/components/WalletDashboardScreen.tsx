import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  ChevronLeft,
  Eye,
  EyeOff,
  Gift,
  HelpCircle,
  Landmark,
  Lock,
  Plus,
  QrCode,
  Send,
  Smartphone,
  Store,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { OperationMode, OperationPayload, OperationResult, Transaction, WalletState } from '../types/wallet';
import { formatCurrency, formatPhoneNumber, isCreditTransaction } from '../utils/formatters';
import { VodafoneRingLoader } from './LoadingOverlay';
import { BalanceInquiryPanel } from './operations/BalanceInquiryPanel';
import { DepositCashForm } from './operations/DepositCashForm';
import { ReceiveMoneyForm } from './operations/ReceiveMoneyForm';
import { SendMoneyForm } from './operations/SendMoneyForm';
import { WithdrawCashForm } from './operations/WithdrawCashForm';
import { WalletPinSheet } from './WalletPinSheet';
import { classifyTransactionCategory, TxCategoryBadge } from './WalletTransactionsPage';

interface WalletDashboardScreenProps {
  walletState: WalletState;
  activeSheet: OperationMode | null;
  onOpenSheet: (mode: OperationMode | null) => void;
  onBack: () => void;
  onOpenNotifications: () => void;
  onOpenOffers: () => void;
  onRunLoading: (action: () => void, durationMs?: number) => void;
  onExecuteOperation: (payload: OperationPayload) => OperationResult;
  onSelectTransaction: (tx: Transaction) => void;
  onViewFullHistory: () => void;
  onOpenExpenses: () => void;
  onCopyAccountNumber: (accountNumber: string) => void;
  onCopyCode: (code: string) => void;
  onCopySummary: (summary: string) => void;
  onOpenBillPay: () => void;
  onShowNotice: (msg: string) => void;
  importedCount?: number;
  onOpenImportData?: () => void;
  playOpenEffect?: boolean;
  onOpenEffectFinished?: () => void;
}

type CashUtilityId = 'elec-card' | 'elec' | 'gas' | 'water' | 'donate';

const CASH_UTILITIES: { id: CashUtilityId; label: string; gradient: string }[] = [
  { id: 'elec-card', label: 'كارت الكهرباء', gradient: 'from-[#3090E2] to-[#0B5BB0]' },
  { id: 'elec', label: 'كهرباء', gradient: 'from-[#3090E2] to-[#0B5BB0]' },
  { id: 'gas', label: 'غاز', gradient: 'from-[#3090E2] to-[#0B5BB0]' },
  { id: 'water', label: 'مياه', gradient: 'from-[#3090E2] to-[#0B5BB0]' },
  { id: 'donate', label: 'تبرعات', gradient: 'from-[#228D9A] to-[#115D6A]' },
];

function CashUtilityIcon({ id }: { id: CashUtilityId }) {
  switch (id) {
    case 'elec-card':
      return (
        <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" aria-hidden="true">
          {/* White Sahl callout bubble upper-right */}
          <path
            d="M21 8.5h17.5a2.5 2.5 0 0 1 2.5 2.5v6.5a2.5 2.5 0 0 1-2.5 2.5H27.2l-3.7 3.2.6-3.2H21a2.5 2.5 0 0 1-2.5-2.5V11a2.5 2.5 0 0 1 2.5-2.5Z"
            fill="white"
          />
          {/* Blue lightning bolt inside pill */}
          <path
            d="M24.2 11.2 21.8 14.7h2.1l-.8 2.8 2.9-3.6h-2l.2-2.7Z"
            fill="#176EC5"
          />
          <text x="27.2" y="16.2" fill="#176EC5" fontSize="6.4" fontWeight="800" fontFamily="sans-serif">
            Sahl
          </text>
          {/* Plug + wavy cord lower-left */}
          <path d="M11.5 18.5v4M17.5 18.5v4" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
          <path
            d="M8.5 22.8h12v3.6a6 6 0 0 1-12 0v-3.6Z"
            stroke="white"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="14.5" cy="27.4" r="1.2" fill="white" />
          <path
            d="M14.5 32.5v2.2c0 2.1 2.4 3 4.3 1.4l2.4-2c1.9-1.6 4.4-.6 4.4 1.6V40"
            stroke="white"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'elec':
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
          <path d="M19.5 7.5v5.5M28.5 7.5v5.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M15.5 13.5h17v6.8c0 4.5-3.7 8.2-8.2 8.2h-.6c-4.5 0-8.2-3.7-8.2-8.2v-6.8Z"
            fill="white"
          />
          {/* Cutout lightning bolt inside plug */}
          <path
            d="M24.8 16.2 21.5 21h2.7l-1.1 4.4 3.9-5h-2.6l.4-4.2Z"
            fill="#186DC3"
          />
          <path
            d="M24 28.5v3.2c0 2.2-4 2.4-4 5.2V41"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'gas':
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
          <path
            d="M25.8 9c.5 5.4-4.2 7.5-4.4 11.6-.1 1.8.8 3.2 2.2 3.8-1-2.5.4-4.8 2.8-6.4 4.2 2.9 6.6 6.8 6.6 11.4 0 5.6-4.2 9.8-9.5 9.8-5.7 0-10-4.4-10-10.3 0-5.7 3.7-11.2 12.3-19.9Z"
            stroke="white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M23.6 26.2c2.2 1.8 3.6 4 3.6 6.4 0 2.3-1.7 4-3.8 4s-3.8-1.7-3.8-4c0-2.1 1.4-4.2 4-6.4Z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
          {/* Valve handle */}
          <path d="M16.5 11.5h11M22 11.5v5" stroke="white" strokeWidth="2.3" strokeLinecap="round" />
          {/* Pipe & spout */}
          <path
            d="M10.5 17.5v9M10.5 20h6.2c1.3-2.1 3.3-3.5 5.3-3.5s4 1.4 5.3 3.5H29c4.5 0 7.5 3.1 7.5 7.4v1.6h-4.6v-1.4c0-2.1-1.2-3.4-3.2-3.4H10.5"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Water droplet */}
          <path
            d="M34.2 32.5c2 2.4 3.1 4.2 3.1 5.7a3.1 3.1 0 1 1-6.2 0c0-1.5 1.1-3.3 3.1-5.7Z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'donate':
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
          {/* Heart above box */}
          <path
            d="M24 23.2s-6.2-3.8-6.2-8c0-2.1 1.6-3.7 3.6-3.7 1.2 0 2.2.6 2.6 1.5.4-.9 1.4-1.5 2.6-1.5 2 0 3.6 1.6 3.6 3.7 0 4.2-6.2 8-6.2 8Z"
            stroke="white"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {/* Angled donation box */}
          <path
            d="M11 26.5h17.5l8 7.5v7.5H11V26.5Z"
            stroke="white"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path d="M19 30.5h7.5" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
  }
}

function formatShortArabicDateTime(isoString: string): string {
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

export function WalletDashboardScreen({
  walletState,
  activeSheet,
  onOpenSheet,
  onBack,
  onOpenNotifications,
  onOpenOffers,
  onRunLoading,
  onExecuteOperation,
  onSelectTransaction,
  onViewFullHistory,
  onOpenExpenses,
  onCopyAccountNumber,
  onCopyCode,
  onCopySummary,
  onOpenBillPay,
  onShowNotice,
  importedCount = 0,
  onOpenImportData,
  playOpenEffect = false,
  onOpenEffectFinished,
}: WalletDashboardScreenProps) {
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [offerSlide, setOfferSlide] = useState(0);

  // 2-stage Wallet Opening Transition Effect matching user video (00:01 arc -> 00:02 teardrop -> 00:03 reveal)
  type OpenEffectPhase = 'arc' | 'teardrop' | 'revealing' | 'done';
  const [shouldPlayOnMount] = useState<boolean>(() => Boolean(playOpenEffect && !activeSheet));
  const [openPhase, setOpenPhase] = useState<OpenEffectPhase>(() =>
    shouldPlayOnMount ? 'arc' : 'done'
  );
  const [billPillVisible, setBillPillVisible] = useState<boolean>(() => shouldPlayOnMount);

  useEffect(() => {
    if (!shouldPlayOnMount) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setOpenPhase('done');
      setBillPillVisible(true);
      onOpenEffectFinished?.();
      const quickHide = window.setTimeout(() => setBillPillVisible(false), 1800);
      return () => window.clearTimeout(quickHide);
    }

    const t1 = window.setTimeout(() => {
      setOpenPhase('teardrop');
    }, 820);

    const t2 = window.setTimeout(() => {
      setOpenPhase('revealing');
    }, 1880);

    const t3 = window.setTimeout(() => {
      setOpenPhase('done');
      onOpenEffectFinished?.();
    }, 2200);

    const t4 = window.setTimeout(() => {
      setBillPillVisible(false);
    }, 4800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
    // Run once per Wallet mount when opened via Wallet card/entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalExpenses = useMemo(() => {
    return walletState.transactions
      .filter((tx) => tx.status !== 'failed' && !isCreditTransaction(tx.type))
      .reduce((acc, tx) => acc + tx.amount, 0);
  }, [walletState.transactions]);

  const recentThree = useMemo(
    () => walletState.transactions.slice(0, 3),
    [walletState.transactions]
  );

  const isOverlayShowing = openPhase !== 'done';

  return (
    <div className={`relative min-h-full ${shouldPlayOnMount ? 'animate-wallet-push' : 'animate-view-enter'}`}>
      {/* Wallet Opening Grey Loading Veil matching video frames 00:01 -> 00:03 */}
      {isOverlayShowing && (
        <div
          role="status"
          aria-live="polite"
          aria-label="جاري تحميل محفظة فودافون كاش"
          className={`fixed top-0 bottom-[64px] left-1/2 z-30 flex w-full max-w-[440px] -translate-x-1/2 flex-col bg-[#666668] text-white transition-opacity duration-300 ${
            openPhase === 'revealing' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Top Bar on grey backdrop matching 00:01 & 00:02 */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                aria-label="رجوع"
                className="flex h-10 w-10 -mr-1 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 cursor-pointer"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="text-lg font-bold text-white">فودافون كاش</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="الإشعارات"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
              >
                <Bell className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onOpenOffers}
                aria-label="العروض"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
              >
                <Gift className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Center 2-Stage Loader: Half-Arc (00:01) -> Teardrop Outline (00:02) */}
          <div className="flex flex-1 flex-col items-center justify-center pb-14">
            {openPhase === 'arc' ? (
              <div className="flex h-[74px] w-[74px] items-center justify-center">
                <svg
                  viewBox="0 0 48 48"
                  className="h-12 w-12 animate-spin"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 25a16 16 0 0 0 32 0"
                    stroke="#FFFFFF"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ) : (
              <div className="animate-vf-pop flex h-[74px] w-[74px] items-center justify-center">
                <VodafoneRingLoader sizeClass="h-[74px] w-[74px]" />
              </div>
            )}
            <p className="mt-3 text-[13px] font-semibold tracking-wide text-white/95">
              جاري التحميل
            </p>
          </div>
        </div>
      )}

      {/* Floating Due-Bills Status Pill matching 00:01 (الفواتير المستحقة) -> 00:02/00:03 (لا يوجد فواتير مستحقة) */}
      {billPillVisible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[78px] left-1/2 z-40 w-[calc(100%-2rem)] max-w-[408px] -translate-x-1/2"
        >
          <div
            className={`flex h-[54px] items-center justify-between gap-3 rounded-full px-3 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all duration-300 ${
              openPhase === 'arc'
                ? 'border border-white/10 bg-[#4E4E50]/90 text-white'
                : openPhase === 'teardrop'
                  ? 'border border-white/25 bg-[#B8B8BA]/95 text-slate-900'
                  : 'border border-slate-200/90 bg-white/95 text-slate-900'
            }`}
          >
            {/* Right side (RTL start): Red spinning ring in Stage 1, spacer in Stage 2+ */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
              {openPhase === 'arc' && (
                <span
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-[#E60000]/25 border-t-[#E60000]"
                />
              )}
            </div>

            <span className="flex-1 text-center text-[13px] font-bold">
              {openPhase === 'arc' ? 'الفواتير المستحقة' : 'لا يوجد فواتير مستحقة'}
            </span>

            <button
              type="button"
              onClick={() => setBillPillVisible(false)}
              aria-label="إغلاق"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${
                openPhase === 'arc'
                  ? 'bg-black/25 text-white/85 hover:bg-black/40'
                  : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Dark-Crimson Hero Header (matching IMG_5816) */}
      <section
        aria-label="محفظة فودافون كاش"
        className="bg-gradient-to-b from-[#690505] via-[#480303] to-[#230101] px-4 pt-3 pb-10 text-white"
      >
        {/* Top Row: Back arrow + Title on right, Bell & Gift on left */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="رجوع"
              className="flex h-10 w-10 -mr-1 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="text-lg font-bold text-white">فودافون كاش</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label="الإشعارات"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              <Bell className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenOffers}
              aria-label="العروض"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              <Gift className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Greeting, Registered Phone & Active Status Pill */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-white truncate">
              أهلاً، {walletState.account.holderName}
            </p>
            <p dir="ltr" className="text-right font-mono-tabular text-[11px] font-medium text-white/75">
              {formatPhoneNumber(walletState.account.accountNumber)}
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
            <span>المحفظة مفعل</span>
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-[#22C55E] ring-2 ring-white"
            />
          </div>
        </div>

        {/* Dark Glass Balance Box matching 00:00 (hidden) & 00:09 (revealed EGP balance) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/25 backdrop-blur-xs">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 py-3">
            {/* Right side (RTL start): QR icon | Eye icon */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenSheet('receive')}
                aria-label="رمز QR واستلام الأموال"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/95 hover:bg-white/10 cursor-pointer"
              >
                <QrCode className="h-5 w-5" />
              </button>

              <span className="h-6 w-px bg-white/25" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  if (balanceVisible) {
                    setBalanceVisible(false);
                  } else {
                    setPinSheetOpen(true);
                  }
                }}
                aria-label={balanceVisible ? 'إخفاء الرصيد' : 'إظهار الرصيد'}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/95 hover:bg-white/10 cursor-pointer"
              >
                {balanceVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Left side (RTL end): Revealed EGP Balance after 6-digit PIN */}
            <div className="min-w-0 text-left">
              {balanceVisible && (
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => onCopyAccountNumber(walletState.account.accountNumber)}
                  title="نسخ رقم المحفظة"
                  className="inline-flex items-baseline gap-1.5 text-white cursor-pointer"
                >
                  <span className="text-xs font-bold tracking-wide text-white/90">EGP</span>
                  <span className="font-mono-tabular text-[28px] font-black leading-none text-white">
                    {formatCurrency(walletState.account.balance)}
                  </span>
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenExpenses}
            className="w-full border-t border-white/15 py-2.5 text-center text-xs font-semibold text-white/95 transition-colors hover:bg-white/10 cursor-pointer"
          >
            عرض مصروفاتك
          </button>
        </div>

        {/* 4 Circular White Action Buttons */}
        <div className="mt-6 grid grid-cols-4 gap-2 text-center">
          <button
            type="button"
            onClick={() => onOpenSheet('send')}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <span className="flex h-13 w-13 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
              <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold leading-tight text-white">
              تحويل
              <br />
              الأموال
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSheet('deposit')}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <span className="flex h-13 w-13 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold leading-tight text-white">
              إيداع
              <br />
              الأموال
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSheet('withdraw')}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <span className="flex h-13 w-13 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold leading-tight text-white">
              عمليات
              <br />
              ATM
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenBillPay}
            className="flex flex-col items-center gap-2 cursor-pointer group"
          >
            <span className="flex h-13 w-13 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
              <span className="text-xs font-black tracking-tight text-slate-900">RED</span>
            </span>
            <span className="text-xs font-semibold leading-tight text-white">
              فواتير
              <br />
              الموبايل
            </span>
          </button>
        </div>
      </section>

      {/* Curved Light Body Sheet (matching IMG_5816 + IMG_5817) */}
      <div className="-mt-5 rounded-t-[28px] bg-[#F4F5F7] px-4 pt-5 pb-6 space-y-4">
        {/* Card 1: خدمات كاش */}
        <section aria-label="خدمات كاش" className="rounded-2xl bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">خدمات كاش</h2>
            <button
              type="button"
              onClick={onViewFullHistory}
              className="rounded-full bg-[#F1F2F4] px-3.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              عرض الكل
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            {CASH_UTILITIES.map((util) => (
              <button
                key={util.id}
                type="button"
                onClick={() => onShowNotice('لا يوجد فواتير مستحقة')}
                className="flex shrink-0 flex-col items-center gap-2 cursor-pointer group"
              >
                <span
                  className={`relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-white shadow-[0_2px_8px_rgba(14,92,179,0.22)] transition-transform group-hover:scale-105 ${util.gradient}`}
                >
                  <CashUtilityIcon id={util.id} />
                </span>
                <span className="text-xs font-medium text-slate-900 whitespace-nowrap">
                  {util.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Smart Data Import Center Card (Part 2 & 4 Integration) */}
        {onOpenImportData && (
          <section aria-label="استيراد بيانات المحفظة" className="rounded-2xl border border-rose-100 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#E60000]">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-extrabold text-slate-900">IMPORT WALLET DATA</h2>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                      غير موثق · {importedCount}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                    استيراد من الحافظة أو مشاركة أو OCR أو CSV / JSON / Excel
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenImportData}
                className="min-h-[36px] shrink-0 rounded-xl bg-[#E60000] px-3 text-xs font-bold text-white hover:bg-[#C80000] cursor-pointer"
              >
                فتح الاستيراد
              </button>
            </div>
          </section>
        )}

        {/* Card 2: العروض */}
        <section aria-label="العروض" className="rounded-2xl bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">العروض</h2>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((dot) => (
                <button
                  key={dot}
                  type="button"
                  aria-label={`عرض ${dot + 1}`}
                  onClick={() => setOfferSlide(dot)}
                  className={`h-1.5 w-1.5 rounded-full cursor-pointer ${
                    offerSlide === dot ? 'bg-[#E60000]' : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onShowNotice('احصل على كاش باك لحد 100 جنيه عند دفع أقساطك بفودافون كاش')}
            className="mt-3 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-l from-[#B50707] to-[#7D0202] p-4 text-right text-white cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold">كاش باك</span>
                <span className="rounded bg-[#F5EFE2] px-2 py-0.5 text-xs font-extrabold text-[#B50707]">
                  لحد 100 جنيه
                </span>
              </div>
              <p className="mt-1.5 text-xs font-extrabold text-white">لما تدفع أقساطك</p>
              <span className="mt-1.5 inline-block rounded bg-slate-950 px-2.5 py-0.5 text-xs font-extrabold text-white">
                بفودافون كاش
              </span>
            </div>

            <div
              aria-hidden="true"
              className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-slate-900 bg-white text-slate-900 shadow-xs"
            >
              <Smartphone className="h-6 w-6 text-[#B50707]" />
              <span className="mt-1 text-[9px] font-bold text-slate-700">أقساط</span>
            </div>
          </button>
        </section>

        {/* Card 3: 2-Column Mini Widgets (مصروفاتك + تحويل اموال matching IMG_5817) */}
        <section aria-label="ملخص المصروفات والتحويل" className="grid grid-cols-2 gap-3">
          {/* مصروفاتك Mini Card */}
          <button
            type="button"
            onClick={onOpenExpenses}
            className="relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-2xl bg-white p-3.5 text-right shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
          >
            <svg
              viewBox="0 0 160 110"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
            >
              <defs>
                <linearGradient id="miniExpenseWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007385" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#007385" stopOpacity="0.06" />
                </linearGradient>
              </defs>
              <path
                d="M0 95 Q 35 88, 60 66 T 115 48 T 160 12 L 160 110 L 0 110 Z"
                fill="url(#miniExpenseWave)"
              />
            </svg>

            <span className="relative z-10 text-sm font-extrabold text-slate-900">مصروفاتك</span>

            <div className="relative z-10 mt-auto pt-8 text-left">
              <span className="text-xs font-semibold text-slate-800">جنيه </span>
              <span dir="ltr" className="font-mono-tabular text-lg font-extrabold text-slate-900">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </button>

          {/* تحويل اموال Mini Card */}
          <button
            type="button"
            onClick={() => onOpenSheet('send')}
            className="flex min-h-[152px] flex-col items-center justify-between rounded-2xl bg-white p-3.5 text-center shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
          >
            <div className="w-full text-right">
              <span className="text-sm font-extrabold text-slate-900">تحويل اموال</span>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-[#E60000]">
              <Send className="h-5 w-5" aria-hidden="true" />
            </div>

            <p className="text-[11px] font-medium leading-snug text-slate-700">
              ستظهر المفضلات الخاصة بك هنا. اضغط لإداراتها
            </p>
          </button>
        </section>

        {/* Card 4: آخر المعاملات Preview (matching IMG_5817) */}
        <section aria-label="آخر المعاملات" className="rounded-2xl bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="text-sm font-extrabold text-slate-900">آخر المعاملات</h2>
            <button
              type="button"
              onClick={onViewFullHistory}
              className="rounded-full bg-[#F1F2F4] px-3.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              عرض الكل
            </button>
          </div>

          <ul className="divide-y divide-slate-100">
            {recentThree.map((tx) => {
              const { kind, title } = classifyTransactionCategory(tx);
              const isCredit = isCreditTransaction(tx.type);
              const timeStr = formatShortArabicDateTime(tx.timestamp);

              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    className="flex w-full items-center justify-between gap-2.5 py-3 text-right transition-colors hover:bg-slate-50/70 rounded-xl cursor-pointer"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <TxCategoryBadge kind={kind} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-extrabold text-slate-900 truncate">
                          {title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 truncate">{timeStr}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        dir="ltr"
                        className={`font-mono-tabular text-xs font-extrabold whitespace-nowrap ${
                          tx.status === 'failed'
                            ? 'text-slate-400 line-through'
                            : isCredit
                              ? 'text-[#2D7E3B]'
                              : 'text-[#E60000]'
                        }`}
                      >
                        {isCredit ? '+' : '-'} جنيه {formatCurrency(tx.amount)}
                      </span>
                      <ChevronLeft className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Card 5: الإعدادات (matching IMG_5817 bottom) */}
        <section aria-label="إعدادات فودافون كاش" className="pt-1 space-y-2.5">
          <h2 className="text-right text-base font-extrabold text-slate-900">الإعدادات</h2>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onShowNotice('تم إرسال رمز التحقق لتغيير الرقم السري للمحفظة')}
              className="flex min-h-[48px] items-center justify-between gap-2 rounded-2xl bg-white px-3.5 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <Lock className="h-4.5 w-4.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-xs font-bold text-slate-900">تغيير الرقم السري</span>
            </button>

            <button
              type="button"
              onClick={() => onShowNotice('الرقم السري لمحفظة فودافون كاش مفعّل حالياً')}
              className="flex min-h-[48px] items-center justify-between gap-2 rounded-2xl bg-white px-3.5 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <Lock className="h-4.5 w-4.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-xs font-bold text-slate-900">إنشاء الرقم السري</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenSheet('inquiry')}
              className="flex min-h-[48px] items-center justify-between gap-2 rounded-2xl bg-white px-3.5 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <Lock className="h-4.5 w-4.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-xs font-bold text-slate-900">حدود المحفظة</span>
            </button>

            <button
              type="button"
              onClick={() => onShowNotice('أقرب فرع فودافون: فرع المعادي · شارع 9')}
              className="flex min-h-[48px] items-center justify-between gap-2 rounded-2xl bg-white px-3.5 text-right shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <Store className="h-4.5 w-4.5 text-slate-600 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-xs font-bold text-slate-900">الفروع</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onShowNotice('خدمة عملاء فودافون كاش متاحة على مدار الساعة عبر 7001')}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            <HelpCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>المساعدة والأسئلة الشائعة</span>
          </button>
        </section>
      </div>

      {/* Operation Bottom Sheet */}
      {activeSheet && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => onOpenSheet(null)}
        >
          <div
            className="w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#F4F5F7] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 mx-auto sm:hidden" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onOpenSheet(null)}
                aria-label="إغلاق"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-xs hover:bg-slate-100 cursor-pointer mr-auto"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {activeSheet === 'send' && (
              <SendMoneyForm
                ownAccountNumber={walletState.account.accountNumber}
                availableBalance={walletState.account.balance}
                onExecute={(payload) => {
                  const res = onExecuteOperation(payload);
                  if (res.success) onOpenSheet(null);
                  return res;
                }}
              />
            )}

            {activeSheet === 'receive' && (
              <ReceiveMoneyForm
                ownAccountNumber={walletState.account.accountNumber}
                onCopyAccountNumber={onCopyAccountNumber}
                onExecute={(payload) => {
                  const res = onExecuteOperation(payload);
                  if (res.success) onOpenSheet(null);
                  return res;
                }}
              />
            )}

            {activeSheet === 'withdraw' && (
              <WithdrawCashForm
                ownAccountNumber={walletState.account.accountNumber}
                availableBalance={walletState.account.balance}
                onExecute={onExecuteOperation}
                onCopyCode={onCopyCode}
              />
            )}

            {activeSheet === 'deposit' && (
              <DepositCashForm
                ownAccountNumber={walletState.account.accountNumber}
                onExecute={(payload) => {
                  const res = onExecuteOperation(payload);
                  if (res.success) onOpenSheet(null);
                  return res;
                }}
              />
            )}

            {activeSheet === 'inquiry' && (
              <BalanceInquiryPanel
                walletState={walletState}
                onCopySummary={onCopySummary}
              />
            )}
          </div>
        </div>
      )}

      {/* 6-Digit Wallet PIN Sheet triggered by Eye button */}
      <WalletPinSheet
        open={pinSheetOpen}
        onClose={() => setPinSheetOpen(false)}
        onCompletePin={() => {
          setPinSheetOpen(false);
          onRunLoading(() => {
            setBalanceVisible(true);
          }, 600);
        }}
        onForgotPin={() =>
          onShowNotice('أدخل أي 6 أرقام لإظهار رصيد محفظة فودافون كاش.')
        }
      />
    </div>
  );
}
