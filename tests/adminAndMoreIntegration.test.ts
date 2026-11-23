import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Could not determine ephemeral port')));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
  });
}

let BASE_URL = '';

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/admin/auth/status`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for isolated test server to start');
}

async function jsonReq<T = any>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    userToken?: string;
    adminToken?: string;
  } = {}
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.userToken) {
    headers['Authorization'] = `Bearer ${options.userToken}`;
  }
  if (options.adminToken) {
    headers['X-Admin-Authorization'] = `Bearer ${options.adminToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function runTests(): Promise<void> {
  const testPort = await getFreePort();
  BASE_URL = `http://127.0.0.1:${testPort}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-admin-test-'));
  const tmpDbPath = path.join(tmpDir, 'test_wallet.db');

  const tsxBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
  const serverProc = spawn(tsxBin, ['server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(testPort),
      NODE_ENV: 'production',
      WALLET_DB_PATH: tmpDbPath,
      OTP_PROVIDER: 'demo-sandbox',
      ADMIN_EMAIL: 'Mohamed.elfar55555@gmail.com',
      ADMIN_ACCESS_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(BASE_URL);

    // Test 1 & 2: Admin initial setup check & single-admin lock
    const initialStatus = await jsonReq('/api/admin/auth/status');
    assert.equal(initialStatus.status, 200);
    assert.equal(initialStatus.data.configured, false);
    assert.equal(initialStatus.data.sessionAuthenticated, false);

    // Ordinary unauthenticated access to /api/admin/overview is rejected
    const unauthOverview = await jsonReq('/api/admin/overview');
    assert.equal(unauthOverview.status, 401);

    // Claim single administrator credentials (atomic first-time setup with username 'Admin')
    const setupRes = await jsonReq('/api/admin/auth/setup', {
      method: 'POST',
      body: {
        username: 'Admin',
        password: 'StrongAdminPassword#2026',
      },
    });
    assert.equal(setupRes.status, 200);
    assert.equal(setupRes.data.authenticated, true);
    assert.ok(setupRes.data.adminToken);
    const adminToken1 = String(setupRes.data.adminToken);

    // Attempting a second setup must fail with 409 Conflict (single admin only)
    const duplicateSetup = await jsonReq('/api/admin/auth/setup', {
      method: 'POST',
      body: {
        username: 'attacker',
        password: 'AttackerPassword#2026',
      },
    });
    assert.equal(duplicateSetup.status, 409);

    // Test 5: Invalid admin login fails
    const badLogin = await jsonReq('/api/admin/auth/login', {
      method: 'POST',
      body: {
        username: 'Admin',
        password: 'WrongPassword123',
      },
    });
    assert.equal(badLogin.status, 401);

    // Test 4 & 15: Logout & valid re-login
    await jsonReq('/api/admin/auth/logout', { method: 'POST', adminToken: adminToken1 });
    const postLogoutOverview = await jsonReq('/api/admin/overview', { adminToken: adminToken1 });
    assert.equal(postLogoutOverview.status, 403);

    const validLogin = await jsonReq('/api/admin/auth/login', {
      method: 'POST',
      body: {
        username: 'Admin',
        password: 'StrongAdminPassword#2026',
      },
    });
    assert.equal(validLogin.status, 200);
    const adminToken = String(validLogin.data.adminToken);

    // Test 6: Register an ordinary user via OTP and ensure they CANNOT access admin routes
    const otpReq = await jsonReq('/api/auth/request-otp', {
      method: 'POST',
      body: { phone: '01098074883', displayName: 'أحمد علي', email: 'ahmed@example.com' },
    });
    assert.equal(otpReq.status, 200);
    assert.ok(otpReq.data.demoOtpPreview);

    const otpVerify = await jsonReq('/api/auth/verify-otp', {
      method: 'POST',
      body: {
        challengeId: otpReq.data.challengeId,
        phone: '01098074883',
        code: otpReq.data.demoOtpPreview,
        displayName: 'أحمد علي',
      },
    });
    assert.equal(otpVerify.status, 200);
    assert.equal(otpVerify.data.user.role, 'user');
    const userToken = String(otpVerify.data.sessionToken);
    const userId = String(otpVerify.data.user.id);

    // Ordinary OTP token sent to /api/admin/overview must be rejected (401)
    const userBlockedAdmin = await jsonReq('/api/admin/overview', { userToken });
    assert.equal(userBlockedAdmin.status, 401);

    // Even if passed in X-Admin-Authorization, ordinary session token must be rejected (403)
    const userTokenAsAdmin = await jsonReq('/api/admin/overview', { adminToken: userToken });
    assert.equal(userTokenAsAdmin.status, 403);

    // Create an imported record for this user
    const impRes = await jsonReq('/api/imports/batch', {
      method: 'POST',
      userToken,
      body: {
        sourceType: 'manual',
        fileName: 'manual-entry',
        records: [
          {
            originalSourceText: 'تم تحويل 325.00 جنيه إلى 01122334455 رقم العملية IMP-TEST-001',
            transactionType: 'send',
            amount: 325,
            phoneNumber: '01122334455',
            txTimestamp: new Date().toISOString(),
            description: 'تحويل اختبار مستورد',
            referenceCode: 'IMP-TEST-001',
          },
        ],
      },
    });
    assert.equal(impRes.status, 200);
    const importedId = String(impRes.data.insertedRecords[0].id);

    // Test 7: Overview loads real counts & user inspection works
    const overview = await jsonReq('/api/admin/overview', { adminToken });
    assert.equal(overview.status, 200);
    assert.ok(overview.data.stats.totalUsers >= 2);
    assert.ok(overview.data.stats.totalWalletRecords >= 1);
    assert.equal(overview.data.stats.totalImportedRecords, 1);

    const userDetail = await jsonReq(`/api/admin/users/${userId}`, { adminToken });
    assert.equal(userDetail.status, 200);
    assert.equal(userDetail.data.user.id, userId);
    assert.ok(userDetail.data.walletTransactions.length >= 1);
    const sampleTxId = String(userDetail.data.walletTransactions[0].id);
    const initialTxCount = userDetail.data.walletTransactions.length;

    // Test 8: Suspend & reactivate user
    const suspendRes = await jsonReq(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      adminToken,
      body: { status: 'suspended', reason: 'فحص أمني مؤقت' },
    });
    assert.equal(suspendRes.status, 200);

    // Suspended user session is immediately invalidated
    const suspendedSession = await jsonReq('/api/auth/session', { userToken });
    assert.equal(suspendedSession.data.authenticated, false);

    // Reactivate user
    const reactivateRes = await jsonReq(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      adminToken,
      body: { status: 'active', reason: 'انتهاء الفحص الأمني' },
    });
    assert.equal(reactivateRes.status, 200);

    // Re-login user via OTP
    const otpReq2 = await jsonReq('/api/auth/request-otp', {
      method: 'POST',
      body: { phone: '01098074883' },
    });
    const otpVerify2 = await jsonReq('/api/auth/verify-otp', {
      method: 'POST',
      body: {
        challengeId: otpReq2.data.challengeId,
        phone: '01098074883',
        code: otpReq2.data.demoOtpPreview,
      },
    });
    assert.equal(otpVerify2.status, 200);
    const userToken2 = String(otpVerify2.data.sessionToken);

    // Test 9 & 10: Hide & restore hidden simulated wallet tx (persists across user wallet sync)
    const hideTxRes = await jsonReq(`/api/admin/records/wallet/${userId}/${sampleTxId}/visibility`, {
      method: 'POST',
      adminToken,
      body: { action: 'hide', reason: 'إخفاء معاملة تجريبية للاختبار' },
    });
    assert.equal(hideTxRes.status, 200);
    assert.equal(hideTxRes.data.visibilityStatus, 'hidden');

    // Ordinary user session hides the hidden transaction
    const userSessAfterHide = await jsonReq('/api/auth/session', { userToken: userToken2 });
    assert.equal(
      userSessAfterHide.data.walletState.transactions.some((t: any) => t.id === sampleTxId),
      false
    );

    // Ordinary user syncing wallet via PUT /api/wallet MUST NOT erase hidden tx from SQLite
    const syncRes = await jsonReq('/api/wallet', {
      method: 'PUT',
      userToken: userToken2,
      body: {
        walletState: userSessAfterHide.data.walletState,
        lineBalance: userSessAfterHide.data.lineBalance,
        billAmount: userSessAfterHide.data.billAmount,
        billPaid: userSessAfterHide.data.billPaid,
        address: userSessAfterHide.data.address,
        biometricEnabled: userSessAfterHide.data.biometricEnabled,
      },
    });
    assert.equal(syncRes.status, 200);

    // Admin still sees the hidden tx in DB (count unchanged = not permanently deleted!)
    const detailWhileHidden = await jsonReq(`/api/admin/users/${userId}`, { adminToken });
    assert.equal(detailWhileHidden.data.walletTransactions.length, initialTxCount);
    const hiddenTxObj = detailWhileHidden.data.walletTransactions.find((t: any) => t.id === sampleTxId);
    assert.equal(hiddenTxObj.visibilityStatus, 'hidden');

    // Restore hidden tx
    const restoreTxRes = await jsonReq(`/api/admin/records/wallet/${userId}/${sampleTxId}/visibility`, {
      method: 'POST',
      adminToken,
      body: { action: 'restore_hidden', reason: 'إعادة إظهار المعاملة بعد المراجعة' },
    });
    assert.equal(restoreTxRes.status, 200);
    const userSessAfterRestore = await jsonReq('/api/auth/session', { userToken: userToken2 });
    assert.equal(
      userSessAfterRestore.data.walletState.transactions.some((t: any) => t.id === sampleTxId),
      true
    );

    // Test 11 & 12: Archive & restore archived imported record (persists in DB, hidden from user endpoint)
    const archiveImpRes = await jsonReq(`/api/admin/records/imported/${importedId}/visibility`, {
      method: 'POST',
      adminToken,
      body: { action: 'archive', reason: 'أرشفة سجل اختبار' },
    });
    assert.equal(archiveImpRes.status, 200);

    const userImportsArchived = await jsonReq('/api/imports/records', { userToken: userToken2 });
    assert.equal(userImportsArchived.data.records.length, 0);

    const restoreArchiveRes = await jsonReq(`/api/admin/records/imported/${importedId}/visibility`, {
      method: 'POST',
      adminToken,
      body: { action: 'restore_archived', reason: 'استعادة السجل من الأرشيف' },
    });
    assert.equal(restoreArchiveRes.status, 200);

    const userImportsRestored = await jsonReq('/api/imports/records', { userToken: userToken2 });
    assert.equal(userImportsRestored.data.records.length, 1);

    // Test 13 & 14: Edit eligible simulated record metadata while preserving originalSourceText & logging history
    const editImpRes = await jsonReq(`/api/admin/records/imported/${importedId}`, {
      method: 'PATCH',
      adminToken,
      body: {
        amount: 350,
        description: 'وصف مصحح من الإدارة',
        phoneNumber: '01122334455',
        referenceCode: 'IMP-TEST-001',
        reason: 'تصحيح القيمة الوصفية للاختبار',
      },
    });
    assert.equal(editImpRes.status, 200);

    const userImportsEdited = await jsonReq('/api/imports/records', { userToken: userToken2 });
    assert.equal(userImportsEdited.data.records[0].amount, 350);
    assert.equal(userImportsEdited.data.records[0].description, 'وصف مصحح من الإدارة');
    // Original source text MUST remain untouched!
    assert.equal(
      userImportsEdited.data.records[0].originalSourceText,
      'تم تحويل 325.00 جنيه إلى 01122334455 رقم العملية IMP-TEST-001'
    );

    // Test 15: Admin verifies user + verifies wallet tx & imported record + deletes both with audit snapshots
    const verifyUserRes = await jsonReq(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      adminToken,
      body: { adminVerified: true, reason: 'توثيق الحساب بعد الفحص' },
    });
    assert.equal(verifyUserRes.status, 200);

    const verifyTxRes = await jsonReq(`/api/admin/records/wallet/${userId}/${sampleTxId}/verify`, {
      method: 'POST',
      adminToken,
      body: { verified: true, note: 'معاملة مطابقة', reason: 'تحقق من معاملة المحفظة' },
    });
    assert.equal(verifyTxRes.status, 200);
    assert.equal(verifyTxRes.data.adminVerified, true);

    const verifyImpRes = await jsonReq(`/api/admin/records/imported/${importedId}/verify`, {
      method: 'POST',
      adminToken,
      body: { verified: true, note: 'سجل مطابق', reason: 'تحقق من السجل المستورد' },
    });
    assert.equal(verifyImpRes.status, 200);
    assert.equal(verifyImpRes.data.adminVerified, true);

    const staleUserSessionBeforeDelete = await jsonReq('/api/auth/session', { userToken: userToken2 });

    // Remove simulated wallet transaction
    const delTxRes = await jsonReq(`/api/admin/records/wallet/${userId}/${sampleTxId}`, {
      method: 'DELETE',
      adminToken,
      body: { reason: 'إزالة معاملة محاكاة للاختبار' },
    });
    assert.equal(delTxRes.status, 200);

    // Even if user syncs a stale local copy containing sampleTxId, server keeps it deleted!
    await jsonReq('/api/wallet', {
      method: 'PUT',
      userToken: userToken2,
      body: {
        walletState: staleUserSessionBeforeDelete.data.walletState,
        lineBalance: staleUserSessionBeforeDelete.data.lineBalance,
        billAmount: staleUserSessionBeforeDelete.data.billAmount,
        billPaid: staleUserSessionBeforeDelete.data.billPaid,
        address: staleUserSessionBeforeDelete.data.address,
        biometricEnabled: staleUserSessionBeforeDelete.data.biometricEnabled,
      },
    });
    const detailAfterDelete = await jsonReq(`/api/admin/users/${userId}`, { adminToken });
    assert.equal(detailAfterDelete.data.user.adminVerified, true);
    assert.equal(
      detailAfterDelete.data.walletTransactions.some((t: any) => t.id === sampleTxId),
      false
    );

    // Remove imported record
    const delImpRes = await jsonReq(`/api/admin/records/imported/${importedId}`, {
      method: 'DELETE',
      adminToken,
      body: { reason: 'إزالة سجل مستورد للاختبار' },
    });
    assert.equal(delImpRes.status, 200);
    const userImportsAfterDelete = await jsonReq('/api/imports/records', { userToken: userToken2 });
    assert.equal(userImportsAfterDelete.data.records.length, 0);

    // Test 16: Admin hides user account & restores hidden user (preserves all records, increments hiddenUsers KPI)
    const hideUserRes = await jsonReq(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      adminToken,
      body: { isHidden: true, reason: 'إخفاء المستخدم من القوائم مؤقتاً' },
    });
    assert.equal(hideUserRes.status, 200);

    const overviewWhileUserHidden = await jsonReq('/api/admin/overview', { adminToken });
    assert.equal(overviewWhileUserHidden.data.stats.hiddenUsers, 1);

    // User's own data remains preserved in DB while hidden
    const hiddenUserDetail = await jsonReq(`/api/admin/users/${userId}`, { adminToken });
    assert.equal(hiddenUserDetail.data.user.isHidden, true);

    const restoreUserRes = await jsonReq(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      adminToken,
      body: { isHidden: false, reason: 'استعادة المستخدم للقوائم' },
    });
    assert.equal(restoreUserRes.status, 200);

    const overviewAfterRestoreUser = await jsonReq('/api/admin/overview', { adminToken });
    assert.equal(overviewAfterRestoreUser.data.stats.hiddenUsers, 0);

    // Test 17: Admin adds a simulated wallet transaction & edits its metadata
    const addSimRes = await jsonReq(`/api/admin/records/wallet/${userId}`, {
      method: 'POST',
      adminToken,
      body: {
        type: 'send',
        amount: 410,
        phoneNumber: '01055667788',
        description: 'تحويل محاكاة مضاف من الإدارة',
        reason: 'اختبار إضافة معاملة محاكاة',
      },
    });
    assert.equal(addSimRes.status, 200);
    assert.equal(addSimRes.data.transaction.isSimulated, true);
    const addedTxId = String(addSimRes.data.transaction.id);

    const editWalletTxRes = await jsonReq(`/api/admin/records/wallet/${userId}/${addedTxId}`, {
      method: 'PATCH',
      adminToken,
      body: {
        amount: 425,
        description: 'تحويل محاكاة معدل إدارياً',
        phoneNumber: '01055667788',
        reason: 'تصحيح قيمة المعاملة المحاكاة',
      },
    });
    assert.equal(editWalletTxRes.status, 200);

    // Test 18: User data isolation — second ordinary user cannot read first user's imported records
    const otpReqUserB = await jsonReq('/api/auth/request-otp', {
      method: 'POST',
      body: { phone: '01234567890', displayName: 'سارة محمود' },
    });
    const otpVerifyUserB = await jsonReq('/api/auth/verify-otp', {
      method: 'POST',
      body: {
        challengeId: otpReqUserB.data.challengeId,
        phone: '01234567890',
        code: otpReqUserB.data.demoOtpPreview,
      },
    });
    assert.equal(otpVerifyUserB.status, 200);
    const userBImports = await jsonReq('/api/imports/records', {
      userToken: String(otpVerifyUserB.data.sessionToken),
    });
    assert.equal(userBImports.data.records.length, 0);

    const finalOverview = await jsonReq('/api/admin/overview', { adminToken });
    const historyActions = finalOverview.data.recordHistory.map((h: any) => h.action);
    assert.ok(historyActions.includes('CREATE'));
    assert.ok(historyActions.includes('HIDE'));
    assert.ok(historyActions.includes('RESTORE_HIDDEN'));
    assert.ok(historyActions.includes('ARCHIVE'));
    assert.ok(historyActions.includes('RESTORE_ARCHIVED'));
    assert.ok(historyActions.includes('METADATA_EDIT'));
    assert.ok(historyActions.includes('VERIFY'));
    assert.ok(historyActions.includes('DELETE'));
    assert.ok(finalOverview.data.auditLogs.length >= 12);

    console.log('ALL ADMIN AUTH, USER HIDE/RESTORE, SIMULATED ADD/EDIT, VERIFY, ARCHIVE, DELETE, ISOLATION & PERSISTENCE TESTS PASSED!');
  } finally {
    serverProc.stdout?.destroy();
    serverProc.stderr?.destroy();
    serverProc.kill('SIGKILL');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
