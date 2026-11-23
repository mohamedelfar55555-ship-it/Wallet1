import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  constantTimeSecretEquals,
  ensureWalletForUser,
  getAdminUserRow,
  getAdminUserSummaries,
  getDb,
  getSingleAdminEmail,
  hashPasswordScrypt,
  mapAuditRow,
  mapBatchRow,
  mapImportedRecordRow,
  mapRecordChangeHistoryRow,
  mapUserRow,
  mergeWalletTransactionsPreservingAdminStates,
  normalizeStoredTransactions,
  verifyPasswordScrypt,
  writeAuditLog,
  writeRecordChangeHistory,
} from './server/db.ts';
import {
  dispatchOtpViaAuthorizedProvider,
  generateSixDigitOtp,
  hashOtpCode,
  verifyOtpHash,
} from './server/otpProvider.ts';
import type {
  AdminWalletRecordItem,
  DemoUserProfile,
  ImportedSourceType,
  ImportedTransactionType,
  RecordVisibilityStatus,
  Transaction,
  WalletState,
} from './src/types/wallet.ts';

const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE_NAME = 'vfc_demo_session';
const ADMIN_COOKIE_NAME = 'vfc_admin_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4-hour expiring administrator session
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const otpRateMap = new Map<string, { count: number; windowStart: number }>();
const adminAuthRateMap = new Map<string, { count: number; windowStart: number }>();

interface AuthedRequest extends Request {
  authUser?: DemoUserProfile;
  authTokenHash?: string;
  adminActor?: DemoUserProfile;
  adminTokenHash?: string;
  adminSessionExpiresAt?: string;
}

function hashToken(rawToken: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(rawToken).digest('hex');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function extractAdminToken(req: Request): string | null {
  const adminHeader = req.headers['x-admin-authorization'];
  if (typeof adminHeader === 'string' && adminHeader.startsWith('Bearer ')) {
    const token = adminHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ADMIN_COOKIE_NAME] || null;
}

function setSessionCookie(
  res: Response,
  name: string,
  rawToken: string,
  maxAgeMs: number,
  req?: Request
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const forwardedProto = String(req?.headers['x-forwarded-proto'] || '').toLowerCase();
  const isHttps = Boolean(req?.secure || forwardedProto.includes('https'));
  res.cookie(name, rawToken, {
    httpOnly: true,
    sameSite: isProd && isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: maxAgeMs,
    path: '/',
  });
}

function clearSessionCookie(res: Response, name: string): void {
  res.clearCookie(name, { path: '/' });
}

function getConfiguredEnvAdminPassword(): string {
  return (process.env.ADMIN_ACCESS_PASSWORD || '').trim();
}

function isSameOriginMutationAllowed(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  if (typeof req.headers['x-admin-authorization'] === 'string') return true;
  if (typeof req.headers.authorization === 'string') return true;
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!origin || !host) return true;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === String(host).split(',')[0].trim();
  } catch {
    return false;
  }
}

function normalizePhone(input: unknown): string {
  return String(input ?? '').replace(/\D/g, '').slice(0, 15);
}

function isValidEgyptianMobile(digits: string): boolean {
  return /^01[0125]\d{8}$/.test(digits);
}

function sanitizeText(input: unknown, maxLen: number): string {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function neutralizeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  const safe = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

function computeFingerprint(
  amount: number,
  phone: string,
  txTimestamp: string,
  referenceCode: string,
  originalSource: string
): string {
  const normalized = [
    amount.toFixed(2),
    phone.replace(/\D/g, ''),
    txTimestamp.slice(0, 16),
    referenceCode.trim().toUpperCase(),
    referenceCode.trim() ? '' : originalSource.trim().slice(0, 120),
  ].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!isSameOriginMutationAllowed(req)) {
    res.status(403).json({ error: 'تم رفض الطلب لعدم تطابق المصدر.' });
    return;
  }
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول للمتابعة.' });
    return;
  }
  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(401).json({ error: 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.' });
    return;
  }

  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    clearSessionCookie(res, SESSION_COOKIE_NAME);
    res.status(401).json({ error: 'انتهت صلاحية الجلسة.' });
    return;
  }

  const user = mapUserRow(row);
  if (user.status === 'suspended') {
    res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      error: 'هذا الحساب موقوف حالياً من قِبل الإدارة.',
    });
    return;
  }

  req.authUser = user;
  req.authTokenHash = tokenHash;
  next();
}

