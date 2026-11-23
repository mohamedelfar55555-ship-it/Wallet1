import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INITIAL_DEMO_STATE } from '../src/data/demoData.ts';
import type {
  AccountStatus,
  AdminUserSummary,
  AuditLogEntry,
  DemoUserProfile,
  ImportBatchSummary,
  ImportedSourceType,
  ImportedTransactionType,
  ImportedWalletRecord,
  RecordChangeHistoryEntry,
  RecordVisibilityStatus,
  Transaction,
  UserRole,
  WalletState,
} from '../src/types/wallet.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.WALLET_DB_PATH
  ? path.resolve(process.env.WALLET_DB_PATH)
  : path.join(DATA_DIR, 'demo_wallet.db');

let dbInstance: DatabaseSync | null = null;

export function getSingleAdminEmail(): string {
  const configured =
    process.env.ADMIN_EMAIL ||
    (process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',')[0] : '') ||
    'Mohamed.elfar55555@gmail.com';
  return configured.trim().toLowerCase();
}

export function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPasswordScrypt(password: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPasswordScrypt(password, salt), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function constantTimeSecretEquals(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function ensureColumnExists(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      preferred_sim_slot INTEGER,
      sim_carrier TEXT,
      sim_operator TEXT,
      sim_detected_number TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      admin_user_id TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      claimed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      email TEXT,
      code_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      provider TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 1000.0,
      line_balance REAL NOT NULL DEFAULT 42.5,
      bill_amount REAL NOT NULL DEFAULT 225.0,
      bill_paid INTEGER NOT NULL DEFAULT 1,
      address TEXT NOT NULL DEFAULT 'القاهرة، مصر',
      biometric_enabled INTEGER NOT NULL DEFAULT 1,
      transactions_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      imported_count INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS imported_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      original_source_text TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      phone_number TEXT NOT NULL,
      tx_timestamp TEXT NOT NULL,
      description TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      source_type TEXT NOT NULL,
      import_timestamp TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'unverified_demo',
      visibility_status TEXT NOT NULL DEFAULT 'visible',
      is_simulated INTEGER NOT NULL DEFAULT 1,
      hidden_at TEXT,
      archived_at TEXT,
      fingerprint_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_imported_user_time
      ON imported_records (user_id, import_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_imported_fingerprint
      ON imported_records (user_id, fingerprint_hash);

    CREATE TABLE IF NOT EXISTS record_change_history (
      id TEXT PRIMARY KEY,
      record_kind TEXT NOT NULL,
      record_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT NOT NULL,
      previous_value_json TEXT NOT NULL,
      new_value_json TEXT NOT NULL,
      original_snapshot_json TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_record_history_time
      ON record_change_history (created_at DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_label TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Safe migrations for pre-existing SQLite files
  ensureColumnExists(db, 'users', 'admin_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumnExists(db, 'users', 'admin_verified_at', 'TEXT');
  ensureColumnExists(db, 'users', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumnExists(db, 'users', 'hidden_at', 'TEXT');
  ensureColumnExists(db, 'imported_records', 'visibility_status', "TEXT NOT NULL DEFAULT 'visible'");
  ensureColumnExists(db, 'imported_records', 'is_simulated', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumnExists(db, 'imported_records', 'hidden_at', 'TEXT');
  ensureColumnExists(db, 'imported_records', 'archived_at', 'TEXT');
  ensureColumnExists(db, 'imported_records', 'admin_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumnExists(db, 'imported_records', 'admin_verified_at', 'TEXT');
  ensureColumnExists(db, 'imported_records', 'admin_note', 'TEXT');

  seedSingleAdminUser(db);

  // Ensure strictly ONE administrator user row exists in users table
  db.prepare(`UPDATE users SET role = 'user' WHERE role = 'admin' AND id != 'usr_demo_admin_01'`).run();
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_single_admin_user
      ON users(role) WHERE role = 'admin';
  `);

  dbInstance = db;
  return db;
}

function seedSingleAdminUser(db: DatabaseSync): void {
  const adminId = 'usr_demo_admin_01';
  const adminEmail = getSingleAdminEmail();
  const existing = db.prepare('SELECT id FROM users WHERE id = ? OR role = ?').get(adminId, 'admin') as
    | { id: string }
    | undefined;
  if (existing) return;

  const adminPhone = '01020227288';
  const now = new Date().toISOString();

  // If phone was already registered as a normal user, upgrade that single account cleanly
  const byPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(adminPhone) as
    | { id: string }
    | undefined;
  if (byPhone) {
    db.prepare(`UPDATE users SET role = 'admin', email = ?, status = 'active' WHERE id = ?`).run(
      adminEmail,
      byPhone.id
    );
    return;
  }

  db.prepare(
    `INSERT INTO users (id, phone, email, display_name, role, status, preferred_sim_slot, sim_carrier, sim_operator, created_at, last_login_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', 0, 'Vodafone EG (SIM 1)', '60202', ?, ?)`
  ).run(adminId, adminPhone, adminEmail, 'المسؤول الرئيسي', now, now);

  db.prepare(
    `INSERT INTO wallets (user_id, account_number, holder_name, balance, line_balance, bill_amount, bill_paid, address, biometric_enabled, transactions_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    adminId,
    INITIAL_DEMO_STATE.account.accountNumber,
    INITIAL_DEMO_STATE.account.holderName,
    INITIAL_DEMO_STATE.account.balance,
    60.4,
    240.0,
    1,
    'المعادي، القاهرة',
    1,
    JSON.stringify(
      INITIAL_DEMO_STATE.transactions.map((t) => ({
        ...t,
        isSimulated: true,
        visibilityStatus: 'visible',
      }))
    ),
    now
  );
}

export function getAdminUserRow(db: DatabaseSync): DemoUserProfile {
  const row = db.prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`).get() as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    seedSingleAdminUser(db);
    return getAdminUserRow(db);
  }
  return mapUserRow(row);
}

export function mapUserRow(row: Record<string, unknown>): DemoUserProfile {
  return {
    id: String(row.id),
    phone: String(row.phone),
    email: row.email ? String(row.email) : null,
    displayName: String(row.display_name),
    role: (row.role === 'admin' ? 'admin' : 'user') as UserRole,
    status: (row.status === 'suspended' ? 'suspended' : 'active') as AccountStatus,
    preferredSimSlot:
      typeof row.preferred_sim_slot === 'number' ? row.preferred_sim_slot : null,
    simCarrier: row.sim_carrier ? String(row.sim_carrier) : null,
    simOperator: row.sim_operator ? String(row.sim_operator) : null,
    simDetectedNumber: row.sim_detected_number ? String(row.sim_detected_number) : null,
    adminVerified: Boolean(row.admin_verified),
    adminVerifiedAt: row.admin_verified_at ? String(row.admin_verified_at) : null,
    isHidden: Boolean(row.is_hidden),
    hiddenAt: row.hidden_at ? String(row.hidden_at) : null,
    createdAt: String(row.created_at),
    lastLoginAt: String(row.last_login_at),
  };
}

export function normalizeStoredTransactions(rawList: unknown[]): Transaction[] {
  return rawList.map((raw) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const vis =
      item.visibilityStatus === 'hidden' || item.visibilityStatus === 'archived'
        ? item.visibilityStatus
        : 'visible';
    return {
      ...(item as unknown as Transaction),
      isSimulated: item.isSimulated !== false,
      visibilityStatus: vis,
      adminVerified: Boolean(item.adminVerified),
      adminVerifiedAt: item.adminVerifiedAt ? String(item.adminVerifiedAt) : undefined,
      adminNote: item.adminNote ? String(item.adminNote) : undefined,
    };
  });
}

export function mergeWalletTransactionsPreservingAdminStates(
  existingRaw: Transaction[],
  incomingVisible: Transaction[],
  adminDeletedTxIds: Set<string> = new Set()
): Transaction[] {
  const existingMap = new Map(existingRaw.map((t) => [t.id, t]));
  const merged: Transaction[] = [];
  const seenIds = new Set<string>();

  for (const tx of incomingVisible) {
    if (adminDeletedTxIds.has(tx.id)) continue;
    const existing = existingMap.get(tx.id);
    if (existing && existing.visibilityStatus && existing.visibilityStatus !== 'visible') {
      // Preserve admin-hidden/archived transaction state cleanly
      merged.push(existing);
    } else {
      merged.push({
        ...tx,
        isSimulated: existing?.isSimulated ?? tx.isSimulated ?? true,
        visibilityStatus: existing?.visibilityStatus ?? 'visible',
        adminVerified: existing?.adminVerified ?? tx.adminVerified ?? false,
        adminVerifiedAt: existing?.adminVerifiedAt ?? tx.adminVerifiedAt,
        adminNote: existing?.adminNote ?? tx.adminNote,
        originalSnapshot: existing?.originalSnapshot ?? tx.originalSnapshot,
      });
    }
    seenIds.add(tx.id);
  }

  // Keep any server-held hidden or archived simulated records so user sync never deletes them
  for (const existing of existingRaw) {
    if (
      !seenIds.has(existing.id) &&
      !adminDeletedTxIds.has(existing.id) &&
      existing.visibilityStatus &&
      existing.visibilityStatus !== 'visible'
    ) {
      merged.push(existing);
    }
  }

  return merged.slice(0, 300);
}

export function ensureWalletForUser(
  db: DatabaseSync,
  user: DemoUserProfile,
  includeAllVisibility = false
): {
  walletState: WalletState;
  lineBalance: number;
  billAmount: number;
  billPaid: boolean;
  address: string;
  biometricEnabled: boolean;
  updatedAt: string;
} {
  const row = db
    .prepare('SELECT * FROM wallets WHERE user_id = ?')
    .get(user.id) as Record<string, unknown> | undefined;

  if (row) {
    let parsedTxs: Transaction[] = [];
    try {
      const candidate = JSON.parse(String(row.transactions_json));
      if (Array.isArray(candidate)) {
        parsedTxs = normalizeStoredTransactions(candidate);
      }
    } catch {
      parsedTxs = [];
    }
    const filteredTxs = includeAllVisibility
      ? parsedTxs
      : parsedTxs.filter((tx) => (tx.visibilityStatus ?? 'visible') === 'visible');

    return {
      walletState: {
        version: 8,
        account: {
          accountNumber: String(row.account_number),
          holderName: String(row.holder_name),
          balance: Number(row.balance),
          currency: 'EGP',
        },
        transactions: filteredTxs,
      },
      lineBalance: Number(row.line_balance),
      billAmount: Number(row.bill_amount),
      billPaid: Boolean(row.bill_paid),
      address: String(row.address),
      biometricEnabled: Boolean(row.biometric_enabled),
      updatedAt: String(row.updated_at),
    };
  }

  const now = new Date().toISOString();
  const starterTransactions: Transaction[] = [
    {
      id: `VFC-${now.slice(0, 10).replace(/-/g, '')}-100001`,
      type: 'deposit',
      amount: 1500.0,
      fee: 0,
      receiptNumber: '0259000100001',
      counterpartyName: user.displayName,
      phoneNumber: user.phone,
      timestamp: now,
      status: 'completed',
      description: 'رصيد ترحيبي للحساب',
      isSimulated: true,
      visibilityStatus: 'visible',
    },
  ];

  db.prepare(
    `INSERT INTO wallets (user_id, account_number, holder_name, balance, line_balance, bill_amount, bill_paid, address, biometric_enabled, transactions_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id,
    user.phone,
    user.displayName,
    1500.0,
    45.0,
    180.0,
    1,
    'القاهرة، مصر',
    1,
    JSON.stringify(starterTransactions),
    now
  );

  return {
    walletState: {
      version: 8,
      account: {
        accountNumber: user.phone,
        holderName: user.displayName,
        balance: 1500.0,
        currency: 'EGP',
      },
      transactions: starterTransactions,
    },
    lineBalance: 45.0,
    billAmount: 180.0,
    billPaid: true,
    address: 'القاهرة، مصر',
    biometricEnabled: true,
    updatedAt: now,
  };
}

export function mapImportedRecordRow(row: Record<string, unknown>): ImportedWalletRecord {
  const rawVis = String(row.visibility_status || 'visible');
  const visibilityStatus: RecordVisibilityStatus =
    rawVis === 'hidden' || rawVis === 'archived' ? rawVis : 'visible';

  return {
    id: String(row.id),
    userId: String(row.user_id),
    batchId: String(row.batch_id),
    originalSourceText: String(row.original_source_text),
    transactionType: String(row.transaction_type) as ImportedTransactionType,
    amount: Number(row.amount),
    phoneNumber: String(row.phone_number),
    txTimestamp: String(row.tx_timestamp),
    description: String(row.description),
    referenceCode: String(row.reference_code),
    sourceType: String(row.source_type) as ImportedSourceType,
    importTimestamp: String(row.import_timestamp),
    verificationStatus: 'unverified_demo',
    visibilityStatus,
    isSimulated: row.is_simulated !== 0,
    adminVerified: Boolean(row.admin_verified),
    adminVerifiedAt: row.admin_verified_at ? String(row.admin_verified_at) : null,
    adminNote: row.admin_note ? String(row.admin_note) : null,
    fingerprintHash: String(row.fingerprint_hash),
    updatedAt: String(row.updated_at),
  };
}

export function mapBatchRow(row: Record<string, unknown>): ImportBatchSummary {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourceType: String(row.source_type) as ImportedSourceType,
    fileName: String(row.file_name),
    totalRows: Number(row.total_rows),
    importedCount: Number(row.imported_count),
    duplicateCount: Number(row.duplicate_count),
    errorCount: Number(row.error_count),
    status: (String(row.status) as ImportBatchSummary['status']) || 'completed',
    createdAt: String(row.created_at),
  };
}

export function writeAuditLog(
  db: DatabaseSync,
  actorUserId: string,
  actorLabel: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>
): void {
  const id = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_label, action, target_user_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    actorUserId,
    actorLabel,
    action,
    targetUserId,
    JSON.stringify(details),
    new Date().toISOString()
  );
}

export function writeRecordChangeHistory(
  db: DatabaseSync,
  params: {
    recordKind: 'simulated_wallet_tx' | 'imported_record';
    recordId: string;
    targetUserId: string;
    action: RecordChangeHistoryEntry['action'];
    fieldName: string;
    previousValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    originalSnapshot: Record<string, unknown>;
    adminId: string;
    reason: string;
  }
): RecordChangeHistoryEntry {
  const id = `RCH-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO record_change_history (
      id, record_kind, record_id, target_user_id, action, field_name,
      previous_value_json, new_value_json, original_snapshot_json, admin_id, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.recordKind,
    params.recordId,
    params.targetUserId,
    params.action,
    params.fieldName,
    JSON.stringify(params.previousValue),
    JSON.stringify(params.newValue),
    JSON.stringify(params.originalSnapshot),
    params.adminId,
    params.reason,
    createdAt
  );

  return {
    id,
    recordKind: params.recordKind,
    recordId: params.recordId,
    targetUserId: params.targetUserId,
    action: params.action,
    fieldName: params.fieldName,
    previousValue: params.previousValue,
    newValue: params.newValue,
    originalSnapshot: params.originalSnapshot,
    adminId: params.adminId,
    reason: params.reason,
    createdAt,
  };
}

export function mapRecordChangeHistoryRow(row: Record<string, unknown>): RecordChangeHistoryEntry {
  const safeJson = (raw: unknown): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(String(raw ?? '{}'));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  return {
    id: String(row.id),
    recordKind:
      String(row.record_kind) === 'simulated_wallet_tx' ? 'simulated_wallet_tx' : 'imported_record',
    recordId: String(row.record_id),
    targetUserId: String(row.target_user_id),
    action: String(row.action) as RecordChangeHistoryEntry['action'],
    fieldName: String(row.field_name),
    previousValue: safeJson(row.previous_value_json),
    newValue: safeJson(row.new_value_json),
    originalSnapshot: safeJson(row.original_snapshot_json),
    adminId: String(row.admin_id),
    reason: String(row.reason),
    createdAt: String(row.created_at),
  };
}

export function mapAuditRow(row: Record<string, unknown>): AuditLogEntry {
  let details: Record<string, unknown> = {};
  try {
    details = JSON.parse(String(row.details_json));
  } catch {
    details = {};
  }
  return {
    id: String(row.id),
    actorUserId: String(row.actor_user_id),
    actorLabel: String(row.actor_label),
    action: String(row.action),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    details,
    createdAt: String(row.created_at),
  };
}

export function getAdminUserSummaries(db: DatabaseSync): AdminUserSummary[] {
  const rows = db
    .prepare(
      `SELECT u.*,
        COALESCE(w.balance, 0) AS wallet_balance,
        COALESCE(w.line_balance, 0) AS line_balance,
        w.transactions_json AS transactions_json,
        (SELECT COUNT(*) FROM imported_records r WHERE r.user_id = u.id) AS imported_count,
        (SELECT MAX(import_timestamp) FROM imported_records r WHERE r.user_id = u.id) AS last_import_at
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       ORDER BY u.last_login_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => {
    let walletTransactionsCount = 0;
    try {
      const parsed = JSON.parse(String(row.transactions_json || '[]'));
      if (Array.isArray(parsed)) walletTransactionsCount = parsed.length;
    } catch {
      walletTransactionsCount = 0;
    }
    return {
      ...mapUserRow(row),
      walletBalance: Number(row.wallet_balance || 0),
      lineBalance: Number(row.line_balance || 0),
      walletTransactionsCount,
      importedCount: Number(row.imported_count || 0),
      lastImportAt: row.last_import_at ? String(row.last_import_at) : null,
    };
  });
}
