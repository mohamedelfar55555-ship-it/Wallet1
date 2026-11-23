import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileSearch,
  History,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminAddSimulatedWalletTx,
  adminChangeImportedVisibility,
  adminChangeWalletTxVisibility,
  adminDeleteImportedRecord,
  adminDeleteWalletTx,
  adminEditImportedMetadata,
  adminEditWalletTxMetadata,
  adminUpdateUser,
  adminVerifyImportedRecord,
  adminVerifyWalletTx,
  fetchAdminOverview,
  fetchAdminUserDetail,
  logoutAdmin,
} from '../services/apiClient';
import type {
  AdminOverviewData,
  AdminUserDetailData,
  AdminUserSummary,
  AdminWalletRecordItem,
  RecordVisibilityStatus,
} from '../types/wallet';
import { formatCurrency, formatDateTime, formatPhoneNumber } from '../utils/formatters';

interface AdminDashboardScreenProps {
  adminEmail?: string;
  expiresAt?: string;
  onBack: () => void;
  onAdminLoggedOut: () => void;
  onDataChanged?: () => void;
  onShowNotice: (text: string, variant?: 'success' | 'error') => void;
}

type AdminTab = 'overview' | 'users' | 'records' | 'audit';
type RecordKindFilter = 'all' | 'simulated_wallet_tx' | 'imported_record';
type VisibilityFilter = 'all' | RecordVisibilityStatus;
type VisibilityActionType = 'hide' | 'restore_hidden' | 'archive' | 'restore_archived';

interface PendingVisibilityState {
  recordKind: 'simulated_wallet_tx' | 'imported_record';
  recordId: string;
  userId: string;
  action: VisibilityActionType;
  label: string;
}

interface PendingStatusState {
  user: AdminUserSummary;
  mode: 'status' | 'verify' | 'hide';
  nextStatus?: 'active' | 'suspended';
  nextVerified?: boolean;
  nextHidden?: boolean;
}

interface PendingVerifyRecordState {
  recordKind: 'simulated_wallet_tx' | 'imported_record';
  recordId: string;
  userId: string;
  nextVerified: boolean;
  description: string;
}

interface PendingDeleteRecordState {
  recordKind: 'simulated_wallet_tx' | 'imported_record';
  recordId: string;
  userId: string;
  description: string;
  amount: number;
}

function visibilityBadge(status: RecordVisibilityStatus) {
  if (status === 'hidden') {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
        مخفي
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
        مؤرشف
      </span>
    );
  }
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
      ظاهر
    </span>
  );
}

