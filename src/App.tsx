import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AuthSimSheet } from './components/AuthSimSheet';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import {
  BillPayModal,
  NotificationsModal,
  RechargeModal,
} from './components/HomeModals';
import { HomeScreen } from './components/HomeScreen';
import { ImportWalletDataScreen } from './components/ImportWalletDataScreen';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MoreScreen } from './components/MoreScreen';
import { PlaceholderSectionScreen } from './components/PlaceholderSectionScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { PWAStatusBar } from './components/PWAInstallBanner';
import { SplashScreen } from './components/SplashScreen';
import { Toast, ToastMessage } from './components/Toast';
import { TransactionDetailsScreen } from './components/TransactionDetailsScreen';
import {
  DateFilterType,
  SortOrder,
  TransactionFilterType,
} from './components/TransactionHistory';
import { WalletDashboardScreen } from './components/WalletDashboardScreen';
import { WalletHistoryTab, WalletTransactionsPage } from './components/WalletTransactionsPage';
import {
  DemoNotification,
  INITIAL_DEMO_NOTIFICATIONS,
  TELECOM_DEMO_PROFILE,
} from './data/telecomDemoData';
import { useNavigation } from './hooks/useNavigation';
import { checkIncomingSharedPayload } from './services/androidDeviceBridge';
import {
  deleteImportedRecord,
  downloadServerExport,
  fetchAdminAuthStatus,
  fetchCurrentSession,
  fetchImportedRecords,
  loadGuestImports,
  logoutSession,
  saveGuestImports,
  setAdminSessionToken,
  submitImportBatch,
  syncWalletToServer,
  triggerBlobDownload,
  updateImportedRecord,
} from './services/apiClient';
import { buildCandidateFingerprint } from './services/transactionParser';
import {
  executeWalletOperation,
  loadTelecomLineState,
  loadWalletState,
  resetTelecomLineState,
  resetWalletState,
  saveTelecomLineState,
  saveWalletState,
  TelecomLineState,
} from './services/walletStorage';
import { AppRoute } from './types/navigation';
import {
  AdminAuthStatus,
  DemoUserProfile,
  ImportBatchSummary,
  ImportedSourceType,
  ImportedTransactionType,
  ImportedWalletRecord,
  OperationMode,
  OperationPayload,
  OperationResult,
  ParsedTransactionCandidate,
  WalletState,
} from './types/wallet';
import { copyToClipboard } from './utils/clipboard';
import { formatCurrency, formatPhoneNumber } from './utils/formatters';

function getScreenTitle(route: AppRoute): string {
  switch (route) {
    case 'home':
      return TELECOM_DEMO_PROFILE.brandName;
    case 'offers':
      return 'العروض';
    case 'internet':
      return 'الإنترنت';
    case 'wallet':
      return 'فودافون كاش';
    case 'wallet-history':
      return 'سجل المعاملات';
    case 'wallet-tx-detail':
      return 'تفاصيل المعاملة';
    case 'import-data':
      return 'استيراد البيانات';
    case 'admin-login':
      return 'دخول المسؤول';
    case 'admin':
      return 'لوحة الإدارة';
    case 'more':
      return 'المزيد';
  }
}

function formatCurrentClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function neutralizeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  const safe = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>(() => loadWalletState());
  const [lineState, setLineState] = useState<TelecomLineState>(() => loadTelecomLineState());
  const [currentUser, setCurrentUser] = useState<DemoUserProfile | null>(null);
  const [importedRecords, setImportedRecords] = useState<ImportedWalletRecord[]>(
    () => loadGuestImports().records
  );
  const [importBatches, setImportBatches] = useState<ImportBatchSummary[]>(
    () => loadGuestImports().batches
  );

  const [incomingSharedText, setIncomingSharedText] = useState<string | null>(null);
  const [incomingSharedFiles, setIncomingSharedFiles] = useState<File[]>([]);

  const [notifications, setNotifications] = useState<DemoNotification[]>(
    () => INITIAL_DEMO_NOTIFICATIONS
  );
  const [showSplash, setShowSplash] = useState(true);
  const [isScreenLoading, setIsScreenLoading] = useState(false);
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [homeRefreshSignal, setHomeRefreshSignal] = useState(0);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() =>
    formatCurrentClock(new Date())
  );

  const loadingTimerRef = useRef<number | null>(null);
  const homeRefreshTimerRef = useRef<number | null>(null);

  const [activeWalletSheet, setActiveWalletSheet] = useState<OperationMode | null>(null);
  const [historyInitialTab, setHistoryInitialTab] = useState<WalletHistoryTab>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TransactionFilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const [profileOpen, setProfileOpen] = useState(false);
  const [authSimOpen, setAuthSimOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [billPayOpen, setBillPayOpen] = useState(false);
  const [playWalletOpenEffect, setPlayWalletOpenEffect] = useState(false);
  const [adminAuthStatus, setAdminAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const {
    currentRoute,
    selectedTransactionId,
    activeTab,
    canGoBack,
    navigateTo,
    switchTab,
    goBack,
  } = useNavigation();

  const showToast = useCallback((text: string, variant: 'success' | 'error' = 'success') => {
    setToast({ id: Date.now(), text, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) window.clearTimeout(loadingTimerRef.current);
      if (homeRefreshTimerRef.current) window.clearTimeout(homeRefreshTimerRef.current);
    };
  }, []);

  // Hydrate persistent authenticated session & per-user wallet/imports + Share Target payload
  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const session = await fetchCurrentSession();
      if (!active) return;

      if (session.authenticated && session.user) {
        setCurrentUser(session.user);
        if (session.walletState) {
          setWalletState(session.walletState);
          saveWalletState(session.walletState);
        }
        setLineState((prev) => {
          const next: TelecomLineState = {
            ...prev,
            subscriberName: session.user!.displayName,
            mobileNumber: session.user!.phone,
            lineBalance:
              typeof session.lineBalance === 'number' ? session.lineBalance : prev.lineBalance,
            billAmount:
              typeof session.billAmount === 'number' ? session.billAmount : prev.billAmount,
            billPaid: typeof session.billPaid === 'boolean' ? session.billPaid : prev.billPaid,
            address: session.address || prev.address,
            biometricEnabled:
              typeof session.biometricEnabled === 'boolean'
                ? session.biometricEnabled
                : prev.biometricEnabled,
          };
          saveTelecomLineState(next);
          return next;
        });

        try {
          const imp = await fetchImportedRecords();
          if (active) {
            setImportedRecords(imp.records);
            setImportBatches(imp.batches);
          }
        } catch {
          // Ignore non-fatal import fetch error
        }
      }

      try {
        const adminSt = await fetchAdminAuthStatus();
        if (active) setAdminAuthStatus(adminSt);
      } catch {
        // Ignore non-fatal admin auth check
      }

      const incoming = await checkIncomingSharedPayload();
      if (!active || !incoming) return;

      const combinedText = [incoming.title, incoming.text, incoming.url]
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n');
      if (combinedText) setIncomingSharedText(combinedText);
      if (incoming.files.length > 0) setIncomingSharedFiles(incoming.files);

      setShowSplash(false);
      navigateTo('import-data');
      showToast('تم استلام بيانات مشاركة للمعاينة قبل الاستيراد.', 'success');
    };

    void bootstrapSession();
    return () => {
      active = false;
    };
  }, [navigateTo, showToast]);

  const persistServerWalletIfAuthed = useCallback(
    (nextWallet: WalletState, nextLine: TelecomLineState) => {
      if (!currentUser) return;
      void syncWalletToServer({
        walletState: nextWallet,
        lineBalance: nextLine.lineBalance,
        billAmount: nextLine.billAmount,
        billPaid: nextLine.billPaid,
        address: nextLine.address,
        biometricEnabled: nextLine.biometricEnabled,
      }).catch(() => undefined);
    },
    [currentUser]
  );

  const refreshSignedInUserFromServer = useCallback(async () => {
    if (!currentUser) return;
    try {
      const session = await fetchCurrentSession();
      if (session.authenticated && session.user && session.walletState) {
        setCurrentUser(session.user);
        setWalletState(session.walletState);
        saveWalletState(session.walletState);
      }
      const imp = await fetchImportedRecords();
      setImportedRecords(imp.records);
      setImportBatches(imp.batches);
    } catch {
      // ignore sync error if user was suspended
    }
  }, [currentUser]);

  const refreshTimestamp = useCallback(() => {
    setLastUpdatedTime(formatCurrentClock(new Date()));
  }, []);

  const triggerHomeRefresh = useCallback(
    (showFeedbackToast = false) => {
      refreshTimestamp();
      setHomeRefreshing(true);
      setHomeRefreshSignal((prev) => prev + 1);
      if (homeRefreshTimerRef.current) {
        window.clearTimeout(homeRefreshTimerRef.current);
      }
      homeRefreshTimerRef.current = window.setTimeout(() => {
        setHomeRefreshing(false);
        if (showFeedbackToast) {
          showToast('تم تحديث بيانات الباقة والرصيد.', 'success');
        }
      }, 650);
    },
    [refreshTimestamp, showToast]
  );

  const runWithLoading = useCallback((action: () => void, durationMs = 520) => {
    if (loadingTimerRef.current) {
      window.clearTimeout(loadingTimerRef.current);
    }
    setIsScreenLoading(true);
    loadingTimerRef.current = window.setTimeout(() => {
      action();
      setIsScreenLoading(false);
    }, durationMs);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastUpdatedTime(formatCurrentClock(new Date()));
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setLastUpdatedTime(formatCurrentClock(new Date()));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleCopy = useCallback(
    async (value: string, successLabel: string) => {
      const copied = await copyToClipboard(value);
      if (copied) {
        showToast(successLabel, 'success');
      } else {
        showToast('تعذر النسخ في هذا المتصفح.', 'error');
      }
    },
    [showToast]
  );

  const handleOperation = useCallback(
    (payload: OperationPayload): OperationResult => {
      const result = executeWalletOperation(walletState, payload);
      if (result.success && result.nextState && result.transaction) {
        setWalletState(result.nextState);
        persistServerWalletIfAuthed(result.nextState, lineState);
        refreshTimestamp();
        const verb =
          payload.type === 'send'
            ? 'تم تحويل'
            : payload.type === 'receive'
              ? 'تم استلام'
              : payload.type === 'withdraw'
                ? 'تم سحب'
                : 'تم إيداع';
        showToast(
          `${verb} ${formatCurrency(result.transaction.amount)} ج.م (${result.transaction.id})`,
          'success'
        );
      }
      return result;
    },
    [walletState, lineState, persistServerWalletIfAuthed, refreshTimestamp, showToast]
  );

  const handleConfirmRecharge = useCallback(
    (amount: number, useWallet: boolean): string | null => {
      const rounded = Math.round(amount * 100) / 100;
      let nextWalletState = walletState;
      if (useWallet) {
        const walletRes = executeWalletOperation(walletState, {
          type: 'send',
          amount: rounded,
          phoneNumber: lineState.mobileNumber,
          description: `شحن رصيد خط (${formatPhoneNumber(lineState.mobileNumber)})`,
        });
        if (!walletRes.success || !walletRes.nextState) {
          return walletRes.error ?? 'تعذر خصم المبلغ من المحفظة.';
        }
        nextWalletState = walletRes.nextState;
        setWalletState(nextWalletState);
      }

      const nextLine: TelecomLineState = {
        ...lineState,
        lineBalance: Math.round((lineState.lineBalance + rounded) * 100) / 100,
      };
      setLineState(nextLine);
      saveTelecomLineState(nextLine);
      persistServerWalletIfAuthed(nextWalletState, nextLine);
      refreshTimestamp();
      showToast(`تم شحن ${formatCurrency(rounded)} جنيه بنجاح.`, 'success');
      return null;
    },
    [walletState, lineState, persistServerWalletIfAuthed, refreshTimestamp, showToast]
  );

  const handleConfirmPayBill = useCallback((): string | null => {
    if (lineState.billPaid) {
      return 'لا يوجد فواتير مستحقة حالياً.';
    }
    const walletRes = executeWalletOperation(walletState, {
      type: 'send',
      amount: lineState.billAmount,
      phoneNumber: lineState.mobileNumber,
      description: 'سداد فاتورة الموبايل',
    });
    if (!walletRes.success || !walletRes.nextState) {
      return walletRes.error ?? 'تعذر سداد الفاتورة من المحفظة.';
    }
    setWalletState(walletRes.nextState);

    const nextLine: TelecomLineState = {
      ...lineState,
      billPaid: true,
    };
    setLineState(nextLine);
    saveTelecomLineState(nextLine);
    persistServerWalletIfAuthed(walletRes.nextState, nextLine);
    refreshTimestamp();
    showToast(`تم سداد الفاتورة (${formatCurrency(lineState.billAmount)} ج.م).`, 'success');
    return null;
  }, [walletState, lineState, persistServerWalletIfAuthed, refreshTimestamp, showToast]);

  const handleResetData = useCallback(() => {
    const freshWallet = resetWalletState();
    const freshLine = resetTelecomLineState();
    setWalletState(freshWallet);
    setLineState(freshLine);
    setNotifications(INITIAL_DEMO_NOTIFICATIONS);
    setSearchQuery('');
    setActiveFilter('all');
    setDateFilter('all');
    setSortOrder('newest');
    setActiveWalletSheet(null);
    setProfileOpen(false);
    persistServerWalletIfAuthed(freshWallet, freshLine);
    refreshTimestamp();
    setShowSplash(true);
    if (currentRoute === 'wallet-tx-detail') {
      goBack();
    }
    showToast('تمت استعادة بيانات الحساب.', 'success');
  }, [currentRoute, goBack, persistServerWalletIfAuthed, refreshTimestamp, showToast]);

  const handleAuthenticated = useCallback(
    async (payload: {
      user: DemoUserProfile;
      walletState?: unknown;
      lineBalance?: number;
      billAmount?: number;
      billPaid?: boolean;
      address?: string;
      biometricEnabled?: boolean;
    }) => {
      setCurrentUser(payload.user);
      const nextWallet = (payload.walletState as WalletState) || loadWalletState();
      setWalletState(nextWallet);
      saveWalletState(nextWallet);

      const nextLine: TelecomLineState = {
        lineBalance:
          typeof payload.lineBalance === 'number' ? payload.lineBalance : lineState.lineBalance,
        billAmount:
          typeof payload.billAmount === 'number' ? payload.billAmount : lineState.billAmount,
        billPaid: typeof payload.billPaid === 'boolean' ? payload.billPaid : lineState.billPaid,
        subscriberName: payload.user.displayName,
        mobileNumber: payload.user.phone,
        address: payload.address || lineState.address,
        biometricEnabled:
          typeof payload.biometricEnabled === 'boolean'
            ? payload.biometricEnabled
            : lineState.biometricEnabled,
      };
      setLineState(nextLine);
      saveTelecomLineState(nextLine);

      try {
        const imp = await fetchImportedRecords();
        setImportedRecords(imp.records);
        setImportBatches(imp.batches);
      } catch {
        setImportedRecords([]);
        setImportBatches([]);
      }
    },
    [lineState]
  );

  const handleLogout = useCallback(async () => {
    await logoutSession();
    setCurrentUser(null);
    const freshWallet = resetWalletState();
    const freshLine = resetTelecomLineState();
    setWalletState(freshWallet);
    setLineState(freshLine);
    const guest = loadGuestImports();
    setImportedRecords(guest.records);
    setImportBatches(guest.batches);
    if (currentRoute === 'admin') {
      switchTab('home');
    }
    showToast('تم تسجيل الخروج بنجاح.', 'success');
  }, [currentRoute, showToast, switchTab]);

  // Part 2 & 3: Save Imported Batch (Server when authenticated; isolated guest fallback otherwise)
  const handleSaveImportBatch = useCallback(
    async (payload: {
      sourceType: ImportedSourceType;
      fileName: string;
      candidates: ParsedTransactionCandidate[];
    }) => {
      if (currentUser) {
        const res = await submitImportBatch({
          sourceType: payload.sourceType,
          fileName: payload.fileName,
          records: payload.candidates,
        });
        setImportedRecords((prev) => [...res.insertedRecords, ...prev]);
        setImportBatches((prev) => [res.batch, ...prev]);
        return {
          importedCount: res.batch.importedCount,
          duplicateCount: res.batch.duplicateCount,
          errorCount: res.batch.errorCount,
        };
      }

      // Guest local mode fallback
      const now = new Date().toISOString();
      const batchId = `BAT-GUEST-${Date.now()}`;
      const existingKeys = new Set(importedRecords.map((r) => r.fingerprintHash));
      let importedCount = 0;
      let duplicateCount = 0;
      const inserted: ImportedWalletRecord[] = [];

      for (const cand of payload.candidates) {
        if (typeof cand.amount !== 'number' || cand.amount <= 0) continue;
        const fp = buildCandidateFingerprint(cand);
        if (existingKeys.has(fp)) {
          duplicateCount += 1;
          continue;
        }
        existingKeys.add(fp);
        inserted.push({
          id: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: 'guest-local',
          batchId,
          originalSourceText: cand.originalSourceText,
          transactionType: cand.transactionType,
          amount: Number(cand.amount.toFixed(2)),
          phoneNumber: cand.phoneNumber,
          txTimestamp: cand.txTimestamp,
          description: cand.description,
          referenceCode: cand.referenceCode,
          sourceType: cand.sourceType,
          importTimestamp: now,
          verificationStatus: 'unverified_demo',
          fingerprintHash: fp,
          updatedAt: now,
        });
        importedCount += 1;
      }

      const batch: ImportBatchSummary = {
        id: batchId,
        userId: 'guest-local',
        sourceType: payload.sourceType,
        fileName: payload.fileName,
        totalRows: payload.candidates.length,
        importedCount,
        duplicateCount,
        errorCount: 0,
        status: importedCount > 0 ? 'completed' : 'failed',
        createdAt: now,
      };

      const nextRecords = [...inserted, ...importedRecords];
      const nextBatches = [batch, ...importBatches];
      setImportedRecords(nextRecords);
      setImportBatches(nextBatches);
      saveGuestImports(nextRecords, nextBatches);

      return { importedCount, duplicateCount, errorCount: 0 };
    },
    [currentUser, importedRecords, importBatches]
  );

  const handleUpdateImportedRecord = useCallback(
    async (
      id: string,
      updates: {
        transactionType: ImportedTransactionType;
        amount: number;
        phoneNumber: string;
        description: string;
        referenceCode: string;
      }
    ) => {
      if (currentUser) {
        const res = await updateImportedRecord(id, updates);
        setImportedRecords((prev) => prev.map((r) => (r.id === id ? res.record : r)));
        return;
      }

      const nextRecords = importedRecords.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );
      setImportedRecords(nextRecords);
      saveGuestImports(nextRecords, importBatches);
    },
    [currentUser, importedRecords, importBatches]
  );

  const handleDeleteImportedRecord = useCallback(
    async (id: string) => {
      if (currentUser) {
        await deleteImportedRecord(id);
        setImportedRecords((prev) => prev.filter((r) => r.id !== id));
        showToast('تم حذف السجل المستورد.', 'success');
        return;
      }

      const nextRecords = importedRecords.filter((r) => r.id !== id);
      setImportedRecords(nextRecords);
      saveGuestImports(nextRecords, importBatches);
      showToast('تم حذف السجل المستورد.', 'success');
    },
    [currentUser, importedRecords, importBatches, showToast]
  );

  const handleExportImportedData = useCallback(
    async (format: 'csv' | 'json') => {
      if (currentUser) {
        await downloadServerExport(format);
        showToast(`تم تصدير ملف ${format.toUpperCase()} بنجاح.`, 'success');
        return;
      }

      if (format === 'json') {
        const blob = new Blob(
          [
            JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                disclaimer: 'Unverified user-provided records.',
                records: importedRecords,
              },
              null,
              2
            ),
          ],
          { type: 'application/json;charset=utf-8' }
        );
        triggerBlobDownload(blob, 'wallet-imports.json');
      } else {
        const header =
          'id,verification_status,source_type,transaction_type,amount,phone_number,tx_timestamp,reference_code,description,import_timestamp,original_source_text';
        const body = importedRecords
          .map((r) =>
            [
              neutralizeCsvCell(r.id),
              neutralizeCsvCell(r.verificationStatus),
              neutralizeCsvCell(r.sourceType),
              neutralizeCsvCell(r.transactionType),
              neutralizeCsvCell(String(r.amount)),
              neutralizeCsvCell(r.phoneNumber),
              neutralizeCsvCell(r.txTimestamp),
              neutralizeCsvCell(r.referenceCode),
              neutralizeCsvCell(r.description),
              neutralizeCsvCell(r.importTimestamp),
              neutralizeCsvCell(r.originalSourceText),
            ].join(',')
          )
          .join('\n');
        const blob = new Blob([`\uFEFF${header}\n${body}`], {
          type: 'text/csv;charset=utf-8',
        });
        triggerBlobDownload(blob, 'wallet-imports.csv');
      }
      showToast(`تم تصدير ملف ${format.toUpperCase()} بنجاح.`, 'success');
    },
    [currentUser, importedRecords, showToast]
  );

  const selectedTransaction = selectedTransactionId
    ? walletState.transactions.find((tx) => tx.id === selectedTransactionId) ?? null
    : null;

  const unreadCount = notifications.filter((n) => n.unread).length;

  const hideStandardHeader =
    currentRoute === 'wallet' ||
    currentRoute === 'wallet-history' ||
    currentRoute === 'wallet-tx-detail' ||
    currentRoute === 'import-data' ||
    currentRoute === 'admin-login' ||
    currentRoute === 'admin';

  const hideBottomNav =
    currentRoute === 'wallet-tx-detail' ||
    currentRoute === 'import-data' ||
    currentRoute === 'admin-login' ||
    currentRoute === 'admin';

  return (
    <div className="min-h-screen bg-[#E8EAEE]">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-[#F4F5F7] shadow-xl sm:border-x sm:border-slate-200/80">
        {!hideStandardHeader && (
          <Header
            title={getScreenTitle(currentRoute)}
            unreadNotifications={unreadCount}
            canGoBack={canGoBack}
            isHome={currentRoute === 'home'}
            onBack={goBack}
            onOpenSearch={() => {
              runWithLoading(() => {
                setHistoryInitialTab('transactions');
                navigateTo('wallet-history');
              });
            }}
            onOpenNotifications={() => setNotificationsOpen(true)}
          />
        )}

        <PWAStatusBar />

        <main className="flex-1">
          {currentRoute === 'home' && (
            <HomeScreen
              lineBalance={lineState.lineBalance}
              lastUpdatedTime={lastUpdatedTime}
              refreshSignal={homeRefreshSignal}
              isRefreshing={homeRefreshing}
              onRefreshTime={() => triggerHomeRefresh(true)}
              onNavigate={(route) => {
                setActiveWalletSheet(null);
                if (route === 'wallet') {
                  setPlayWalletOpenEffect(true);
                  navigateTo('wallet');
                  return;
                }
                runWithLoading(() => navigateTo(route));
              }}
              onOpenRecharge={() => setRechargeOpen(true)}
              onShowNotice={(msg) => showToast(msg, 'success')}
            />
          )}

          {(currentRoute === 'offers' || currentRoute === 'internet') && (
            <div className="p-4">
              <PlaceholderSectionScreen
                section={currentRoute}
                onNavigate={(route) => {
                  setActiveWalletSheet(null);
                  if (route === 'wallet') {
                    setPlayWalletOpenEffect(true);
                    navigateTo('wallet');
                    return;
                  }
                  runWithLoading(() => navigateTo(route));
                }}
                onGoBack={goBack}
                onShowNotice={(msg) => showToast(msg, 'success')}
              />
            </div>
          )}

          {currentRoute === 'more' && (
            <MoreScreen
              subscriberName={lineState.subscriberName}
              mobileNumber={lineState.mobileNumber}
              lineBalance={lineState.lineBalance}
              walletBalance={walletState.account.balance}
              biometricEnabled={lineState.biometricEnabled}
              unreadNotifications={unreadCount}
              currentUser={currentUser}
              importedCount={importedRecords.length}
              adminAuthenticated={Boolean(adminAuthStatus?.sessionAuthenticated)}
              onNavigate={(route) => {
                setActiveWalletSheet(null);
                if (route === 'wallet') {
                  setPlayWalletOpenEffect(true);
                  navigateTo('wallet');
                  return;
                }
                if (route === 'admin-login' || route === 'admin') {
                  navigateTo(route);
                  return;
                }
                runWithLoading(() => navigateTo(route));
              }}
              onOpenProfile={() => setProfileOpen(true)}
              onOpenAuthSim={() => setAuthSimOpen(true)}
              onOpenNotifications={() => setNotificationsOpen(true)}
              onToggleBiometric={(enabled) => {
                const nextLine: TelecomLineState = {
                  ...lineState,
                  biometricEnabled: enabled,
                };
                setLineState(nextLine);
                saveTelecomLineState(nextLine);
                persistServerWalletIfAuthed(walletState, nextLine);
              }}
              onResetData={handleResetData}
              onCopyText={(val, label) => handleCopy(val, label)}
              onShowNotice={(msg) => showToast(msg, 'success')}
            />
          )}

          {currentRoute === 'wallet' && (
            <WalletDashboardScreen
              walletState={walletState}
              activeSheet={activeWalletSheet}
              onOpenSheet={setActiveWalletSheet}
              onBack={goBack}
              onOpenNotifications={() => setNotificationsOpen(true)}
              onOpenOffers={() => runWithLoading(() => navigateTo('offers'))}
              onRunLoading={runWithLoading}
              onExecuteOperation={handleOperation}
              onSelectTransaction={(tx) =>
                runWithLoading(() => navigateTo('wallet-tx-detail', tx.id), 380)
              }
              onViewFullHistory={() => {
                runWithLoading(() => {
                  setHistoryInitialTab('transactions');
                  navigateTo('wallet-history');
                });
              }}
              onOpenExpenses={() => {
                runWithLoading(() => {
                  setHistoryInitialTab('expenses');
                  navigateTo('wallet-history');
                });
              }}
              onCopyAccountNumber={(num) =>
                handleCopy(num, `تم نسخ رقم المحفظة ${formatPhoneNumber(num)}`)
              }
              onCopyCode={(code) => handleCopy(code, `تم نسخ الرقم السري ${code}`)}
              onCopySummary={(summary) =>
                handleCopy(summary, 'تم نسخ ملخص المصروفات')
              }
              onOpenBillPay={() => setBillPayOpen(true)}
              onShowNotice={(msg) => showToast(msg, 'success')}
              importedCount={importedRecords.length}
              onOpenImportData={() => runWithLoading(() => navigateTo('import-data'), 320)}
              playOpenEffect={playWalletOpenEffect}
              onOpenEffectFinished={() => setPlayWalletOpenEffect(false)}
            />
          )}

          {currentRoute === 'wallet-history' && (
            <WalletTransactionsPage
              transactions={walletState.transactions}
              initialTab={historyInitialTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onSelectTransaction={(tx) =>
                runWithLoading(() => navigateTo('wallet-tx-detail', tx.id), 380)
              }
              onCopyPhone={(phone) =>
                handleCopy(phone, `تم نسخ الهاتف ${formatPhoneNumber(phone)}`)
              }
              onExportPdfStatement={(summary) =>
                handleCopy(summary, 'تم تجهيز ونسخ كشف حساب المعاملات بنجاح')
              }
              onBack={goBack}
              importedRecordsCount={importedRecords.length}
              onOpenImportData={() => runWithLoading(() => navigateTo('import-data'), 320)}
            />
          )}

          {currentRoute === 'wallet-tx-detail' && (
            <TransactionDetailsScreen
              transaction={selectedTransaction}
              walletAccountNumber={walletState.account.accountNumber}
              onBack={goBack}
              onCopyPhone={(phone) =>
                handleCopy(phone, `تم نسخ الهاتف ${formatPhoneNumber(phone)}`)
              }
              onCopyId={(id) => handleCopy(id, `تم نسخ المرجع ${id}`)}
              onCopyAmount={(amountText) => handleCopy(amountText, `تم نسخ المبلغ ${amountText}`)}
              onCopyFullInfo={(summary) =>
                handleCopy(summary, 'تم نسخ تفاصيل المعاملة كاملة')
              }
            />
          )}

          {currentRoute === 'import-data' && (
            <ImportWalletDataScreen
              records={importedRecords}
              batches={importBatches}
              incomingSharedText={incomingSharedText}
              incomingSharedFiles={incomingSharedFiles}
              onConsumeIncomingShare={() => {
                setIncomingSharedText(null);
                setIncomingSharedFiles([]);
              }}
              onSaveBatch={handleSaveImportBatch}
              onUpdateRecord={handleUpdateImportedRecord}
              onDeleteRecord={handleDeleteImportedRecord}
              onExportData={handleExportImportedData}
              onBack={goBack}
              onShowNotice={showToast}
            />
          )}

          {currentRoute === 'admin-login' && (
            <AdminLoginScreen
              onBack={() => switchTab('more')}
              onAuthenticated={(status) => {
                setAdminAuthStatus(status);
                navigateTo('admin');
              }}
              onShowNotice={showToast}
            />
          )}

          {currentRoute === 'admin' &&
            (adminAuthStatus?.sessionAuthenticated ? (
              <AdminDashboardScreen
                adminEmail={adminAuthStatus.admin?.email}
                expiresAt={adminAuthStatus.expiresAt}
                onBack={() => switchTab('more')}
                onAdminLoggedOut={() => {
                  setAdminSessionToken(null);
                  setAdminAuthStatus((prev) =>
                    prev ? { ...prev, sessionAuthenticated: false, admin: undefined } : null
                  );
                  switchTab('more');
                }}
                onDataChanged={() => void refreshSignedInUserFromServer()}
                onShowNotice={showToast}
              />
            ) : (
              <AdminLoginScreen
                onBack={() => switchTab('more')}
                onAuthenticated={(status) => {
                  setAdminAuthStatus(status);
                  navigateTo('admin');
                }}
                onShowNotice={showToast}
              />
            ))}
        </main>

        {!hideBottomNav && (
          <BottomNav
            activeTab={activeTab}
            currentRoute={currentRoute}
            onSelectTab={(tab) => {
              setActiveWalletSheet(null);
              if (tab === currentRoute) return;
              if (tab === 'home') {
                switchTab(tab);
                triggerHomeRefresh(false);
                return;
              }
              runWithLoading(() => switchTab(tab));
            }}
            onOpenProfile={() => runWithLoading(() => setProfileOpen(true), 420)}
            onOpenWalletSend={() => {
              if (currentRoute !== 'wallet') {
                runWithLoading(() => {
                  navigateTo('wallet');
                  setActiveWalletSheet('send');
                }, 420);
              } else {
                setActiveWalletSheet('send');
              }
            }}
            onOpenWalletHistory={() => {
              setActiveWalletSheet(null);
              runWithLoading(() => {
                setHistoryInitialTab('transactions');
                navigateTo('wallet-history');
              });
            }}
          />
        )}
      </div>

      <NotificationsModal
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
          showToast('تم تحديد جميع الإشعارات كمقروءة.', 'success');
        }}
      />

      <ProfileScreen
        open={profileOpen}
        subscriberName={lineState.subscriberName}
        mobileNumber={lineState.mobileNumber}
        address={lineState.address}
        biometricEnabled={lineState.biometricEnabled}
        lineBalance={lineState.lineBalance}
        walletBalance={walletState.account.balance}
        walletAccountNumber={walletState.account.accountNumber}
        onClose={() => setProfileOpen(false)}
        onCopyText={(val, label) => handleCopy(val, label)}
        onSaveProfile={(updates) => {
          const nextLine: TelecomLineState = {
            ...lineState,
            subscriberName: updates.subscriberName,
            mobileNumber: updates.mobileNumber,
            address: updates.address,
          };
          setLineState(nextLine);
          saveTelecomLineState(nextLine);
          persistServerWalletIfAuthed(walletState, nextLine);
        }}
        onToggleBiometric={(enabled) => {
          const nextLine: TelecomLineState = {
            ...lineState,
            biometricEnabled: enabled,
          };
          setLineState(nextLine);
          saveTelecomLineState(nextLine);
          persistServerWalletIfAuthed(walletState, nextLine);
        }}
        onOpenPreviousPayments={() => {
          setActiveWalletSheet(null);
          runWithLoading(() => {
            setHistoryInitialTab('transactions');
            navigateTo('wallet-history');
          });
        }}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onResetData={handleResetData}
        onLogout={handleLogout}
        onOpenAuthSim={() => setAuthSimOpen(true)}
        onShowNotice={(msg) => showToast(msg, 'success')}
      />

      <AuthSimSheet
        open={authSimOpen}
        currentUser={currentUser}
        onClose={() => setAuthSimOpen(false)}
        onAuthenticated={handleAuthenticated}
        onUserUpdated={(u) => setCurrentUser(u)}
        onLogout={handleLogout}
        onShowNotice={showToast}
      />

      <RechargeModal
        open={rechargeOpen}
        walletBalance={walletState.account.balance}
        onClose={() => setRechargeOpen(false)}
        onConfirmRecharge={handleConfirmRecharge}
      />

      <BillPayModal
        open={billPayOpen}
        billAmount={lineState.billAmount}
        billPaid={lineState.billPaid}
        walletBalance={walletState.account.balance}
        onClose={() => setBillPayOpen(false)}
        onConfirmPayBill={handleConfirmPayBill}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <LoadingOverlay visible={isScreenLoading} />

      <SplashScreen
        active={showSplash}
        onComplete={() => {
          setShowSplash(false);
          triggerHomeRefresh(false);
        }}
      />
    </div>
  );
}