function requireAdminSession(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!isSameOriginMutationAllowed(req)) {
    res.status(403).json({ error: 'تم رفض طلب الإدارة لعدم تطابق المصدر.' });
    return;
  }
  const token = extractAdminToken(req);
  if (!token) {
    res.status(401).json({ error: 'جلسة المسؤول مطلوبة للوصول إلى لوحة التحكم.' });
    return;
  }
  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS admin_expires_at
       FROM admin_sessions s
       JOIN users u ON u.id = s.admin_user_id
       WHERE s.token_hash = ? AND u.role = 'admin'`
    )
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) {
    clearSessionCookie(res, ADMIN_COOKIE_NAME);
    res.status(403).json({ error: 'صلاحيات المسؤول غير صالحة أو منتهية.' });
    return;
  }

  const expiresMs = new Date(String(row.admin_expires_at)).getTime();
  if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    clearSessionCookie(res, ADMIN_COOKIE_NAME);
    res.status(401).json({ error: 'انتهت صلاحية جلسة المسؤول. يرجى إعادة تسجيل الدخول.' });
    return;
  }

  db.prepare('UPDATE admin_sessions SET last_active_at = ? WHERE token_hash = ?').run(
    new Date().toISOString(),
    tokenHash
  );

  req.adminActor = mapUserRow(row);
  req.adminTokenHash = tokenHash;
  req.adminSessionExpiresAt = String(row.admin_expires_at);
  next();
}

function checkAdminAuthRateLimit(req: Request): boolean {
  const ipKey = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const nowMs = Date.now();
  const entry = adminAuthRateMap.get(ipKey);
  if (entry && nowMs - entry.windowStart < 15 * 60 * 1000) {
    if (entry.count >= 8) return false;
    entry.count += 1;
  } else {
    adminAuthRateMap.set(ipKey, { count: 1, windowStart: nowMs });
  }
  return true;
}

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.warn(
      '[security] SESSION_SECRET is not set; using ephemeral secret (sessions will reset on container restart).'
    );
  }
  const db = getDb();
  const app = express();
  app.set('trust proxy', 1);

  const capacitorOrigins = new Set([
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
  ]);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const reqOrigin = req.headers.origin;
    if (typeof reqOrigin === 'string' && capacitorOrigins.has(reqOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Admin-Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: 'demo-simulation', timestamp: new Date().toISOString() });
  });

  app.get('/downloads/wallet-project-github-ready.zip', (_req, res) => {
    const zipPath = path.resolve(process.cwd(), 'exports', 'wallet-project-github-ready.zip');
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'حزمة المشروع المضغوطة غير موجودة.' });
      return;
    }
    res.download(zipPath, 'wallet-project-github-ready.zip');
  });

  // ==========================================
  // PART 1B: Ordinary User Phone Registration & OTP Auth
  // ==========================================

  app.post('/api/auth/request-otp', async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const email = sanitizeText(req.body?.email, 120).toLowerCase() || null;
      const displayName = sanitizeText(req.body?.displayName, 60);

      if (!isValidEgyptianMobile(phone)) {
        res.status(400).json({
          error: 'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقماً (010 / 011 / 012 / 015).',
        });
        return;
      }

      const nowMs = Date.now();
      const rate = otpRateMap.get(phone);
      if (rate && nowMs - rate.windowStart < 10 * 60 * 1000) {
        if (rate.count >= 6) {
          res.status(429).json({ error: 'تم تجاوز عدد محاولات طلب الرمز. يرجى الانتظار دقائق.' });
          return;
        }
        rate.count += 1;
      } else {
        otpRateMap.set(phone, { count: 1, windowStart: nowMs });
      }

      const existingUserRow = db
        .prepare('SELECT * FROM users WHERE phone = ?')
        .get(phone) as Record<string, unknown> | undefined;

      if (existingUserRow && existingUserRow.status === 'suspended') {
        res.status(403).json({
          code: 'ACCOUNT_SUSPENDED',
          error: 'هذا الحساب موقوف حالياً من الإدارة ولا يمكن تسجيل الدخول إليه.',
        });
        return;
      }

      const code = generateSixDigitOtp();
      const salt = crypto.randomBytes(16).toString('hex');
      const codeHash = hashOtpCode(code, salt);
      const challengeId = `otp_${crypto.randomBytes(10).toString('hex')}`;
      const expiresAt = new Date(nowMs + 5 * 60 * 1000).toISOString();
      const dispatch = await dispatchOtpViaAuthorizedProvider(phone, code);

      db.prepare(
        `INSERT INTO otp_challenges (id, phone, email, code_hash, salt, provider, attempts, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(
        challengeId,
        phone,
        email,
        codeHash,
        salt,
        dispatch.provider,
        expiresAt,
        new Date().toISOString()
      );

      res.json({
        challengeId,
        phone,
        displayNameHint: displayName || (existingUserRow ? String(existingUserRow.display_name) : ''),
        provider: dispatch.provider,
        message: dispatch.message,
        demoOtpPreview: dispatch.demoOtpPreview,
        expiresInSeconds: 300,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق.',
      });
    }
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const challengeId = sanitizeText(req.body?.challengeId, 80);
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code ?? '').replace(/\D/g, '');
    const requestedName = sanitizeText(req.body?.displayName, 60);
    const requestedEmail = sanitizeText(req.body?.email, 120).toLowerCase() || null;

    if (!challengeId || !isValidEgyptianMobile(phone) || code.length !== 6) {
      res.status(400).json({ error: 'بيانات التحقق غير مكتملة (يرجى إدخال 6 أرقام).' });
      return;
    }

    const challenge = db
      .prepare('SELECT * FROM otp_challenges WHERE id = ? AND phone = ?')
      .get(challengeId, phone) as Record<string, unknown> | undefined;

    if (!challenge) {
      res.status(400).json({ error: 'جلسة رمز التحقق غير صالحة.' });
      return;
    }
    if (challenge.consumed_at) {
      res.status(400).json({ error: 'تم استخدام هذا الرمز بالفعل. اطلب رمزاً جديداً.' });
      return;
    }
    if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
      res.status(400).json({ error: 'انتهت صلاحية رمز التحقق.' });
      return;
    }
    if (Number(challenge.attempts) >= 5) {
      res.status(429).json({ error: 'تم قفل الرمز لكثرة المحاولات الخاطئة. اطلب رمزاً جديداً.' });
      return;
    }

    const ok = verifyOtpHash(code, String(challenge.salt), String(challenge.code_hash));
    if (!ok) {
      db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(challengeId);
      res.status(401).json({ error: 'رمز التحقق غير صحيح.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ?').run(now, challengeId);

    const existingRow = db
      .prepare('SELECT * FROM users WHERE phone = ?')
      .get(phone) as Record<string, unknown> | undefined;

    const challengeEmail = challenge.email ? String(challenge.email).toLowerCase() : requestedEmail;

    let user: DemoUserProfile;
    if (existingRow) {
      if (existingRow.status === 'suspended') {
        res.status(403).json({
          code: 'ACCOUNT_SUSPENDED',
          error: 'هذا الحساب موقوف حالياً من الإدارة.',
        });
        return;
      }
      // OTP login never promotes a user to admin; existing single admin keeps role in DB
      const nextEmail = challengeEmail || (existingRow.email ? String(existingRow.email) : null);
      const nextName = requestedName || String(existingRow.display_name);

      db.prepare(
        `UPDATE users SET last_login_at = ?, email = ?, display_name = ? WHERE id = ?`
      ).run(now, nextEmail, nextName, String(existingRow.id));

      const updatedRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(String(existingRow.id)) as Record<string, unknown>;
      user = { ...mapUserRow(updatedRow), role: 'user' };
    } else {
      const newUserId = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const finalName = requestedName || `مستخدم ${phone.slice(-4)}`;

      db.prepare(
        `INSERT INTO users (id, phone, email, display_name, role, status, created_at, last_login_at)
         VALUES (?, ?, ?, ?, 'user', 'active', ?, ?)`
      ).run(newUserId, phone, challengeEmail, finalName, now, now);

      const createdRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(newUserId) as Record<string, unknown>;
      user = mapUserRow(createdRow);
    }

    const walletBundle = ensureWalletForUser(db, user, false);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const sessionExpires = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    db.prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(tokenHash, user.id, sessionExpires, now);

    writeAuditLog(db, user.id, `${user.displayName} (${user.phone})`, 'AUTH_OTP_LOGIN', user.id, {
      provider: challenge.provider,
    });

    setSessionCookie(res, SESSION_COOKIE_NAME, rawToken, SESSION_TTL_MS, req);
    res.json({
      authenticated: true,
      sessionToken: rawToken,
      user,
      ...walletBundle,
    });
  });

  app.get('/api/auth/session', (req: AuthedRequest, res) => {
    const token = extractSessionToken(req);
    if (!token) {
      res.json({ authenticated: false });
      return;
    }
    const tokenHash = hashToken(token);
    const row = db
      .prepare(
        `SELECT u.*, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!row || new Date(String(row.expires_at)).getTime() < Date.now()) {
      if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      clearSessionCookie(res, SESSION_COOKIE_NAME);
      res.json({ authenticated: false });
      return;
    }

    const user = { ...mapUserRow(row), role: 'user' as const };
    if (user.status === 'suspended') {
      res.status(403).json({
        authenticated: false,
        code: 'ACCOUNT_SUSPENDED',
        error: 'تم إيقاف هذا الحساب من الإدارة.',
      });
      return;
    }

    const walletBundle = ensureWalletForUser(db, user, false);
    res.json({
      authenticated: true,
      user,
      ...walletBundle,
    });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    const token = extractSessionToken(req);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    }
    clearSessionCookie(res, SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });

  app.patch('/api/auth/sim-preference', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const slot =
      typeof req.body?.preferredSimSlot === 'number' &&
      (req.body.preferredSimSlot === 0 || req.body.preferredSimSlot === 1)
        ? req.body.preferredSimSlot
        : null;
    const carrier = sanitizeText(req.body?.simCarrier, 80) || null;
    const operator = sanitizeText(req.body?.simOperator, 20) || null;
    const detectedNumber = normalizePhone(req.body?.simDetectedNumber) || null;

    db.prepare(
      `UPDATE users SET preferred_sim_slot = ?, sim_carrier = ?, sim_operator = ?, sim_detected_number = ? WHERE id = ?`
    ).run(slot, carrier, operator, detectedNumber, user.id);

    const updated = {
      ...mapUserRow(
        db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>
      ),
      role: 'user' as const,
    };
    res.json({ user: updated });
  });

  // ==========================================
  // User-Isolated Demo Wallet & Imported Records
  // ==========================================

  app.put('/api/wallet', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const walletState = req.body?.walletState as WalletState | undefined;
    if (!walletState || !walletState.account || !Array.isArray(walletState.transactions)) {
      res.status(400).json({ error: 'بيانات المحفظة غير صالحة.' });
      return;
    }

    const existingWallet = db
      .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
      .get(user.id) as { transactions_json?: string } | undefined;

    let existingTxs: Transaction[] = [];
    if (existingWallet?.transactions_json) {
      try {
        const parsed = JSON.parse(existingWallet.transactions_json);
        if (Array.isArray(parsed)) existingTxs = normalizeStoredTransactions(parsed);
      } catch {
        existingTxs = [];
      }
    }

    const deletedRows = db
      .prepare(
        `SELECT record_id FROM record_change_history
         WHERE record_kind = 'simulated_wallet_tx' AND target_user_id = ? AND action = 'DELETE'`
      )
      .all(user.id) as Array<{ record_id: string }>;
    const adminDeletedTxIds = new Set(deletedRows.map((r) => r.record_id));

    const mergedTransactions = mergeWalletTransactionsPreservingAdminStates(
      existingTxs,
      walletState.transactions,
      adminDeletedTxIds
    );

    const lineBalance = Number(req.body?.lineBalance ?? 0);
    const billAmount = Number(req.body?.billAmount ?? 0);
    const billPaid = req.body?.billPaid ? 1 : 0;
    const address = sanitizeText(req.body?.address, 140) || 'القاهرة، مصر';
    const biometricEnabled = req.body?.biometricEnabled === false ? 0 : 1;

    db.prepare(
      `UPDATE wallets
       SET holder_name = ?, balance = ?, line_balance = ?, bill_amount = ?, bill_paid = ?, address = ?, biometric_enabled = ?, transactions_json = ?, updated_at = ?
       WHERE user_id = ?`
    ).run(
      sanitizeText(walletState.account.holderName, 60) || user.displayName,
      Number(Number(walletState.account.balance).toFixed(2)),
      Number(lineBalance.toFixed(2)),
      Number(billAmount.toFixed(2)),
      billPaid,
      address,
      biometricEnabled,
      JSON.stringify(mergedTransactions),
      new Date().toISOString(),
      user.id
    );

    res.json({ ok: true });
  });

  app.get('/api/imports/records', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const records = db
      .prepare(
        `SELECT * FROM imported_records
         WHERE user_id = ? AND visibility_status = 'visible'
         ORDER BY import_timestamp DESC`
      )
      .all(user.id) as Array<Record<string, unknown>>;
    const batches = db
      .prepare('SELECT * FROM import_batches WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(user.id) as Array<Record<string, unknown>>;

    res.json({
      records: records.map(mapImportedRecordRow),
      batches: batches.map(mapBatchRow),
    });
  });

  app.post('/api/imports/batch', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const sourceType = sanitizeText(req.body?.sourceType, 30) as ImportedSourceType;
    const fileName = sanitizeText(req.body?.fileName, 120) || 'manual-import';
    const items = Array.isArray(req.body?.records) ? req.body.records : [];

    const allowedSources = new Set([
      'clipboard',
      'shared_text',
      'screenshot_ocr',
      'csv',
      'json',
      'excel',
      'manual',
    ]);
    if (!allowedSources.has(sourceType)) {
      res.status(400).json({ error: 'مصدر الاستيراد غير مدعوم.' });
      return;
    }
    if (items.length === 0 || items.length > 500) {
      res.status(400).json({ error: 'يجب أن يحتوي الاستيراد على سجل واحد إلى 500 سجل كحد أقصى.' });
      return;
    }

    const batchId = `BAT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const existingRows = db
      .prepare('SELECT fingerprint_hash FROM imported_records WHERE user_id = ?')
      .all(user.id) as Array<{ fingerprint_hash: string }>;
    const existingFingerprints = new Set(existingRows.map((r) => r.fingerprint_hash));

    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const insertedRecords: ReturnType<typeof mapImportedRecordRow>[] = [];

    const insertStmt = db.prepare(
      `INSERT INTO imported_records (
        id, user_id, batch_id, original_source_text, transaction_type, amount,
        phone_number, tx_timestamp, description, reference_code, source_type,
        import_timestamp, verification_status, visibility_status, is_simulated, fingerprint_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified_demo', 'visible', 1, ?, ?)`
    );

    const allowedTypes = new Set(['send', 'receive', 'withdraw', 'deposit', 'other']);

    for (const raw of items) {
      const amount = Number(raw?.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
        errorCount += 1;
        continue;
      }
      const txType = allowedTypes.has(String(raw?.transactionType))
        ? (String(raw.transactionType) as ImportedTransactionType)
        : 'other';
      const originalSource = sanitizeText(raw?.originalSourceText, 2000) || 'إدخال يدوي';
      const phone = sanitizeText(raw?.phoneNumber, 30);
      const txTimestamp = sanitizeText(raw?.txTimestamp, 40) || now;
      const description = sanitizeText(raw?.description, 240) || 'معاملة مستوردة';
      const referenceCode = sanitizeText(raw?.referenceCode, 80);

      const fingerprint = computeFingerprint(
        amount,
        phone,
        txTimestamp,
        referenceCode,
        originalSource
      );

      if (existingFingerprints.has(fingerprint)) {
        duplicateCount += 1;
        continue;
      }
      existingFingerprints.add(fingerprint);

      const recordId = `IMP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      insertStmt.run(
        recordId,
        user.id,
        batchId,
        originalSource,
        txType,
        Number(amount.toFixed(2)),
        phone,
        txTimestamp,
        description,
        referenceCode,
        sourceType,
        now,
        fingerprint,
        now
      );

      const createdRow = db
        .prepare('SELECT * FROM imported_records WHERE id = ?')
        .get(recordId) as Record<string, unknown>;
      insertedRecords.push(mapImportedRecordRow(createdRow));
      importedCount += 1;
    }

    const batchStatus = importedCount > 0 ? (errorCount > 0 ? 'partial' : 'completed') : 'failed';
    db.prepare(
      `INSERT INTO import_batches (id, user_id, source_type, file_name, total_rows, imported_count, duplicate_count, error_count, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      batchId,
      user.id,
      sourceType,
      fileName,
      items.length,
      importedCount,
      duplicateCount,
      errorCount,
      batchStatus,
      now
    );

    writeAuditLog(db, user.id, `${user.displayName} (${user.phone})`, 'IMPORT_BATCH', user.id, {
      batchId,
      sourceType,
      fileName,
      importedCount,
      duplicateCount,
      errorCount,
    });

    res.json({
      batch: {
        id: batchId,
        userId: user.id,
        sourceType,
        fileName,
        totalRows: items.length,
        importedCount,
        duplicateCount,
        errorCount,
        status: batchStatus,
        createdAt: now,
      },
      insertedRecords,
    });
  });

  app.patch('/api/imports/records/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const id = sanitizeText(req.params.id, 80);
    const existing = db
      .prepare('SELECT * FROM imported_records WHERE id = ? AND user_id = ?')
      .get(id, user.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'السجل غير موجود أو لا ينتمي لهذا الحساب.' });
      return;
    }

    const amount = Number(req.body?.amount ?? existing.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'المبلغ غير صالح.' });
      return;
    }

    const allowedTypes = new Set(['send', 'receive', 'withdraw', 'deposit', 'other']);
    const txType = allowedTypes.has(String(req.body?.transactionType))
      ? String(req.body.transactionType)
      : String(existing.transaction_type);
    const phone = sanitizeText(req.body?.phoneNumber ?? existing.phone_number, 30);
    const description = sanitizeText(req.body?.description ?? existing.description, 240);
    const referenceCode = sanitizeText(req.body?.referenceCode ?? existing.reference_code, 80);
    const txTimestamp = sanitizeText(req.body?.txTimestamp ?? existing.tx_timestamp, 40);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE imported_records
       SET transaction_type = ?, amount = ?, phone_number = ?, description = ?, reference_code = ?, tx_timestamp = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(txType, Number(amount.toFixed(2)), phone, description, referenceCode, txTimestamp, now, id, user.id);

    const updated = db
      .prepare('SELECT * FROM imported_records WHERE id = ?')
      .get(id) as Record<string, unknown>;

    writeAuditLog(db, user.id, `${user.displayName} (${user.phone})`, 'UPDATE_IMPORTED_RECORD', user.id, {
      recordId: id,
    });

    res.json({ record: mapImportedRecordRow(updated) });
  });

  app.delete('/api/imports/records/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const id = sanitizeText(req.params.id, 80);
    const info = db
      .prepare('DELETE FROM imported_records WHERE id = ? AND user_id = ?')
      .run(id, user.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'السجل غير موجود.' });
      return;
    }

    writeAuditLog(db, user.id, `${user.displayName} (${user.phone})`, 'DELETE_IMPORTED_RECORD', user.id, {
      recordId: id,
    });

    res.json({ ok: true });
  });

  app.get('/api/imports/export', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const rows = db
      .prepare(
        `SELECT * FROM imported_records
         WHERE user_id = ? AND visibility_status = 'visible'
         ORDER BY import_timestamp DESC`
      )
      .all(user.id) as Array<Record<string, unknown>>;
    const records = rows.map(mapImportedRecordRow);

    if (format === 'csv') {
      const header = [
        'id',
        'verification_status',
        'source_type',
        'transaction_type',
        'amount',
        'phone_number',
        'tx_timestamp',
        'reference_code',
        'description',
        'import_timestamp',
        'original_source_text',
      ].join(',');
      const body = records
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

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="wallet-imports.csv"');
      res.send(`\uFEFF${header}\n${body}`);
      return;
    }

    res.setHeader('Content-Type', 'application/json;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="wallet-imports.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      disclaimer: 'Unverified user-provided records owned by authenticated user.',
      userId: user.id,
      records,
    });
  });

  // ==========================================
  // Dedicated Single-Administrator Authentication Routes
  // ==========================================

  app.get('/api/admin/auth/status', (req, res) => {
    const envPassword = getConfiguredEnvAdminPassword();
    const credRow = db
      .prepare('SELECT id, username FROM admin_credentials WHERE id = 1')
      .get() as { id: number; username: string } | undefined;
    const configured = Boolean(envPassword) || Boolean(credRow);

    const token = extractAdminToken(req);
    if (!token) {
      res.json({
        configured,
        sessionAuthenticated: false,
        adminEmailHint: configured ? undefined : 'Admin',
      });
      return;
    }

    const tokenHash = hashToken(token);
    const sessionRow = db
      .prepare(
        `SELECT u.id, u.email, u.display_name, s.expires_at
         FROM admin_sessions s
         JOIN users u ON u.id = s.admin_user_id
         WHERE s.token_hash = ? AND u.role = 'admin'`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!sessionRow || new Date(String(sessionRow.expires_at)).getTime() < Date.now()) {
      if (sessionRow) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      clearSessionCookie(res, ADMIN_COOKIE_NAME);
      res.json({
        configured,
        sessionAuthenticated: false,
        adminEmailHint: configured ? undefined : 'Admin',
      });
      return;
    }

    res.json({
      configured,
      sessionAuthenticated: true,
      expiresAt: String(sessionRow.expires_at),
      admin: {
        id: String(sessionRow.id),
        email: String(credRow?.username || sessionRow.email || getSingleAdminEmail()),
        displayName: String(sessionRow.display_name),
      },
    });
  });

  app.post('/api/admin/auth/setup', (req, res) => {
    if (!isSameOriginMutationAllowed(req)) {
      res.status(403).json({ error: 'تم رفض الطلب لعدم تطابق المصدر.' });
      return;
    }
    if (!checkAdminAuthRateLimit(req)) {
      res.status(429).json({ error: 'تم تجاوز عدد محاولات الإعداد. يرجى المحاولة لاحقاً.' });
      return;
    }

    if (getConfiguredEnvAdminPassword()) {
      res.status(409).json({
        error: 'حساب المسؤول مُعد مسبقاً عبر إعدادات البيئة.',
      });
      return;
    }

    const identifier = sanitizeText(req.body?.username ?? req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || identifier.length < 3) {
      res.status(400).json({ error: 'يرجى إدخال اسم مستخدم أو بريد إلكتروني صالح للمسؤول (3 أحرف على الأقل).' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'يجب أن تتكون كلمة مرور المسؤول من 8 أحرف على الأقل.' });
      return;
    }

    const adminUser = getAdminUserRow(db);
    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordScrypt(password, salt);

    try {
      db.exec('BEGIN IMMEDIATE;');
      const existingCred = db
        .prepare('SELECT id FROM admin_credentials WHERE id = 1')
        .get() as { id: number } | undefined;
      if (existingCred) {
        db.exec('ROLLBACK;');
        res.status(409).json({ error: 'تم إعداد حساب المسؤول الوحيد بالفعل ولا يمكن تكراره.' });
        return;
      }

      if (identifier.includes('@')) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(identifier, adminUser.id);
      }
      db.prepare(
        `INSERT INTO admin_credentials (id, admin_user_id, username, password_hash, password_salt, claimed_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?)`
      ).run(adminUser.id, identifier, passwordHash, salt, now, now);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();

      db.prepare(
        `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(tokenHash, adminUser.id, expiresAt, now, now);

      writeAuditLog(db, adminUser.id, `${adminUser.displayName} (Admin)`, 'ADMIN_INITIAL_SETUP', adminUser.id, {
        adminUsername: identifier,
      });

      db.exec('COMMIT;');

      setSessionCookie(res, ADMIN_COOKIE_NAME, rawToken, ADMIN_SESSION_TTL_MS, req);
      res.json({
        authenticated: true,
        adminToken: rawToken,
        expiresAt,
        admin: {
          id: adminUser.id,
          email: identifier,
          displayName: adminUser.displayName,
        },
      });
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback if not active
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر إتمام إعداد المسؤول الأول.',
      });
    }
  });

  app.post('/api/admin/auth/login', (req, res) => {
    if (!isSameOriginMutationAllowed(req)) {
      res.status(403).json({ error: 'تم رفض الطلب لعدم تطابق المصدر.' });
      return;
    }
    if (!checkAdminAuthRateLimit(req)) {
      res.status(429).json({ error: 'تم تجاوز محاولات الدخول المسموحة. انتظر 15 دقيقة.' });
      return;
    }

    const identifier = sanitizeText(req.body?.username ?? req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password) {
      res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
      return;
    }

    const adminUser = getAdminUserRow(db);
    const envPassword = getConfiguredEnvAdminPassword();
    const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    let validCredentials = false;
    let resolvedIdentity = identifier;

    if (envPassword) {
      const allowedEmail = (adminUser.email || getSingleAdminEmail()).toLowerCase();
      const idMatches = identifier === envUsername || identifier === allowedEmail;
      validCredentials = idMatches && constantTimeSecretEquals(password, envPassword);
      resolvedIdentity = identifier === envUsername ? envUsername : allowedEmail;
    } else {
      const cred = db
        .prepare('SELECT * FROM admin_credentials WHERE id = 1')
        .get() as Record<string, unknown> | undefined;
      if (!cred) {
        res.status(409).json({
          code: 'ADMIN_NOT_CONFIGURED',
          error: 'لم يتم إعداد كلمة مرور المسؤول بعد. أكمل الإعداد الأول أولاً.',
        });
        return;
      }
      const storedUsername = String(cred.username).toLowerCase();
      const allowedEmail = (adminUser.email || '').toLowerCase();
      const idMatches =
        identifier === storedUsername || (Boolean(allowedEmail) && identifier === allowedEmail);
      validCredentials =
        idMatches &&
        verifyPasswordScrypt(password, String(cred.password_salt), String(cred.password_hash));
      resolvedIdentity = storedUsername;
    }

    if (!validCredentials) {
      writeAuditLog(db, 'anonymous', identifier, 'ADMIN_LOGIN_FAILED', adminUser.id, {
        attemptedIdentity: identifier,
      });
      res.status(401).json({ error: 'بيانات دخول المسؤول غير صحيحة.' });
      return;
    }

    const now = new Date().toISOString();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();

    db.prepare(
      `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(tokenHash, adminUser.id, expiresAt, now, now);

    writeAuditLog(db, adminUser.id, `${adminUser.displayName} (Admin)`, 'ADMIN_LOGIN_SUCCESS', adminUser.id, {
      expiresAt,
    });

    setSessionCookie(res, ADMIN_COOKIE_NAME, rawToken, ADMIN_SESSION_TTL_MS, req);
    res.json({
      authenticated: true,
      adminToken: rawToken,
      expiresAt,
      admin: {
        id: adminUser.id,
        email: resolvedIdentity,
        displayName: adminUser.displayName,
      },
    });
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    const token = extractAdminToken(req);
    if (token) {
      const tokenHash = hashToken(token);
      const row = db
        .prepare('SELECT admin_user_id FROM admin_sessions WHERE token_hash = ?')
        .get(tokenHash) as { admin_user_id: string } | undefined;
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      if (row) {
        writeAuditLog(db, row.admin_user_id, 'Admin', 'ADMIN_LOGOUT', row.admin_user_id, {});
      }
    }
    clearSessionCookie(res, ADMIN_COOKIE_NAME);
    res.json({ ok: true });
  });

  // ==========================================
  // Central Admin Dashboard Endpoints (Strictly Protected)
  // ==========================================

  app.get('/api/admin/overview', requireAdminSession, (_req: AuthedRequest, res) => {
    const users = getAdminUserSummaries(db);
    const userById = new Map(users.map((u) => [u.id, u]));

    const totalImportedRow = db
      .prepare('SELECT COUNT(*) AS count FROM imported_records')
      .get() as { count: number };
    const totalBatchesRow = db
      .prepare('SELECT COUNT(*) AS count FROM import_batches')
      .get() as { count: number };

    const recentBatches = db
      .prepare('SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 40')
      .all() as Array<Record<string, unknown>>;
    const allImportedRows = db
      .prepare('SELECT * FROM imported_records ORDER BY import_timestamp DESC LIMIT 120')
      .all() as Array<Record<string, unknown>>;
    const importedRecordsMapped = allImportedRows.map(mapImportedRecordRow);

    const walletRows = db
      .prepare('SELECT user_id, transactions_json FROM wallets')
      .all() as Array<{ user_id: string; transactions_json: string }>;

    const walletRecords: AdminWalletRecordItem[] = [];
    let totalWalletTransactionsCount = 0;

    for (const wRow of walletRows) {
      const owner = userById.get(wRow.user_id);
      let txs: Transaction[] = [];
      try {
        const parsed = JSON.parse(wRow.transactions_json);
        if (Array.isArray(parsed)) txs = normalizeStoredTransactions(parsed);
      } catch {
        txs = [];
      }
      totalWalletTransactionsCount += txs.length;
      for (const tx of txs) {
        walletRecords.push({
          recordKind: 'simulated_wallet_tx',
          recordId: tx.id,
          userId: wRow.user_id,
          userPhone: owner?.phone || '',
          userName: owner?.displayName || wRow.user_id,
          transactionType: tx.type,
          amount: tx.amount,
          phoneNumber: tx.phoneNumber,
          description: tx.description,
          referenceCode: tx.receiptNumber || tx.id,
          timestamp: tx.timestamp,
          sourceType: 'wallet_simulation',
          originalSourceText: tx.originalSnapshot
            ? `${tx.originalSnapshot.description} · ${tx.originalSnapshot.amount} EGP`
            : `${tx.description} · ${tx.amount} EGP`,
          verificationStatus: 'simulated',
          visibilityStatus: tx.visibilityStatus ?? 'visible',
          isSimulated: tx.isSimulated !== false,
          adminVerified: Boolean(tx.adminVerified),
          adminVerifiedAt: tx.adminVerifiedAt || null,
          adminNote: tx.adminNote || null,
          originalSnapshot: tx.originalSnapshot || null,
        });
      }
    }

    for (const rec of importedRecordsMapped) {
      const owner = userById.get(rec.userId);
      walletRecords.push({
        recordKind: 'imported_record',
        recordId: rec.id,
        userId: rec.userId,
        userPhone: owner?.phone || '',
        userName: owner?.displayName || rec.userId,
        transactionType: rec.transactionType,
        amount: rec.amount,
        phoneNumber: rec.phoneNumber,
        description: rec.description,
        referenceCode: rec.referenceCode,
        timestamp: rec.txTimestamp,
        sourceType: rec.sourceType,
        originalSourceText: rec.originalSourceText,
        verificationStatus: 'unverified_demo',
        visibilityStatus: rec.visibilityStatus ?? 'visible',
        isSimulated: rec.isSimulated !== false,
        adminVerified: Boolean(rec.adminVerified),
        adminVerifiedAt: rec.adminVerifiedAt || null,
        adminNote: rec.adminNote || null,
        originalSnapshot: {
          originalSourceText: rec.originalSourceText,
          verificationStatus: rec.verificationStatus,
        },
      });
    }

    walletRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const recordHistoryRows = db
      .prepare('SELECT * FROM record_change_history ORDER BY created_at DESC LIMIT 100')
      .all() as Array<Record<string, unknown>>;
    const auditLogs = db
      .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100')
      .all() as Array<Record<string, unknown>>;

    res.json({
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === 'active').length,
        suspendedUsers: users.filter((u) => u.status === 'suspended').length,
        hiddenUsers: users.filter((u) => u.isHidden).length,
        totalWalletRecords: totalWalletTransactionsCount,
        totalImportedRecords: Number(totalImportedRow.count || 0),
        totalImportBatches: Number(totalBatchesRow.count || 0),
      },
      users,
      recentBatches: recentBatches.map(mapBatchRow),
      recentRecords: importedRecordsMapped,
      walletRecords: walletRecords.slice(0, 200),
      recordHistory: recordHistoryRows.map(mapRecordChangeHistoryRow),
      auditLogs: auditLogs.map(mapAuditRow),
    });
  });

  app.get('/api/admin/users/:userId', requireAdminSession, (req: AuthedRequest, res) => {
    const userId = sanitizeText(req.params.userId, 80);
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | Record<string, unknown>
      | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'المستخدم غير موجود.' });
      return;
    }

    const user = mapUserRow(userRow);
    const walletBundle = ensureWalletForUser(db, user, true);
    const importedRows = db
      .prepare('SELECT * FROM imported_records WHERE user_id = ? ORDER BY import_timestamp DESC')
      .all(userId) as Array<Record<string, unknown>>;
    const historyRows = db
      .prepare('SELECT * FROM record_change_history WHERE target_user_id = ? ORDER BY created_at DESC LIMIT 80')
      .all(userId) as Array<Record<string, unknown>>;
    const auditRows = db
      .prepare('SELECT * FROM audit_logs WHERE target_user_id = ? ORDER BY created_at DESC LIMIT 80')
      .all(userId) as Array<Record<string, unknown>>;

    res.json({
      user: {
        ...user,
        walletBalance: walletBundle.walletState.account.balance,
        lineBalance: walletBundle.lineBalance,
        walletTransactionsCount: walletBundle.walletState.transactions.length,
        importedCount: importedRows.length,
        lastImportAt: importedRows[0] ? String(importedRows[0].import_timestamp) : null,
      },
      wallet: {
        accountNumber: walletBundle.walletState.account.accountNumber,
        holderName: walletBundle.walletState.account.holderName,
        balance: walletBundle.walletState.account.balance,
        lineBalance: walletBundle.lineBalance,
        billAmount: walletBundle.billAmount,
        billPaid: walletBundle.billPaid,
        address: walletBundle.address,
        biometricEnabled: walletBundle.biometricEnabled,
        updatedAt: walletBundle.updatedAt,
      },
      walletTransactions: walletBundle.walletState.transactions,
      importedRecords: importedRows.map(mapImportedRecordRow),
      changeHistory: historyRows.map(mapRecordChangeHistoryRow),
      auditLogs: auditRows.map(mapAuditRow),
    });
  });

  app.patch('/api/admin/users/:userId', requireAdminSession, (req: AuthedRequest, res) => {
    const admin = req.adminActor!;
    const targetUserId = sanitizeText(req.params.userId, 80);
    const existing = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(targetUserId) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'المستخدم غير موجود.' });
      return;
    }

    const nextStatus =
      req.body?.status === 'suspended' || req.body?.status === 'active'
        ? req.body.status
        : String(existing.status);

    if (String(existing.role) === 'admin' && nextStatus === 'suspended') {
      res.status(400).json({ error: 'لا يمكن إيقاف حساب المسؤول الوحيد.' });
      return;
    }

    const nextDisplayName = sanitizeText(req.body?.displayName ?? existing.display_name, 60);
    const reason = sanitizeText(req.body?.reason, 200) || 'تحديث حالة الحساب من لوحة المسؤول';
    const nextAdminVerified =
      typeof req.body?.adminVerified === 'boolean'
        ? req.body.adminVerified
          ? 1
          : 0
        : Number(existing.admin_verified || 0);
    const nextVerifiedAt =
      typeof req.body?.adminVerified === 'boolean'
        ? req.body.adminVerified
          ? new Date().toISOString()
          : null
        : existing.admin_verified_at
          ? String(existing.admin_verified_at)
          : null;

    if (String(existing.role) === 'admin' && req.body?.isHidden === true) {
      res.status(400).json({ error: 'لا يمكن إخفاء حساب المسؤول الوحيد.' });
      return;
    }

    const nextIsHidden =
      typeof req.body?.isHidden === 'boolean'
        ? req.body.isHidden
          ? 1
          : 0
        : Number(existing.is_hidden || 0);
    const nextHiddenAt =
      typeof req.body?.isHidden === 'boolean'
        ? req.body.isHidden
          ? new Date().toISOString()
          : null
        : existing.hidden_at
          ? String(existing.hidden_at)
          : null;

    db.prepare(
      'UPDATE users SET status = ?, display_name = ?, admin_verified = ?, admin_verified_at = ?, is_hidden = ?, hidden_at = ? WHERE id = ?'
    ).run(
      nextStatus,
      nextDisplayName,
      nextAdminVerified,
      nextVerifiedAt,
      nextIsHidden,
      nextHiddenAt,
      targetUserId
    );

    if (nextStatus === 'suspended') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    }

    const actionName =
      typeof req.body?.isHidden === 'boolean'
        ? req.body.isHidden
          ? 'ADMIN_HIDE_USER'
          : 'ADMIN_RESTORE_HIDDEN_USER'
        : typeof req.body?.adminVerified === 'boolean'
          ? req.body.adminVerified
            ? 'ADMIN_VERIFY_USER'
            : 'ADMIN_UNVERIFY_USER'
          : nextStatus !== String(existing.status)
            ? nextStatus === 'suspended'
              ? 'ADMIN_SUSPEND_USER'
              : 'ADMIN_REACTIVATE_USER'
            : 'ADMIN_UPDATE_USER';

    writeAuditLog(db, admin.id, `${admin.displayName} (Admin)`, actionName, targetUserId, {
      previousStatus: existing.status,
      newStatus: nextStatus,
      previousDisplayName: existing.display_name,
      newDisplayName: nextDisplayName,
      adminVerified: Boolean(nextAdminVerified),
      isHidden: Boolean(nextIsHidden),
      reason,
    });

    res.json({ ok: true });
  });

  // Hide / Archive / Restore on Imported Records (never deletes permanently)
  app.post(
    '/api/admin/records/imported/:id/visibility',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const id = sanitizeText(req.params.id, 80);
      const actionInput = sanitizeText(req.body?.action, 30);
      const reason = sanitizeText(req.body?.reason, 240);

      if (!reason || reason.length < 3) {
        res.status(400).json({ error: 'يجب إدخال سبب واضح للإجراء الإداري (3 أحرف على الأقل).' });
        return;
      }

      const existing = db
        .prepare('SELECT * FROM imported_records WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;

      if (!existing) {
        res.status(404).json({ error: 'السجل غير موجود.' });
        return;
      }
      if (existing.is_simulated === 0) {
        res.status(403).json({ error: 'لا يمكن إخفاء أو أرشفة السجلات المالية غير المحاكاة.' });
        return;
      }

      const prevVis = String(existing.visibility_status || 'visible') as RecordVisibilityStatus;
      let nextVis: RecordVisibilityStatus;
      let historyAction: 'HIDE' | 'RESTORE_HIDDEN' | 'ARCHIVE' | 'RESTORE_ARCHIVED';

      if (actionInput === 'hide') {
        nextVis = 'hidden';
        historyAction = 'HIDE';
      } else if (actionInput === 'restore_hidden') {
        nextVis = 'visible';
        historyAction = 'RESTORE_HIDDEN';
      } else if (actionInput === 'archive') {
        nextVis = 'archived';
        historyAction = 'ARCHIVE';
      } else if (actionInput === 'restore_archived') {
        nextVis = 'visible';
        historyAction = 'RESTORE_ARCHIVED';
      } else {
        res.status(400).json({ error: 'إجراء الرؤية غير صالح.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE imported_records
         SET visibility_status = ?,
             hidden_at = CASE WHEN ? = 'hidden' THEN ? ELSE hidden_at END,
             archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END,
             updated_at = ?
         WHERE id = ?`
      ).run(nextVis, nextVis, now, nextVis, now, now, id);

      const originalSnapshot = {
        originalSourceText: String(existing.original_source_text),
        amount: Number(existing.amount),
        phoneNumber: String(existing.phone_number),
        description: String(existing.description),
        verificationStatus: String(existing.verification_status),
      };

      writeRecordChangeHistory(db, {
        recordKind: 'imported_record',
        recordId: id,
        targetUserId: String(existing.user_id),
        action: historyAction,
        fieldName: 'visibilityStatus',
        previousValue: { visibilityStatus: prevVis },
        newValue: { visibilityStatus: nextVis },
        originalSnapshot,
        adminId: admin.id,
        reason,
      });

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        `ADMIN_${historyAction}_IMPORTED_RECORD`,
        String(existing.user_id),
        { recordId: id, previousStatus: prevVis, newStatus: nextVis, reason }
      );

      res.json({ ok: true, visibilityStatus: nextVis });
    }
  );

  // Authorized metadata edit on eligible simulated Imported Record (never overwrites originalSourceText)
  app.patch('/api/admin/records/imported/:id', requireAdminSession, (req: AuthedRequest, res) => {
    const admin = req.adminActor!;
    const id = sanitizeText(req.params.id, 80);
    const reason = sanitizeText(req.body?.reason, 240);

    if (!reason || reason.length < 3) {
      res.status(400).json({ error: 'يجب إدخال سبب التعديل لحفظه في سجل التدقيق.' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM imported_records WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'السجل غير موجود.' });
      return;
    }
    if (existing.is_simulated === 0) {
      res.status(403).json({ error: 'تعديل البيانات مقتصر على السجلات المحاكاة فقط.' });
      return;
    }

    const amount = Number(req.body?.amount ?? existing.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'المبلغ غير صالح.' });
      return;
    }

    const description = sanitizeText(req.body?.description ?? existing.description, 240);
    const phone = sanitizeText(req.body?.phoneNumber ?? existing.phone_number, 30);
    const referenceCode = sanitizeText(req.body?.referenceCode ?? existing.reference_code, 80);
    const now = new Date().toISOString();

    const previousValue = {
      amount: Number(existing.amount),
      description: String(existing.description),
      phoneNumber: String(existing.phone_number),
      referenceCode: String(existing.reference_code),
    };
    const newValue = {
      amount: Number(amount.toFixed(2)),
      description,
      phoneNumber: phone,
      referenceCode,
    };
    const originalSnapshot = {
      originalSourceText: String(existing.original_source_text),
      verificationStatus: String(existing.verification_status),
    };

    // Intentionally NEVER modifies original_source_text or verification_status
    db.prepare(
      `UPDATE imported_records
       SET amount = ?, description = ?, phone_number = ?, reference_code = ?, updated_at = ?
       WHERE id = ?`
    ).run(newValue.amount, description, phone, referenceCode, now, id);

    writeRecordChangeHistory(db, {
      recordKind: 'imported_record',
      recordId: id,
      targetUserId: String(existing.user_id),
      action: 'METADATA_EDIT',
      fieldName: 'metadata',
      previousValue,
      newValue,
      originalSnapshot,
      adminId: admin.id,
      reason,
    });

    writeAuditLog(
      db,
      admin.id,
      `${admin.displayName} (Admin)`,
      'ADMIN_EDIT_IMPORTED_RECORD',
      String(existing.user_id),
      { recordId: id, previousValue, newValue, reason }
    );

    res.json({ ok: true });
  });

  // Hide / Archive / Restore on Simulated Wallet Transaction
  app.post(
    '/api/admin/records/wallet/:userId/:txId/visibility',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const userId = sanitizeText(req.params.userId, 80);
      const txId = sanitizeText(req.params.txId, 80);
      const actionInput = sanitizeText(req.body?.action, 30);
      const reason = sanitizeText(req.body?.reason, 240);

      if (!reason || reason.length < 3) {
        res.status(400).json({ error: 'يجب إدخال سبب واضح للإجراء الإداري (3 أحرف على الأقل).' });
        return;
      }

      const walletRow = db
        .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
        .get(userId) as { transactions_json: string } | undefined;

      if (!walletRow) {
        res.status(404).json({ error: 'محفظة المستخدم غير موجودة.' });
        return;
      }

      const txs = normalizeStoredTransactions(JSON.parse(walletRow.transactions_json) as unknown[]);
      const idx = txs.findIndex((t) => t.id === txId);
      if (idx === -1) {
        res.status(404).json({ error: 'المعاملة غير موجودة في محفظة هذا المستخدم.' });
        return;
      }

      const target = txs[idx];
      if (target.isSimulated === false) {
        res.status(403).json({ error: 'لا يمكن إخفاء أو أرشفة السجلات المالية الحقيقية.' });
        return;
      }

      const prevVis: RecordVisibilityStatus = target.visibilityStatus ?? 'visible';
      let nextVis: RecordVisibilityStatus;
      let historyAction: 'HIDE' | 'RESTORE_HIDDEN' | 'ARCHIVE' | 'RESTORE_ARCHIVED';

      if (actionInput === 'hide') {
        nextVis = 'hidden';
        historyAction = 'HIDE';
      } else if (actionInput === 'restore_hidden') {
        nextVis = 'visible';
        historyAction = 'RESTORE_HIDDEN';
      } else if (actionInput === 'archive') {
        nextVis = 'archived';
        historyAction = 'ARCHIVE';
      } else if (actionInput === 'restore_archived') {
        nextVis = 'visible';
        historyAction = 'RESTORE_ARCHIVED';
      } else {
        res.status(400).json({ error: 'إجراء الرؤية غير صالح.' });
        return;
      }

      const originalSnapshot = target.originalSnapshot ?? {
        amount: target.amount,
        phoneNumber: target.phoneNumber,
        description: target.description,
        counterpartyName: target.counterpartyName,
        timestamp: target.timestamp,
      };

      txs[idx] = {
        ...target,
        visibilityStatus: nextVis,
        originalSnapshot,
      };

      db.prepare('UPDATE wallets SET transactions_json = ?, updated_at = ? WHERE user_id = ?').run(
        JSON.stringify(txs),
        new Date().toISOString(),
        userId
      );

      writeRecordChangeHistory(db, {
        recordKind: 'simulated_wallet_tx',
        recordId: txId,
        targetUserId: userId,
        action: historyAction,
        fieldName: 'visibilityStatus',
        previousValue: { visibilityStatus: prevVis },
        newValue: { visibilityStatus: nextVis },
        originalSnapshot,
        adminId: admin.id,
        reason,
      });

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        `ADMIN_${historyAction}_WALLET_TX`,
        userId,
        { txId, previousStatus: prevVis, newStatus: nextVis, reason }
      );

      res.json({ ok: true, visibilityStatus: nextVis });
    }
  );

  // Authorized metadata correction on Simulated Wallet Transaction
  app.patch(
    '/api/admin/records/wallet/:userId/:txId',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const userId = sanitizeText(req.params.userId, 80);
      const txId = sanitizeText(req.params.txId, 80);
      const reason = sanitizeText(req.body?.reason, 240);

      if (!reason || reason.length < 3) {
        res.status(400).json({ error: 'يجب إدخال سبب التعديل لحفظه في سجل التدقيق.' });
        return;
      }

      const walletRow = db
        .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
        .get(userId) as { transactions_json: string } | undefined;

      if (!walletRow) {
        res.status(404).json({ error: 'محفظة المستخدم غير موجودة.' });
        return;
      }

      const txs = normalizeStoredTransactions(JSON.parse(walletRow.transactions_json) as unknown[]);
      const idx = txs.findIndex((t) => t.id === txId);
      if (idx === -1) {
        res.status(404).json({ error: 'المعاملة غير موجودة.' });
        return;
      }

      const target = txs[idx];
      if (target.isSimulated === false) {
        res.status(403).json({ error: 'تعديل البيانات مقتصر على السجلات المحاكاة فقط.' });
        return;
      }

      const amount = Number(req.body?.amount ?? target.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: 'المبلغ غير صالح.' });
        return;
      }

      const description = sanitizeText(req.body?.description ?? target.description, 240);
      const phoneNumber = sanitizeText(req.body?.phoneNumber ?? target.phoneNumber, 30);

      const originalSnapshot = target.originalSnapshot ?? {
        amount: target.amount,
        phoneNumber: target.phoneNumber,
        description: target.description,
        counterpartyName: target.counterpartyName,
        timestamp: target.timestamp,
      };

      const previousValue = {
        amount: target.amount,
        description: target.description,
        phoneNumber: target.phoneNumber,
      };
      const newValue = {
        amount: Number(amount.toFixed(2)),
        description,
        phoneNumber,
      };

      txs[idx] = {
        ...target,
        amount: newValue.amount,
        description,
        phoneNumber,
        originalSnapshot,
      };

      db.prepare('UPDATE wallets SET transactions_json = ?, updated_at = ? WHERE user_id = ?').run(
        JSON.stringify(txs),
        new Date().toISOString(),
        userId
      );

      writeRecordChangeHistory(db, {
        recordKind: 'simulated_wallet_tx',
        recordId: txId,
        targetUserId: userId,
        action: 'METADATA_EDIT',
        fieldName: 'metadata',
        previousValue,
        newValue,
        originalSnapshot,
        adminId: admin.id,
        reason,
      });

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        'ADMIN_EDIT_WALLET_TX',
        userId,
        { txId, previousValue, newValue, reason }
      );

      res.json({ ok: true });
    }
  );

  // Admin Verify / Unverify on Imported Record
  app.post(
    '/api/admin/records/imported/:id/verify',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const id = sanitizeText(req.params.id, 80);
      const verified = Boolean(req.body?.verified);
      const note = sanitizeText(req.body?.note, 240) || null;
      const reason = sanitizeText(req.body?.reason, 240) || (verified ? 'تحقق ومراجعة إدارية' : 'إلغاء التحقق الإداري');

      const existing = db
        .prepare('SELECT * FROM imported_records WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;

      if (!existing) {
        res.status(404).json({ error: 'السجل غير موجود.' });
        return;
      }

      const now = new Date().toISOString();
      const prevVerified = Boolean(existing.admin_verified);
      db.prepare(
        `UPDATE imported_records
         SET admin_verified = ?, admin_verified_at = ?, admin_note = ?, updated_at = ?
         WHERE id = ?`
      ).run(verified ? 1 : 0, verified ? now : null, note, now, id);

      const originalSnapshot = {
        originalSourceText: String(existing.original_source_text),
        amount: Number(existing.amount),
        phoneNumber: String(existing.phone_number),
        description: String(existing.description),
      };

      writeRecordChangeHistory(db, {
        recordKind: 'imported_record',
        recordId: id,
        targetUserId: String(existing.user_id),
        action: verified ? 'VERIFY' : 'UNVERIFY',
        fieldName: 'adminVerified',
        previousValue: { adminVerified: prevVerified, adminNote: existing.admin_note || null },
        newValue: { adminVerified: verified, adminNote: note },
        originalSnapshot,
        adminId: admin.id,
        reason,
      });

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        verified ? 'ADMIN_VERIFY_IMPORTED_RECORD' : 'ADMIN_UNVERIFY_IMPORTED_RECORD',
        String(existing.user_id),
        { recordId: id, verified, note, reason }
      );

      res.json({ ok: true, adminVerified: verified });
    }
  );

  // Admin Verify / Unverify on Simulated Wallet Transaction
  app.post(
    '/api/admin/records/wallet/:userId/:txId/verify',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const userId = sanitizeText(req.params.userId, 80);
      const txId = sanitizeText(req.params.txId, 80);
      const verified = Boolean(req.body?.verified);
      const note = sanitizeText(req.body?.note, 240) || undefined;
      const reason = sanitizeText(req.body?.reason, 240) || (verified ? 'تحقق ومراجعة إدارية' : 'إلغاء التحقق الإداري');

      const walletRow = db
        .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
        .get(userId) as { transactions_json: string } | undefined;

      if (!walletRow) {
        res.status(404).json({ error: 'محفظة المستخدم غير موجودة.' });
        return;
      }

      const txs = normalizeStoredTransactions(JSON.parse(walletRow.transactions_json) as unknown[]);
      const idx = txs.findIndex((t) => t.id === txId);
      if (idx === -1) {
        res.status(404).json({ error: 'المعاملة غير موجودة.' });
        return;
      }

      const target = txs[idx];
      const now = new Date().toISOString();
      const prevVerified = Boolean(target.adminVerified);
      const originalSnapshot = target.originalSnapshot ?? {
        amount: target.amount,
        phoneNumber: target.phoneNumber,
        description: target.description,
        counterpartyName: target.counterpartyName,
        timestamp: target.timestamp,
      };

      txs[idx] = {
        ...target,
        adminVerified: verified,
        adminVerifiedAt: verified ? now : undefined,
        adminNote: note,
        originalSnapshot,
      };

      db.prepare('UPDATE wallets SET transactions_json = ?, updated_at = ? WHERE user_id = ?').run(
        JSON.stringify(txs),
        now,
        userId
      );

      writeRecordChangeHistory(db, {
        recordKind: 'simulated_wallet_tx',
        recordId: txId,
        targetUserId: userId,
        action: verified ? 'VERIFY' : 'UNVERIFY',
        fieldName: 'adminVerified',
        previousValue: { adminVerified: prevVerified, adminNote: target.adminNote || null },
        newValue: { adminVerified: verified, adminNote: note || null },
        originalSnapshot,
        adminId: admin.id,
        reason,
      });

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        verified ? 'ADMIN_VERIFY_WALLET_TX' : 'ADMIN_UNVERIFY_WALLET_TX',
        userId,
        { txId, verified, note: note || null, reason }
      );

      res.json({ ok: true, adminVerified: verified });
    }
  );

  // Admin Remove / Delete Imported Record (snapshots original data into permanent audit history first)
  app.delete('/api/admin/records/imported/:id', requireAdminSession, (req: AuthedRequest, res) => {
    const admin = req.adminActor!;
    const id = sanitizeText(req.params.id, 80);
    const reason = sanitizeText(req.body?.reason ?? req.query?.reason, 240);

    if (!reason || reason.length < 3) {
      res.status(400).json({ error: 'يجب إدخال سبب واضح لإزالة السجل (3 أحرف على الأقل).' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM imported_records WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'السجل غير موجود.' });
      return;
    }

    const snapshot = {
      originalSourceText: String(existing.original_source_text),
      amount: Number(existing.amount),
      phoneNumber: String(existing.phone_number),
      description: String(existing.description),
      referenceCode: String(existing.reference_code),
    };

    writeRecordChangeHistory(db, {
      recordKind: 'imported_record',
      recordId: id,
      targetUserId: String(existing.user_id),
      action: 'DELETE',
      fieldName: 'record',
      previousValue: snapshot,
      newValue: { deleted: true },
      originalSnapshot: snapshot,
      adminId: admin.id,
      reason,
    });

    db.prepare('DELETE FROM imported_records WHERE id = ?').run(id);

    writeAuditLog(
      db,
      admin.id,
      `${admin.displayName} (Admin)`,
      'ADMIN_DELETE_IMPORTED_RECORD',
      String(existing.user_id),
      { recordId: id, reason, snapshot }
    );

    res.json({ ok: true });
  });

  // Admin Remove / Delete Simulated Wallet Transaction (snapshots original tx into permanent audit history first)
  app.delete(
    '/api/admin/records/wallet/:userId/:txId',
    requireAdminSession,
    (req: AuthedRequest, res) => {
      const admin = req.adminActor!;
      const userId = sanitizeText(req.params.userId, 80);
      const txId = sanitizeText(req.params.txId, 80);
      const reason = sanitizeText(req.body?.reason ?? req.query?.reason, 240);

      if (!reason || reason.length < 3) {
        res.status(400).json({ error: 'يجب إدخال سبب واضح لإزالة المعاملة (3 أحرف على الأقل).' });
        return;
      }

      const walletRow = db
        .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
        .get(userId) as { transactions_json: string } | undefined;

      if (!walletRow) {
        res.status(404).json({ error: 'محفظة المستخدم غير موجودة.' });
        return;
      }

      const txs = normalizeStoredTransactions(JSON.parse(walletRow.transactions_json) as unknown[]);
      const target = txs.find((t) => t.id === txId);
      if (!target) {
        res.status(404).json({ error: 'المعاملة غير موجودة.' });
        return;
      }

      const nextTxs = txs.filter((t) => t.id !== txId);
      const snapshot = target.originalSnapshot ?? {
        amount: target.amount,
        phoneNumber: target.phoneNumber,
        description: target.description,
        counterpartyName: target.counterpartyName,
        timestamp: target.timestamp,
      };

      writeRecordChangeHistory(db, {
        recordKind: 'simulated_wallet_tx',
        recordId: txId,
        targetUserId: userId,
        action: 'DELETE',
        fieldName: 'transaction',
        previousValue: {
          amount: target.amount,
          description: target.description,
          phoneNumber: target.phoneNumber,
          type: target.type,
        },
        newValue: { deleted: true },
        originalSnapshot: snapshot,
        adminId: admin.id,
        reason,
      });

      db.prepare('UPDATE wallets SET transactions_json = ?, updated_at = ? WHERE user_id = ?').run(
        JSON.stringify(nextTxs),
        new Date().toISOString(),
        userId
      );

      writeAuditLog(
        db,
        admin.id,
        `${admin.displayName} (Admin)`,
        'ADMIN_DELETE_WALLET_TX',
        userId,
        { txId, reason, snapshot }
      );

      res.json({ ok: true });
    }
  );

  // Admin Add Simulated Wallet Transaction for a user (explicitly marked isSimulated: true)
  app.post('/api/admin/records/wallet/:userId', requireAdminSession, (req: AuthedRequest, res) => {
    const admin = req.adminActor!;
    const userId = sanitizeText(req.params.userId, 80);
    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'المستخدم غير موجود.' });
      return;
    }

    const rawType = sanitizeText(req.body?.type, 20);
    const txType: Transaction['type'] =
      rawType === 'send' || rawType === 'receive' || rawType === 'withdraw' || rawType === 'deposit'
        ? rawType
        : 'send';
    const amount = Number(req.body?.amount);
    const phoneNumber = sanitizeText(req.body?.phoneNumber, 30) || String(userRow.phone || '01000000000');
    const description = sanitizeText(req.body?.description, 240);
    const reason = sanitizeText(req.body?.reason, 240);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 500000) {
      res.status(400).json({ error: 'يرجى إدخال مبلغ صالح أكبر من صفر.' });
      return;
    }
    if (!description || description.length < 2) {
      res.status(400).json({ error: 'يرجى إدخال وصف واضح للمعاملة.' });
      return;
    }
    if (!reason || reason.length < 3) {
      res.status(400).json({ error: 'يرجى إدخال سبب إنشاء المعاملة للتدقيق.' });
      return;
    }

    const user = mapUserRow(userRow);
    ensureWalletForUser(db, user, true);

    const walletRow = db
      .prepare('SELECT transactions_json FROM wallets WHERE user_id = ?')
      .get(userId) as { transactions_json: string };
    const txs = normalizeStoredTransactions(JSON.parse(walletRow.transactions_json) as unknown[]);

    const now = new Date().toISOString();
    const txId = `VFC-SIM-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const receiptNumber = `0259${String(Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9)}`;
    const normalizedAmount = Number(amount.toFixed(2));

    const newTx: Transaction = {
      id: txId,
      type: txType,
      amount: normalizedAmount,
      phoneNumber,
      timestamp: now,
      status: 'completed',
      description,
      fee: 0,
      receiptNumber,
      isSimulated: true,
      visibilityStatus: 'visible',
      adminVerified: false,
      originalSnapshot: {
        amount: normalizedAmount,
        phoneNumber,
        description,
        timestamp: now,
      },
    };

    const nextTxs = [newTx, ...txs].slice(0, 300);
    db.prepare('UPDATE wallets SET transactions_json = ?, updated_at = ? WHERE user_id = ?').run(
      JSON.stringify(nextTxs),
      now,
      userId
    );

    writeRecordChangeHistory(db, {
      recordKind: 'simulated_wallet_tx',
      recordId: txId,
      targetUserId: userId,
      action: 'CREATE',
      fieldName: 'simulated_transaction',
      previousValue: {},
      newValue: {
        type: txType,
        amount: normalizedAmount,
        phoneNumber,
        description,
        isSimulated: true,
      },
      originalSnapshot: newTx.originalSnapshot!,
      adminId: admin.id,
      reason,
    });

    writeAuditLog(
      db,
      admin.id,
      `${admin.displayName} (Admin)`,
      'ADMIN_ADD_SIMULATED_WALLET_TX',
      userId,
      { txId, type: txType, amount: normalizedAmount, phoneNumber, description, reason }
    );

    res.json({ ok: true, transaction: newTx });
  });

  // ==========================================
  // Frontend Serving: Vite Dev Middleware or Built Static Dist
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wallet server running on http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}; checkpointing SQLite WAL and closing server...`);
    server.close(() => {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        db.close();
      } catch {
        // Ignore close errors
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
