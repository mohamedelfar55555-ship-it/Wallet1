export type TransactionType = 'send' | 'receive' | 'withdraw' | 'deposit';

export type TransactionStatus = 'completed' | 'pending' | 'failed';

export type OperationMode = 'send' | 'receive' | 'withdraw' | 'deposit' | 'inquiry';

export type RecordVisibilityStatus = 'visible' | 'hidden' | 'archived';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  phoneNumber: string;
  timestamp: string; // ISO 8601 date-time string
  status: TransactionStatus;
  description: string;
  fee?: number;
  receiptNumber?: string;
  counterpartyName?: string;
  isSimulated?: boolean;
  visibilityStatus?: RecordVisibilityStatus;
  adminVerified?: boolean;
  adminVerifiedAt?: string;
  adminNote?: string;
  originalSnapshot?: {
    amount: number;
    phoneNumber: string;
    description: string;
    counterpartyName?: string;
    timestamp: string;
  };
}

export interface WalletAccount {
  accountNumber: string;
  holderName: string;
  balance: number;
  currency: 'EGP';
}

export interface WalletState {
  account: WalletAccount;
  transactions: Transaction[];
  version: number;
}

export interface OperationPayload {
  type: TransactionType;
  amount: number;
  phoneNumber: string;
  description: string;
}

export interface OperationResult {
  success: boolean;
  error?: string;
  transaction?: Transaction;
  nextState?: WalletState;
}

// ==========================================
// Part 1: Android SIM & User Auth Types
// ==========================================

export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface SimSubscriptionInfo {
  subscriptionId: number;
  slotIndex: number; // 0 = SIM 1, 1 = SIM 2
  carrierName: string;
  displayName: string;
  mccMnc?: string;
  countryIso?: string;
  phoneNumber?: string;
  phoneNumberSource: 'carrier' | 'hidden_by_os' | 'manual';
  isDefaultSms?: boolean;
  isDefaultData?: boolean;
}

export interface DeviceSimCapabilityReport {
  platform: 'android-capacitor' | 'web-pwa';
  nativeSimApiAvailable: boolean;
  permissionStatus: 'granted' | 'prompt' | 'denied' | 'unsupported_browser';
  subscriptions: SimSubscriptionInfo[];
  reasonMessage: string;
}

export interface DemoUserProfile {
  id: string;
  phone: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  preferredSimSlot: number | null;
  simCarrier: string | null;
  simOperator: string | null;
  simDetectedNumber: string | null;
  adminVerified?: boolean;
  adminVerifiedAt?: string | null;
  isHidden?: boolean;
  hiddenAt?: string | null;
  createdAt: string;
  lastLoginAt: string;
}

// ==========================================
// Part 2 & 3: Smart Data Import Engine Types
// ==========================================

export type ImportedSourceType =
  | 'clipboard'
  | 'shared_text'
  | 'screenshot_ocr'
  | 'csv'
  | 'json'
  | 'excel'
  | 'manual';

export type ImportedTransactionType = TransactionType | 'other';

export interface ImportedWalletRecord {
  id: string;
  userId: string;
  batchId: string;
  originalSourceText: string; // Immutable raw source preserved for auditability
  transactionType: ImportedTransactionType;
  amount: number;
  phoneNumber: string;
  txTimestamp: string;
  description: string;
  referenceCode: string;
  sourceType: ImportedSourceType;
  importTimestamp: string;
  verificationStatus: 'unverified_demo';
  visibilityStatus?: RecordVisibilityStatus;
  isSimulated?: boolean;
  adminVerified?: boolean;
  adminVerifiedAt?: string | null;
  adminNote?: string | null;
  fingerprintHash: string;
  updatedAt: string;
}

export interface ParsedTransactionCandidate {
  tempId: string;
  originalSourceText: string;
  transactionType: ImportedTransactionType;
  amount: number | null;
  phoneNumber: string;
  txTimestamp: string;
  description: string;
  referenceCode: string;
  sourceType: ImportedSourceType;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  isDuplicate?: boolean;
  selected: boolean;
}

export interface ImportBatchSummary {
  id: string;
  userId: string;
  sourceType: ImportedSourceType;
  fileName: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  status: 'completed' | 'partial' | 'failed';
  createdAt: string;
}

// ==========================================
// Part 5: Admin & Audit Types
// ==========================================

export interface AdminUserSummary extends DemoUserProfile {
  walletBalance: number;
  lineBalance: number;
  walletTransactionsCount: number;
  importedCount: number;
  lastImportAt: string | null;
}

export interface AdminWalletRecordItem {
  recordKind: 'simulated_wallet_tx' | 'imported_record';
  recordId: string;
  userId: string;
  userPhone: string;
  userName: string;
  transactionType: string;
  amount: number;
  phoneNumber: string;
  description: string;
  referenceCode: string;
  timestamp: string;
  sourceType: string;
  originalSourceText: string;
  verificationStatus: 'simulated' | 'unverified_demo';
  visibilityStatus: RecordVisibilityStatus;
  isSimulated: boolean;
  adminVerified?: boolean;
  adminVerifiedAt?: string | null;
  adminNote?: string | null;
  originalSnapshot?: Record<string, unknown> | null;
}

export interface RecordChangeHistoryEntry {
  id: string;
  recordKind: 'simulated_wallet_tx' | 'imported_record';
  recordId: string;
  targetUserId: string;
  action:
    | 'CREATE'
    | 'HIDE'
    | 'RESTORE_HIDDEN'
    | 'ARCHIVE'
    | 'RESTORE_ARCHIVED'
    | 'METADATA_EDIT'
    | 'VERIFY'
    | 'UNVERIFY'
    | 'DELETE';
  fieldName: string;
  previousValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  originalSnapshot: Record<string, unknown>;
  adminId: string;
  reason: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorLabel: string;
  action: string;
  targetUserId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuthStatus {
  configured: boolean;
  sessionAuthenticated: boolean;
  adminEmailHint?: string;
  expiresAt?: string;
  admin?: {
    id: string;
    email: string;
    displayName: string;
  };
}

export interface AdminUserDetailData {
  user: AdminUserSummary;
  wallet: {
    accountNumber: string;
    holderName: string;
    balance: number;
    lineBalance: number;
    billAmount: number;
    billPaid: boolean;
    address: string;
    biometricEnabled: boolean;
    updatedAt: string;
  };
  walletTransactions: Transaction[];
  importedRecords: ImportedWalletRecord[];
  changeHistory: RecordChangeHistoryEntry[];
  auditLogs: AuditLogEntry[];
}

export interface AdminOverviewData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    hiddenUsers: number;
    totalWalletRecords: number;
    totalImportedRecords: number;
    totalImportBatches: number;
  };
  users: AdminUserSummary[];
  recentBatches: ImportBatchSummary[];
  recentRecords: ImportedWalletRecord[];
  walletRecords: AdminWalletRecordItem[];
  recordHistory: RecordChangeHistoryEntry[];
  auditLogs: AuditLogEntry[];
}