export function AdminDashboardScreen({
  adminEmail,
  expiresAt,
  onBack,
  onAdminLoggedOut,
  onDataChanged,
  onShowNotice,
}: AdminDashboardScreenProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordKindFilter, setRecordKindFilter] = useState<RecordKindFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [auditSubTab, setAuditSubTab] = useState<'history' | 'logs'>('history');

  // Modals
  const [inspectedUser, setInspectedUser] = useState<AdminUserDetailData | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const [pendingUserAction, setPendingUserAction] = useState<PendingStatusState | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const [pendingVisibility, setPendingVisibility] = useState<PendingVisibilityState | null>(null);
  const [visibilityReason, setVisibilityReason] = useState('');

  const [pendingVerifyRecord, setPendingVerifyRecord] = useState<PendingVerifyRecordState | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyReason, setVerifyReason] = useState('');

  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<PendingDeleteRecordState | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [inspectedRecord, setInspectedRecord] = useState<AdminWalletRecordItem | null>(null);

  const [editingRecord, setEditingRecord] = useState<AdminWalletRecordItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editReferenceCode, setEditReferenceCode] = useState('');
  const [editReason, setEditReason] = useState('');

  // Add Simulated Record Modal state
  const [addSimOpen, setAddSimOpen] = useState(false);
  const [addSimUserId, setAddSimUserId] = useState('');
  const [addSimType, setAddSimType] = useState<'send' | 'receive' | 'withdraw' | 'deposit'>('send');
  const [addSimAmount, setAddSimAmount] = useState('');
  const [addSimPhone, setAddSimPhone] = useState('');
  const [addSimDesc, setAddSimDesc] = useState('');
  const [addSimReason, setAddSimReason] = useState('');

  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchAdminOverview();
      setData(overview);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل لوحة تحكم الإدارة.';
      setError(message);
      if (message.includes('جلسة المسؤول') || message.includes('انتهت')) {
        onAdminLoggedOut();
      }
    } finally {
      setLoading(false);
    }
  }, [onAdminLoggedOut]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshInspectedUserIfOpen = useCallback(
    async (userId: string) => {
      if (inspectedUser && inspectedUser.user.id === userId) {
        try {
          const detail = await fetchAdminUserDetail(userId);
          setInspectedUser(detail);
        } catch {
          // ignore
        }
      }
    },
    [inspectedUser]
  );

  const handleOpenUserDetail = async (userId: string) => {
    setInspectLoading(true);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setInspectedUser(detail);
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر تحميل ملف المستخدم.', 'error');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleConfirmUserAction = async () => {
    if (!pendingUserAction) return;
    const cleanReason = statusReason.trim();
    if (cleanReason.length < 3) {
      onShowNotice('يرجى كتابة سبب الإجراء (3 أحرف على الأقل).', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      if (pendingUserAction.mode === 'hide') {
        await adminUpdateUser(pendingUserAction.user.id, {
          isHidden: pendingUserAction.nextHidden,
          reason: cleanReason,
        });
        onShowNotice(
          pendingUserAction.nextHidden
            ? `تم إخفاء حساب (${pendingUserAction.user.phone}) من القوائم مع حفظ كامل بياناته.`
            : `تمت استعادة حساب (${pendingUserAction.user.phone}) للظهور مجدداً.`,
          'success'
        );
      } else if (pendingUserAction.mode === 'verify') {
        await adminUpdateUser(pendingUserAction.user.id, {
          adminVerified: pendingUserAction.nextVerified,
          reason: cleanReason,
        });
        onShowNotice(
          pendingUserAction.nextVerified
            ? `تم التحقق وتوثيق حساب (${pendingUserAction.user.phone}).`
            : `تم إلغاء التحقق عن حساب (${pendingUserAction.user.phone}).`,
          'success'
        );
      } else {
        await adminUpdateUser(pendingUserAction.user.id, {
          status: pendingUserAction.nextStatus,
          reason: cleanReason,
        });
        onShowNotice(
          pendingUserAction.nextStatus === 'suspended'
            ? `تم إيقاف الحساب (${pendingUserAction.user.phone}) وإنهاء جلساته.`
            : `تم إعادة تفعيل الحساب (${pendingUserAction.user.phone}).`,
          'success'
        );
      }
      const targetId = pendingUserAction.user.id;
      setPendingUserAction(null);
      setStatusReason('');
      await loadData();
      await refreshInspectedUserIfOpen(targetId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'فشل تحديث بيانات المستخدم.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmVisibility = async () => {
    if (!pendingVisibility) return;
    const cleanReason = visibilityReason.trim();
    if (cleanReason.length < 3) {
      onShowNotice('يجب إدخال سبب واضح للإجراء الإداري (3 أحرف على الأقل).', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      if (pendingVisibility.recordKind === 'imported_record') {
        await adminChangeImportedVisibility(pendingVisibility.recordId, {
          action: pendingVisibility.action,
          reason: cleanReason,
        });
      } else {
        await adminChangeWalletTxVisibility(pendingVisibility.userId, pendingVisibility.recordId, {
          action: pendingVisibility.action,
          reason: cleanReason,
        });
      }
      onShowNotice(`تم تنفيذ إجراء (${pendingVisibility.label}) وحفظه في سجل التدقيق.`, 'success');
      const targetUserId = pendingVisibility.userId;
      setPendingVisibility(null);
      setVisibilityReason('');
      await loadData();
      await refreshInspectedUserIfOpen(targetUserId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر تنفيذ إجراء الرؤية.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmVerifyRecord = async () => {
    if (!pendingVerifyRecord) return;
    const cleanReason = verifyReason.trim() || 'مراجعة وتحقق إداري';
    setSubmittingAction(true);
    try {
      if (pendingVerifyRecord.recordKind === 'imported_record') {
        await adminVerifyImportedRecord(pendingVerifyRecord.recordId, {
          verified: pendingVerifyRecord.nextVerified,
          note: verifyNote.trim() || undefined,
          reason: cleanReason,
        });
      } else {
        await adminVerifyWalletTx(pendingVerifyRecord.userId, pendingVerifyRecord.recordId, {
          verified: pendingVerifyRecord.nextVerified,
          note: verifyNote.trim() || undefined,
          reason: cleanReason,
        });
      }
      onShowNotice(
        pendingVerifyRecord.nextVerified
          ? 'تم التحقق من المعاملة وتوثيقها إدارياً.'
          : 'تم إلغاء التحقق الإداري عن المعاملة.',
        'success'
      );
      const targetUserId = pendingVerifyRecord.userId;
      setPendingVerifyRecord(null);
      setVerifyNote('');
      setVerifyReason('');
      await loadData();
      await refreshInspectedUserIfOpen(targetUserId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر تنفيذ التحقق من السجل.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!pendingDeleteRecord) return;
    const cleanReason = deleteReason.trim();
    if (cleanReason.length < 3) {
      onShowNotice('يجب إدخال سبب واضح لإزالة المعاملة (3 أحرف على الأقل).', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      if (pendingDeleteRecord.recordKind === 'imported_record') {
        await adminDeleteImportedRecord(pendingDeleteRecord.recordId, cleanReason);
      } else {
        await adminDeleteWalletTx(
          pendingDeleteRecord.userId,
          pendingDeleteRecord.recordId,
          cleanReason
        );
      }
      onShowNotice('تمت إزالة المعاملة مع حفظ لقطتها الكاملة في سجل التدقيق الدائم.', 'success');
      const targetUserId = pendingDeleteRecord.userId;
      setPendingDeleteRecord(null);
      setDeleteReason('');
      await loadData();
      await refreshInspectedUserIfOpen(targetUserId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر إزالة المعاملة.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenEditRecord = (rec: AdminWalletRecordItem) => {
    setEditingRecord(rec);
    setEditAmount(String(rec.amount));
    setEditDescription(rec.description);
    setEditPhone(rec.phoneNumber);
    setEditReferenceCode(rec.referenceCode);
    setEditReason('');
  };

  const handleSaveRecordMetadata = async () => {
    if (!editingRecord) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowNotice('أدخل مبلغاً صالحاً أكبر من صفر.', 'error');
      return;
    }
    const cleanReason = editReason.trim();
    if (cleanReason.length < 3) {
      onShowNotice('يجب إدخال سبب التعديل لحفظه في سجل التغييرات الدائم.', 'error');
      return;
    }

    setSubmittingAction(true);
    try {
      if (editingRecord.recordKind === 'imported_record') {
        await adminEditImportedMetadata(editingRecord.recordId, {
          amount,
          description: editDescription.trim(),
          phoneNumber: editPhone.trim(),
          referenceCode: editReferenceCode.trim(),
          reason: cleanReason,
        });
      } else {
        await adminEditWalletTxMetadata(editingRecord.userId, editingRecord.recordId, {
          amount,
          description: editDescription.trim(),
          phoneNumber: editPhone.trim(),
          reason: cleanReason,
        });
      }
      onShowNotice('تم تحديث البيانات الوصفية وحفظ النسخة الأصلية والتعديل في السجل الدائم.', 'success');
      const targetUserId = editingRecord.userId;
      setEditingRecord(null);
      await loadData();
      await refreshInspectedUserIfOpen(targetUserId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر تعديل السجل.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenAddSimulated = (presetUserId?: string) => {
    const fallbackUserId = presetUserId || data?.users[0]?.id || '';
    const targetUser = data?.users.find((u) => u.id === fallbackUserId);
    setAddSimUserId(fallbackUserId);
    setAddSimType('send');
    setAddSimAmount('');
    setAddSimPhone(targetUser?.phone || '01000000000');
    setAddSimDesc('');
    setAddSimReason('');
    setAddSimOpen(true);
  };

  const handleSaveNewSimulatedTx = async () => {
    const amount = Number(addSimAmount);
    if (!addSimUserId) {
      onShowNotice('اختر المستخدم المستهدف أولاً.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowNotice('أدخل مبلغاً صالحاً أكبر من صفر.', 'error');
      return;
    }
    if (addSimDesc.trim().length < 2) {
      onShowNotice('أدخل وصفاً واضحاً للمعاملة المحاكاة.', 'error');
      return;
    }
    if (addSimReason.trim().length < 3) {
      onShowNotice('أدخل سبب إنشاء المعاملة للتدقيق (3 أحرف على الأقل).', 'error');
      return;
    }
    setSubmittingAction(true);
    try {
      await adminAddSimulatedWalletTx(addSimUserId, {
        type: addSimType,
        amount,
        phoneNumber: addSimPhone.trim() || '01000000000',
        description: addSimDesc.trim(),
        reason: addSimReason.trim(),
      });
      onShowNotice('تمت إضافة المعاملة المحاكاة وحفظها في سجل التدقيق.', 'success');
      const targetId = addSimUserId;
      setAddSimOpen(false);
      await loadData();
      await refreshInspectedUserIfOpen(targetId);
      onDataChanged?.();
    } catch (err) {
      onShowNotice(err instanceof Error ? err.message : 'تعذر إضافة المعاملة المحاكاة.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleLogoutAdmin = async () => {
    await logoutAdmin();
    onShowNotice('تم تسجيل خروج المسؤول بنجاح.', 'success');
    onAdminLoggedOut();
  };

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.phone.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [data, userSearch]);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    const q = recordSearch.trim().toLowerCase();
    return data.walletRecords.filter((rec) => {
      if (recordKindFilter !== 'all' && rec.recordKind !== recordKindFilter) return false;
      if (visibilityFilter !== 'all' && rec.visibilityStatus !== visibilityFilter) return false;
      if (!q) return true;
      return (
        rec.recordId.toLowerCase().includes(q) ||
        rec.userId.toLowerCase().includes(q) ||
        rec.userPhone.toLowerCase().includes(q) ||
        rec.userName.toLowerCase().includes(q) ||
        rec.phoneNumber.toLowerCase().includes(q) ||
        rec.description.toLowerCase().includes(q) ||
        rec.referenceCode.toLowerCase().includes(q)
      );
    });
  }, [data, recordSearch, recordKindFilter, visibilityFilter]);

  const inspectedRecordHistory = useMemo(() => {
    if (!data || !inspectedRecord) return [];
    return data.recordHistory.filter(
      (h) => h.recordId === inspectedRecord.recordId && h.recordKind === inspectedRecord.recordKind
    );
  }, [data, inspectedRecord]);

  return (
    <div className="animate-view-enter min-h-full bg-[#F4F5F7] pb-10">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="رجوع"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4.5 w-4.5 text-[#E60000] shrink-0" aria-hidden="true" />
                <h1 className="text-sm font-extrabold text-slate-900 truncate">لوحة الإدارة المركزية</h1>
              </div>
              <p dir="ltr" className="text-right text-[10px] text-slate-500 truncate">
                {adminEmail || 'Admin'} {expiresAt ? `· ينتهي ${formatDateTime(expiresAt).time}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadData()}
              aria-label="تحديث البيانات"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogoutAdmin()}
              aria-label="تسجيل خروج المسؤول"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-rose-50 px-2.5 text-[11px] font-bold text-[#E60000] hover:bg-rose-100 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* 4 Dashboard Section Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { id: 'overview' as const, label: 'نظرة عامة' },
            { id: 'users' as const, label: 'المستخدمون' },
            { id: 'records' as const, label: 'المعاملات' },
            { id: 'audit' as const, label: 'التدقيق' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[34px] rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="rounded-2xl bg-white p-8 text-center text-xs font-semibold text-slate-500 shadow-xs">
            جاري تحميل بيانات الإدارة من قاعدة البيانات...
          </div>
        )}

        {data && (
          <>
            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">إجمالي المستخدمين</span>
                      <Users className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 font-mono-tabular text-2xl font-black text-slate-900">
                      {data.stats.totalUsers}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">المستخدمون النشطون</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 font-mono-tabular text-2xl font-black text-emerald-700">
                      {data.stats.activeUsers}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">المستخدمون المخفيون</span>
                      <EyeOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 font-mono-tabular text-2xl font-black text-amber-700">
                      {data.stats.hiddenUsers}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">السجلات المحاكاة</span>
                      <Database className="h-4 w-4 text-[#007385]" aria-hidden="true" />
                    </div>
                    <p className="mt-1.5 font-mono-tabular text-2xl font-black text-slate-900">
                      {data.stats.totalWalletRecords}
                    </p>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500">إجمالي السجلات المستوردة</p>
                      <p className="mt-1 font-mono-tabular text-2xl font-black text-[#E60000]">
                        {data.stats.totalImportedRecords}
                      </p>
                    </div>
                    <div className="text-left">
                      <Activity className="mr-auto h-5 w-5 text-[#007385]" aria-hidden="true" />
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {data.stats.suspendedUsers} موقوف · {data.stats.totalImportBatches} دفعة استيراد
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Administrative Activity */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold text-slate-900">النشاط الإداري الأخير</h2>
                    <button
                      type="button"
                      onClick={() => setTab('audit')}
                      className="text-[11px] font-bold text-[#E60000] hover:underline cursor-pointer"
                    >
                      عرض الكل
                    </button>
                  </div>
                  {data.auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">لا يوجد نشاط مسجل بعد.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {data.auditLogs.slice(0, 6).map((log) => (
                        <li key={log.id} className="py-2 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <span className="text-[10px] text-slate-500">
                              {formatDateTime(log.createdAt).full}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{log.actorLabel}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {/* USERS TAB */}
            {tab === 'users' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="بحث برقم الموبايل أو معرف المستخدم أو الاسم..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-xs font-semibold text-slate-900 focus:border-[#E60000] focus:outline-none"
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <p className="rounded-2xl bg-white p-6 text-center text-xs text-slate-500">
                    لا توجد نتائج مطابقة لبحثك.
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-extrabold text-slate-900">{u.displayName}</p>
                            {u.role === 'admin' && (
                              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                ADMIN الوحيد
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                u.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {u.status === 'active' ? 'نشط' : 'موقوف'}
                            </span>
                            {u.isHidden && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                حساب مخفي
                              </span>
                            )}
                            {u.adminVerified && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">
                                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                                <span>موثّق إدارياً</span>
                              </span>
                            )}
                          </div>
                          <p dir="ltr" className="text-right font-mono-tabular text-xs font-bold text-slate-700">
                            {formatPhoneNumber(u.phone)}
                          </p>
                          <p dir="ltr" className="text-right font-mono-tabular text-[10px] text-slate-400">
                            ID: {u.id}
                          </p>
                        </div>

                        <div className="text-left shrink-0">
                          <p dir="ltr" className="font-mono-tabular text-sm font-black text-[#E60000]">
                            {formatCurrency(u.walletBalance)} EGP
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {u.walletTransactionsCount} معاملة · {u.importedCount} مستورد
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenUserDetail(u.id)}
                          disabled={inspectLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                        >
                          <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>فحص كل التفاصيل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStatusReason('');
                            setPendingUserAction({
                              user: u,
                              mode: 'verify',
                              nextVerified: !u.adminVerified,
                            });
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                            u.adminVerified
                              ? 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{u.adminVerified ? 'إلغاء التحقق' : 'تحقق من الحساب'}</span>
                        </button>

                        {u.role !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setStatusReason('');
                                setPendingUserAction({
                                  user: u,
                                  mode: 'hide',
                                  nextHidden: !u.isHidden,
                                });
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                                u.isHidden
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                              }`}
                            >
                              {u.isHidden ? (
                                <>
                                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>استعادة المخفي</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>إخفاء الحساب</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStatusReason('');
                                setPendingUserAction({
                                  user: u,
                                  mode: 'status',
                                  nextStatus: u.status === 'active' ? 'suspended' : 'active',
                                });
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                                u.status === 'active'
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>إيقاف الحساب</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>إعادة التفعيل</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* WALLET RECORDS TAB */}
            {tab === 'records' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={recordSearch}
                        onChange={(e) => setRecordSearch(e.target.value)}
                        placeholder="بحث بالمعرف، رقم الهاتف، الوصف، أو المستخدم..."
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-xs font-semibold text-slate-900 focus:border-[#E60000] focus:bg-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddSimulated()}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-[#E60000] px-3 text-[11px] font-bold text-white hover:bg-[#C80000] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>إضافة محاكاة</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all' as const, label: 'كل الأنواع' },
                      { id: 'simulated_wallet_tx' as const, label: 'معاملات المحفظة' },
                      { id: 'imported_record' as const, label: 'المستوردة' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setRecordKindFilter(f.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          recordKindFilter === f.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {[
                      { id: 'all' as const, label: 'كل الحالات' },
                      { id: 'visible' as const, label: 'الظاهرة' },
                      { id: 'hidden' as const, label: 'المخفية' },
                      { id: 'archived' as const, label: 'المؤرشفة' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVisibilityFilter(v.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          visibilityFilter === v.id
                            ? 'bg-[#E60000] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredRecords.length === 0 ? (
                  <p className="rounded-2xl bg-white p-6 text-center text-xs text-slate-500">
                    لا توجد معاملات تطابق معايير التصفية الحالية.
                  </p>
                ) : (
                  filteredRecords.map((rec) => (
                    <div
                      key={`${rec.recordKind}-${rec.userId}-${rec.recordId}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                rec.recordKind === 'simulated_wallet_tx'
                                  ? 'bg-cyan-100 text-[#006B7D]'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {rec.recordKind === 'simulated_wallet_tx' ? 'معاملة محفظة' : 'سجل مستورد'}
                            </span>
                            {visibilityBadge(rec.visibilityStatus)}
                            {rec.adminVerified ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">
                                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                                <span>تم التحقق</span>
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                لم يُتحقق منه
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-extrabold text-slate-900">{rec.description}</p>
                          <p className="text-[11px] text-slate-500">
                            {rec.userName} ({rec.userPhone || rec.userId}) · {rec.phoneNumber || 'بدون رقم'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatDateTime(rec.timestamp).full} · ID: {rec.recordId}
                          </p>
                          {rec.adminNote && (
                            <p className="text-[10px] font-semibold text-sky-700">
                              ملاحظة التحقق: {rec.adminNote}
                            </p>
                          )}
                        </div>

                        <div className="text-left shrink-0">
                          <span dir="ltr" className="font-mono-tabular text-sm font-black text-[#006B7D]">
                            {formatCurrency(rec.amount)} EGP
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => setInspectedRecord(rec)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                        >
                          <History className="h-3 w-3" aria-hidden="true" />
                          <span>التفاصيل والأصل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setVerifyNote(rec.adminNote || '');
                            setVerifyReason('');
                            setPendingVerifyRecord({
                              recordKind: rec.recordKind,
                              recordId: rec.recordId,
                              userId: rec.userId,
                              nextVerified: !rec.adminVerified,
                              description: rec.description,
                            });
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer ${
                            rec.adminVerified
                              ? 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          <span>{rec.adminVerified ? 'إلغاء التحقق' : 'تحقق'}</span>
                        </button>

                        {rec.isSimulated && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditRecord(rec)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                            <span>تعديل</span>
                          </button>
                        )}

                        {rec.visibilityStatus === 'hidden' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: rec.recordKind,
                                recordId: rec.recordId,
                                userId: rec.userId,
                                action: 'restore_hidden',
                                label: 'استعادة معاملة مخفية',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>استعادة المخفي</span>
                          </button>
                        ) : (
                          rec.visibilityStatus === 'visible' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVisibilityReason('');
                                setPendingVisibility({
                                  recordKind: rec.recordKind,
                                  recordId: rec.recordId,
                                  userId: rec.userId,
                                  action: 'hide',
                                  label: 'إخفاء المعاملة',
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                            >
                              <EyeOff className="h-3 w-3" aria-hidden="true" />
                              <span>إخفاء</span>
                            </button>
                          )
                        )}

                        {rec.visibilityStatus === 'archived' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: rec.recordKind,
                                recordId: rec.recordId,
                                userId: rec.userId,
                                action: 'restore_archived',
                                label: 'استعادة من الأرشيف',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                          >
                            <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
                            <span>فك الأرشفة</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: rec.recordKind,
                                recordId: rec.recordId,
                                userId: rec.userId,
                                action: 'archive',
                                label: 'أرشفة المعاملة',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                          >
                            <Archive className="h-3 w-3" aria-hidden="true" />
                            <span>أرشفة</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteReason('');
                            setPendingDeleteRecord({
                              recordKind: rec.recordKind,
                              recordId: rec.recordId,
                              userId: rec.userId,
                              description: rec.description,
                              amount: rec.amount,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          <span>إزالة</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* AUDIT & CHANGE HISTORY TAB */}
            {tab === 'audit' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAuditSubTab('history')}
                    className={`min-h-[34px] rounded-lg text-xs font-bold cursor-pointer ${
                      auditSubTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    سجل تغييرات السجلات ({data.recordHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSubTab('logs')}
                    className={`min-h-[34px] rounded-lg text-xs font-bold cursor-pointer ${
                      auditSubTab === 'logs' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    التدقيق الأمني ({data.auditLogs.length})
                  </button>
                </div>

                {auditSubTab === 'history' ? (
                  <section className="space-y-2.5">
                    {data.recordHistory.length === 0 ? (
                      <p className="rounded-2xl bg-white p-6 text-center text-xs text-slate-500">
                        لا توجد تعديلات إدارية مسجلة على السجلات بعد.
                      </p>
                    ) : (
                      data.recordHistory.map((h) => (
                        <div
                          key={h.id}
                          className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${
                                h.action === 'DELETE'
                                  ? 'bg-rose-700'
                                  : h.action === 'VERIFY'
                                    ? 'bg-sky-700'
                                    : 'bg-slate-900'
                              }`}
                            >
                              {h.action}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatDateTime(h.createdAt).full}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900">
                            السجل: <span dir="ltr" className="font-mono-tabular">{h.recordId}</span> · الحقل: {h.fieldName}
                          </p>
                          <p className="text-[11px] text-slate-700">
                            <span className="font-bold">السبب:</span> {h.reason}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            المسؤول: <span dir="ltr" className="font-mono-tabular">{h.adminId}</span>
                          </p>
                          <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-slate-50 p-2.5 text-[10px] font-mono-tabular">
                            <div dir="ltr" className="text-left text-rose-700 break-all">
                              Prev: {JSON.stringify(h.previousValue)}
                            </div>
                            <div dir="ltr" className="text-left text-emerald-700 break-all">
                              New: {JSON.stringify(h.newValue)}
                            </div>
                            <div dir="ltr" className="text-left text-slate-600 break-all">
                              Original Snapshot: {JSON.stringify(h.originalSnapshot)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <ul className="divide-y divide-slate-100 text-xs">
                      {data.auditLogs.map((log) => (
                        <li key={log.id} className="py-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <span className="text-[10px] text-slate-500">
                              {formatDateTime(log.createdAt).full}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{log.actorLabel}</p>
                          <p dir="ltr" className="text-left font-mono-tabular text-[10px] text-slate-400 break-all">
                            {JSON.stringify(log.details)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal 1: Individual User Profile Inspector */}
      {inspectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4"
          onClick={() => setInspectedUser(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-4 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  فحص الحساب: {inspectedUser.user.displayName}
                </h3>
                <p dir="ltr" className="text-right font-mono-tabular text-[11px] text-slate-500">
                  {inspectedUser.user.phone} · {inspectedUser.user.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-500">رصيد المحفظة</p>
                <p dir="ltr" className="text-right font-mono-tabular font-black text-[#E60000]">
                  {formatCurrency(inspectedUser.wallet.balance)} EGP
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">رصيد الخط</p>
                <p dir="ltr" className="text-right font-mono-tabular font-bold text-slate-900">
                  {formatCurrency(inspectedUser.wallet.lineBalance)} EGP
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">رقم المحفظة</p>
                <p dir="ltr" className="text-right font-mono-tabular font-semibold text-slate-800">
                  {inspectedUser.wallet.accountNumber}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">الشريحة SIM والتحقق</p>
                <p className="font-semibold text-slate-800">
                  {inspectedUser.user.simCarrier || 'غير محدد'} ·{' '}
                  {inspectedUser.user.adminVerified ? 'حساب موثّق' : 'قيد المراجعة'}
                </p>
              </div>
            </div>

            {/* User Wallet Transactions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">
                  سجل معاملات المحفظة ({inspectedUser.walletTransactions.length})
                </h4>
                <button
                  type="button"
                  onClick={() => handleOpenAddSimulated(inspectedUser.user.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#E60000] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#C80000] cursor-pointer"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>إضافة محاكاة</span>
                </button>
              </div>
              {inspectedUser.walletTransactions.length === 0 ? (
                <p className="text-[11px] text-slate-500">لا توجد معاملات محفظة.</p>
              ) : (
                <div className="space-y-2">
                  {inspectedUser.walletTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-900">{tx.description}</span>
                        <div className="flex items-center gap-1">
                          {visibilityBadge(tx.visibilityStatus ?? 'visible')}
                          {tx.adminVerified && (
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">
                              موثّقة
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span dir="ltr" className="font-mono-tabular font-bold text-[#E60000]">
                          {formatCurrency(tx.amount)} EGP
                        </span>
                        <span>{tx.phoneNumber}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyNote(tx.adminNote || '');
                            setVerifyReason('');
                            setPendingVerifyRecord({
                              recordKind: 'simulated_wallet_tx',
                              recordId: tx.id,
                              userId: inspectedUser.user.id,
                              nextVerified: !tx.adminVerified,
                              description: tx.description,
                            });
                          }}
                          className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                        >
                          {tx.adminVerified ? 'إلغاء التحقق' : 'تحقق'}
                        </button>
                        {tx.visibilityStatus === 'hidden' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: 'simulated_wallet_tx',
                                recordId: tx.id,
                                userId: inspectedUser.user.id,
                                action: 'restore_hidden',
                                label: 'استعادة معاملة مخفية',
                              });
                            }}
                            className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 cursor-pointer"
                          >
                            استعادة المخفي
                          </button>
                        ) : (
                          tx.visibilityStatus !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVisibilityReason('');
                                setPendingVisibility({
                                  recordKind: 'simulated_wallet_tx',
                                  recordId: tx.id,
                                  userId: inspectedUser.user.id,
                                  action: 'hide',
                                  label: 'إخفاء المعاملة',
                                });
                              }}
                              className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 cursor-pointer"
                            >
                              إخفاء
                            </button>
                          )
                        )}
                        {tx.visibilityStatus === 'archived' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: 'simulated_wallet_tx',
                                recordId: tx.id,
                                userId: inspectedUser.user.id,
                                action: 'restore_archived',
                                label: 'فك أرشفة المعاملة',
                              });
                            }}
                            className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 cursor-pointer"
                          >
                            استعادة المؤرشف
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: 'simulated_wallet_tx',
                                recordId: tx.id,
                                userId: inspectedUser.user.id,
                                action: 'archive',
                                label: 'أرشفة المعاملة',
                              });
                            }}
                            className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 cursor-pointer"
                          >
                            أرشفة
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteReason('');
                            setPendingDeleteRecord({
                              recordKind: 'simulated_wallet_tx',
                              recordId: tx.id,
                              userId: inspectedUser.user.id,
                              description: tx.description,
                              amount: tx.amount,
                            });
                          }}
                          className="rounded bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 cursor-pointer"
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User Imported Records */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                السجلات المستوردة ({inspectedUser.importedRecords.length})
              </h4>
              {inspectedUser.importedRecords.length === 0 ? (
                <p className="text-[11px] text-slate-500">لا توجد سجلات مستوردة لهذا المستخدم.</p>
              ) : (
                <div className="space-y-2">
                  {inspectedUser.importedRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-900">{rec.description}</span>
                        <div className="flex items-center gap-1">
                          {visibilityBadge(rec.visibilityStatus ?? 'visible')}
                          {rec.adminVerified && (
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">
                              موثّقة
                            </span>
                          )}
                        </div>
                      </div>
                      <p dir="ltr" className="text-right font-mono-tabular text-[11px] font-bold text-[#006B7D]">
                        {formatCurrency(rec.amount)} EGP · {rec.phoneNumber || '—'}
                      </p>
                      <p className="rounded bg-slate-50 p-1.5 text-[10px] text-slate-600 break-all">
                        النص الأصلي: {rec.originalSourceText}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyNote(rec.adminNote || '');
                            setVerifyReason('');
                            setPendingVerifyRecord({
                              recordKind: 'imported_record',
                              recordId: rec.id,
                              userId: inspectedUser.user.id,
                              nextVerified: !rec.adminVerified,
                              description: rec.description,
                            });
                          }}
                          className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                        >
                          {rec.adminVerified ? 'إلغاء التحقق' : 'تحقق'}
                        </button>
                        {rec.visibilityStatus === 'hidden' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisibilityReason('');
                              setPendingVisibility({
                                recordKind: 'imported_record',
                                recordId: rec.id,
                                userId: inspectedUser.user.id,
                                action: 'restore_hidden',
                                label: 'استعادة سجل مخفي',
                              });
                            }}
                            className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 cursor-pointer"
                          >
                            استعادة المخفي
                          </button>
                        ) : (
                          rec.visibilityStatus !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVisibilityReason('');
                                setPendingVisibility({
                                  recordKind: 'imported_record',
                                  recordId: rec.id,
                                  userId: inspectedUser.user.id,
                                  action: 'hide',
                                  label: 'إخفاء السجل',
                                });
                              }}
                              className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 cursor-pointer"
                            >
                              إخفاء
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteReason('');
                            setPendingDeleteRecord({
                              recordKind: 'imported_record',
                              recordId: rec.id,
                              userId: inspectedUser.user.id,
                              description: rec.description,
                              amount: rec.amount,
                            });
                          }}
                          className="rounded bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 cursor-pointer"
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Record Details & Original Info + Change History */}
      {inspectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setInspectedRecord(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">تفاصيل المعاملة والأصل المحفوظ</h3>
              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">المعرف</dt>
                <dd dir="ltr" className="font-mono-tabular font-bold">{inspectedRecord.recordId}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">المبلغ الحالي</dt>
                <dd dir="ltr" className="font-mono-tabular font-bold text-[#E60000]">
                  {formatCurrency(inspectedRecord.amount)} EGP
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">التحقق الإداري</dt>
                <dd className="font-bold text-slate-900">
                  {inspectedRecord.adminVerified ? 'تم التحقق والتوثيق' : 'لم يتم التحقق بعد'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">حالة الرؤية</dt>
                <dd>{visibilityBadge(inspectedRecord.visibilityStatus)}</dd>
              </div>
              <div className="py-2 space-y-1">
                <dt className="text-slate-500">المصدر / النص الأصلي (محفوظ)</dt>
                <dd className="rounded-xl bg-slate-50 p-2.5 text-[11px] font-semibold text-slate-800 break-all">
                  {inspectedRecord.originalSourceText}
                </dd>
              </div>
              {inspectedRecord.originalSnapshot && (
                <div className="py-2 space-y-1">
                  <dt className="text-slate-500">اللقطة الأصلية (Original Snapshot)</dt>
                  <dd
                    dir="ltr"
                    className="rounded-xl bg-slate-50 p-2.5 text-left font-mono-tabular text-[10px] text-slate-700 break-all"
                  >
                    {JSON.stringify(inspectedRecord.originalSnapshot)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-slate-100 pt-2.5 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                سجل التعديلات الإدارية ({inspectedRecordHistory.length})
              </h4>
              {inspectedRecordHistory.length === 0 ? (
                <p className="text-[11px] text-slate-500">لم يتم إجراء أي تعديلات إدارية على هذا السجل.</p>
              ) : (
                <ul className="space-y-2 text-[11px]">
                  {inspectedRecordHistory.map((h) => (
                    <li key={h.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{h.action}</span>
                        <span>{formatDateTime(h.createdAt).full}</span>
                      </div>
                      <p className="text-slate-700">السبب: {h.reason}</p>
                      <p dir="ltr" className="text-left font-mono-tabular text-[10px] text-slate-500 break-all">
                        {JSON.stringify(h.previousValue)} {'->'} {JSON.stringify(h.newValue)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Confirm User Status or Verification */}
      {pendingUserAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingUserAction(null)}
        >
          <div
            className="w-full max-w-[390px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              {pendingUserAction.mode === 'hide'
                ? pendingUserAction.nextHidden
                  ? `إخفاء حساب (${pendingUserAction.user.phone})`
                  : `استعادة حساب (${pendingUserAction.user.phone})`
                : pendingUserAction.mode === 'verify'
                  ? pendingUserAction.nextVerified
                    ? `التحقق وتوثيق الحساب (${pendingUserAction.user.phone})`
                    : `إلغاء توثيق الحساب (${pendingUserAction.user.phone})`
                  : pendingUserAction.nextStatus === 'suspended'
                    ? `إيقاف حساب (${pendingUserAction.user.phone})`
                    : `إعادة تفعيل حساب (${pendingUserAction.user.phone})`}
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              {pendingUserAction.mode === 'hide'
                ? pendingUserAction.nextHidden
                  ? 'سيتم إخفاء هذا الحساب من القوائم الاعتيادية دون حذف أي سجل أو معاملة تابعة له، ويمكن استعادته لاحقاً.'
                  : 'سيتم إظهار الحساب مجدداً في القوائم الاعتيادية.'
                : pendingUserAction.mode === 'verify'
                  ? 'سيتم تحديث حالة التحقق الإداري لهذا الحساب وحفظ القرار في سجل التدقيق.'
                  : pendingUserAction.nextStatus === 'suspended'
                    ? 'سيتم إنهاء جميع جلسات هذا المستخدم ومنعه من تسجيل الدخول مؤقتاً مع الاحتفاظ بكافة سجلاته.'
                    : 'سيستعيد المستخدم القدرة على تسجيل الدخول والوصول إلى محفظته.'}
            </p>
            <div>
              <label htmlFor="admin-status-reason" className="block text-xs font-bold text-slate-700">
                سبب الإجراء (مطلوب للتدقيق)
              </label>
              <input
                id="admin-status-reason"
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="مثال: مراجعة وتحقق إداري"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs focus:border-[#E60000] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingUserAction(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleConfirmUserAction()}
                className="min-h-[40px] rounded-xl bg-[#E60000] text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري التنفيذ...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Confirm Hide / Archive / Restore Visibility */}
      {pendingVisibility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingVisibility(null)}
        >
          <div
            className="w-full max-w-[390px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900">{pendingVisibility.label}</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              يتم إخفاء أو أرشفة المعاملة عن واجهة المستخدم دون حذفها نهائياً، مع إمكانية استعادتها في أي وقت وتسجيل الإجراء في سجل التغييرات.
            </p>
            <div>
              <label htmlFor="admin-vis-reason" className="block text-xs font-bold text-slate-700">
                سبب الإجراء (مطلوب)
              </label>
              <input
                id="admin-vis-reason"
                type="text"
                value={visibilityReason}
                onChange={(e) => setVisibilityReason(e.target.value)}
                placeholder="مثال: إخفاء معاملة غير مطابقة"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs focus:border-[#E60000] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingVisibility(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleConfirmVisibility()}
                className="min-h-[40px] rounded-xl bg-slate-900 text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري التنفيذ...' : 'تأكيد الإجراء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Verify / Unverify Record */}
      {pendingVerifyRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingVerifyRecord(null)}
        >
          <div
            className="w-full max-w-[390px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              {pendingVerifyRecord.nextVerified ? 'التحقق من المعاملة' : 'إلغاء التحقق من المعاملة'}
            </h3>
            <p className="text-xs font-semibold text-slate-700">{pendingVerifyRecord.description}</p>
            <div>
              <label htmlFor="admin-verify-note" className="block text-xs font-bold text-slate-700">
                ملاحظة المراجعة الإدارية (اختياري)
              </label>
              <input
                id="admin-verify-note"
                type="text"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="مثال: تمت مطابقة الإيصال والمرجع"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs focus:border-[#E60000] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="admin-verify-reason" className="block text-xs font-bold text-slate-700">
                سبب القرار (للتدقيق)
              </label>
              <input
                id="admin-verify-reason"
                type="text"
                value={verifyReason}
                onChange={(e) => setVerifyReason(e.target.value)}
                placeholder="مثال: فحص إداري مكتمل"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs focus:border-[#E60000] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingVerifyRecord(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleConfirmVerifyRecord()}
                className="min-h-[40px] rounded-xl bg-slate-900 text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري الحفظ...' : 'تأكيد التحقق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Confirm Remove / Delete Record */}
      {pendingDeleteRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setPendingDeleteRecord(null)}
        >
          <div
            className="w-full max-w-[390px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-rose-700">إزالة المعاملة</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              سيتم إزالة المعاملة «{pendingDeleteRecord.description}» ({formatCurrency(pendingDeleteRecord.amount)} EGP) من سجل المستخدم، مع حفظ نسخة كاملة من بياناتها في سجل التدقيق الدائم.
            </p>
            <div>
              <label htmlFor="admin-delete-reason" className="block text-xs font-bold text-slate-700">
                سبب الإزالة (مطلوب)
              </label>
              <input
                id="admin-delete-reason"
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="مثال: معاملة مكررة أو غير صالحة"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs focus:border-[#E60000] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingDeleteRecord(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleConfirmDeleteRecord()}
                className="min-h-[40px] rounded-xl bg-[#E60000] text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري الإزالة...' : 'تأكيد الإزالة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Edit Eligible Simulated Record Metadata */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900">تعديل بيانات المعاملة</h3>
            <p className="rounded-xl bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-900">
              تظل النسخة الأصلية (Original Snapshot) محفوظة ولا تُمس، ويُسجل التعديل مع السبب ووقت التنفيذ.
            </p>
            <div>
              <label htmlFor="edit-rec-amount" className="block text-xs font-bold text-slate-700">
                المبلغ (EGP)
              </label>
              <input
                id="edit-rec-amount"
                type="number"
                step="0.01"
                dir="ltr"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-right font-mono-tabular text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-rec-desc" className="block text-xs font-bold text-slate-700">
                الوصف
              </label>
              <input
                id="edit-rec-desc"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="edit-rec-phone" className="block text-xs font-bold text-slate-700">
                رقم الهاتف
              </label>
              <input
                id="edit-rec-phone"
                type="text"
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-right font-mono-tabular text-xs"
              />
            </div>
            {editingRecord.recordKind === 'imported_record' && (
              <div>
                <label htmlFor="edit-rec-ref" className="block text-xs font-bold text-slate-700">
                  الرقم المرجعي
                </label>
                <input
                  id="edit-rec-ref"
                  type="text"
                  dir="ltr"
                  value={editReferenceCode}
                  onChange={(e) => setEditReferenceCode(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-right font-mono-tabular text-xs"
                />
              </div>
            )}
            <div>
              <label htmlFor="edit-rec-reason" className="block text-xs font-bold text-slate-700">
                سبب التعديل (مطلوب)
              </label>
              <input
                id="edit-rec-reason"
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="مثال: تصحيح وصف أو رقم مرجعي"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleSaveRecordMetadata()}
                className="min-h-[40px] rounded-xl bg-[#E60000] text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal 8: Add Simulated Wallet Transaction */}
      {addSimOpen && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setAddSimOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-extrabold text-slate-900">إضافة معاملة محاكاة</h3>
            <p className="rounded-xl bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-900">
              تُضاف هذه المعاملة بوسم محاكاة صريح (isSimulated) ولا تُعد نشاطاً مالياً حقيقياً موثقاً.
            </p>
            <div>
              <label htmlFor="add-sim-user" className="block text-xs font-bold text-slate-700">
                حساب المستخدم
              </label>
              <select
                id="add-sim-user"
                value={addSimUserId}
                onChange={(e) => setAddSimUserId(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="add-sim-type" className="block text-xs font-bold text-slate-700">
                  نوع المعاملة
                </label>
                <select
                  id="add-sim-type"
                  value={addSimType}
                  onChange={(e) =>
                    setAddSimType(e.target.value as 'send' | 'receive' | 'withdraw' | 'deposit')
                  }
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold"
                >
                  <option value="send">تحويل صادر</option>
                  <option value="receive">استلام وارد</option>
                  <option value="deposit">إيداع</option>
                  <option value="withdraw">سحب ATM</option>
                </select>
              </div>
              <div>
                <label htmlFor="add-sim-amount" className="block text-xs font-bold text-slate-700">
                  المبلغ (EGP)
                </label>
                <input
                  id="add-sim-amount"
                  type="number"
                  step="0.01"
                  dir="ltr"
                  value={addSimAmount}
                  onChange={(e) => setAddSimAmount(e.target.value)}
                  placeholder="250"
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-right font-mono-tabular text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="add-sim-phone" className="block text-xs font-bold text-slate-700">
                رقم الطرف المقابل
              </label>
              <input
                id="add-sim-phone"
                type="text"
                dir="ltr"
                value={addSimPhone}
                onChange={(e) => setAddSimPhone(e.target.value)}
                placeholder="01012345678"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-right font-mono-tabular text-xs"
              />
            </div>
            <div>
              <label htmlFor="add-sim-desc" className="block text-xs font-bold text-slate-700">
                الوصف
              </label>
              <input
                id="add-sim-desc"
                type="text"
                value={addSimDesc}
                onChange={(e) => setAddSimDesc(e.target.value)}
                placeholder="مثال: تحويل تجريبي للعرض"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs"
              />
            </div>
            <div>
              <label htmlFor="add-sim-reason" className="block text-xs font-bold text-slate-700">
                سبب الإنشاء (مطلوب للتدقيق)
              </label>
              <input
                id="add-sim-reason"
                type="text"
                value={addSimReason}
                onChange={(e) => setAddSimReason(e.target.value)}
                placeholder="مثال: إضافة معاملة محاكاة للاختبار"
                className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddSimOpen(false)}
                className="min-h-[40px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => void handleSaveNewSimulatedTx()}
                className="min-h-[40px] rounded-xl bg-[#E60000] text-xs font-bold text-white cursor-pointer"
              >
                {submittingAction ? 'جاري الإضافة...' : 'إضافة المعاملة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
