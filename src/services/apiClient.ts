import type {
  AdminAuthStatus,
  AdminOverviewData,
  AdminUserDetailData,
  DemoUserProfile,
  ImportBatchSummary,
  ImportedTransactionType,
  ImportedWalletRecord,
  ParsedTransactionCandidate,
  RecordVisibilityStatus,
  WalletState,
} from '../types/wallet';

const TOKEN_STORAGE_KEY = 'vfc_demo_session_token_v1';
const GUEST_IMPORTS_KEY = 'vfc_demo_guest_imports_v1';
const GUEST_BATCHES_KEY = 'vfc_demo_guest_batches_v1';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function resolveApiUrl(pathOrUrl: string): string {
  if (!API_BASE_URL || /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

// Admin token is intentionally stored ONLY in volatile JS memory (never localStorage/sessionStorage)
let adminTokenInMemory: string | null = null;

export function getAdminSessionToken(): string | null {
  return adminTokenInMemory;
}

export function setAdminSessionToken(token: string | null): void {
  adminTokenInMemory = token;
}

export function getStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredSessionToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(url), {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) errMsg = payload.error;
    } catch {
      // ignore non-json
    }
    throw new Error(errMsg);
  }

  return (await response.json()) as T;
}

async function adminFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  if (adminTokenInMemory && !headers.has('X-Admin-Authorization')) {
    headers.set('X-Admin-Authorization', `Bearer ${adminTokenInMemory}`);
  }

  const response = await fetch(resolveApiUrl(url), {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401 && !url.includes('/api/admin/auth/')) {
      adminTokenInMemory = null;
    }
    let errMsg = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) errMsg = payload.error;
    } catch {
      // ignore non-json
    }
    throw new Error(errMsg);
  }

  return (await response.json()) as T;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: DemoUserProfile;
  walletState?: WalletState;
  lineBalance?: number;
  billAmount?: number;
  billPaid?: boolean;
  address?: string;
  biometricEnabled?: boolean;
  error?: string;
  code?: string;
}

export interface RequestOtpResponse {
  challengeId: string;
  phone: string;
  displayNameHint: string;
  provider: 'twilio' | 'demo-sandbox';
  message: string;
  demoOtpPreview?: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResponse extends SessionResponse {
  sessionToken: string;
}

export async function fetchCurrentSession(): Promise<SessionResponse> {
  try {
    return await apiFetch<SessionResponse>('/api/auth/session');
  } catch (err) {
    return {
      authenticated: false,
      error: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function requestOtp(payload: {
  phone: string;
  email?: string;
  displayName?: string;
}): Promise<RequestOtpResponse> {
  return apiFetch<RequestOtpResponse>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyOtp(payload: {
  challengeId: string;
  phone: string;
  code: string;
  displayName?: string;
  email?: string;
}): Promise<VerifyOtpResponse> {
  const res = await apiFetch<VerifyOtpResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.sessionToken) {
    setStoredSessionToken(res.sessionToken);
  }
  return res;
}

export async function logoutSession(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setStoredSessionToken(null);
  }
}

export async function updateSimPreference(payload: {
  preferredSimSlot: number | null;
  simCarrier: string | null;
  simOperator: string | null;
  simDetectedNumber: string | null;
}): Promise<{ user: DemoUserProfile }> {
  return apiFetch<{ user: DemoUserProfile }>('/api/auth/sim-preference', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function syncWalletToServer(payload: {
  walletState: WalletState;
  lineBalance: number;
  billAmount: number;
  billPaid: boolean;
  address: string;
  biometricEnabled: boolean;
}): Promise<void> {
  await apiFetch('/api/wallet', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchImportedRecords(): Promise<{
  records: ImportedWalletRecord[];
  batches: ImportBatchSummary[];
}> {
  return apiFetch('/api/imports/records');
}

export async function submitImportBatch(payload: {
  sourceType: ParsedTransactionCandidate['sourceType'];
  fileName: string;
  records: ParsedTransactionCandidate[];
}): Promise<{
  batch: ImportBatchSummary;
  insertedRecords: ImportedWalletRecord[];
}> {
  return apiFetch('/api/imports/batch', {
    method: 'POST',
    body: JSON.stringify({
      sourceType: payload.sourceType,
      fileName: payload.fileName,
      records: payload.records.map((r) => ({
        originalSourceText: r.originalSourceText,
        transactionType: r.transactionType,
        amount: r.amount ?? 0,
        phoneNumber: r.phoneNumber,
        txTimestamp: r.txTimestamp,
        description: r.description,
        referenceCode: r.referenceCode,
      })),
    }),
  });
}

export async function updateImportedRecord(
  id: string,
  updates: {
    transactionType?: ImportedTransactionType;
    amount?: number;
    phoneNumber?: string;
    description?: string;
    referenceCode?: string;
    txTimestamp?: string;
  }
): Promise<{ record: ImportedWalletRecord }> {
  return apiFetch(`/api/imports/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteImportedRecord(id: string): Promise<void> {
  await apiFetch(`/api/imports/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function downloadServerExport(format: 'csv' | 'json'): Promise<void> {
  const token = getStoredSessionToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api/imports/export?format=${format}`, {
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('تعذر تصدير البيانات من الخادم.');
  }
  const blob = await response.blob();
  triggerBlobDownload(
    blob,
    format === 'csv' ? 'wallet-imports.csv' : 'wallet-imports.json'
  );
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Guest fallback local persistence (when not signed in yet)
export function loadGuestImports(): {
  records: ImportedWalletRecord[];
  batches: ImportBatchSummary[];
} {
  try {
    const rawR = window.localStorage.getItem(GUEST_IMPORTS_KEY);
    const rawB = window.localStorage.getItem(GUEST_BATCHES_KEY);
    const records = rawR ? (JSON.parse(rawR) as ImportedWalletRecord[]) : [];
    const batches = rawB ? (JSON.parse(rawB) as ImportBatchSummary[]) : [];
    return {
      records: Array.isArray(records) ? records : [],
      batches: Array.isArray(batches) ? batches : [],
    };
  } catch {
    return { records: [], batches: [] };
  }
}

export function saveGuestImports(
  records: ImportedWalletRecord[],
  batches: ImportBatchSummary[]
): void {
  try {
    window.localStorage.setItem(GUEST_IMPORTS_KEY, JSON.stringify(records));
    window.localStorage.setItem(GUEST_BATCHES_KEY, JSON.stringify(batches));
  } catch {
    // Ignore storage quota issues
  }
}

// ==========================================
// Dedicated Single-Admin Auth & Central Admin APIs
// ==========================================

export interface AdminLoginResponse {
  authenticated: boolean;
  adminToken: string;
  expiresAt: string;
  admin: {
    id: string;
    email: string;
    displayName: string;
  };
}

export async function fetchAdminAuthStatus(): Promise<AdminAuthStatus> {
  return adminFetch<AdminAuthStatus>('/api/admin/auth/status');
}

export async function setupInitialAdmin(payload: {
  username: string;
  password: string;
}): Promise<AdminLoginResponse> {
  const res = await adminFetch<AdminLoginResponse>('/api/admin/auth/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.adminToken) {
    setAdminSessionToken(res.adminToken);
  }
  return res;
}

export async function loginAdmin(payload: {
  username: string;
  password: string;
}): Promise<AdminLoginResponse> {
  const res = await adminFetch<AdminLoginResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.adminToken) {
    setAdminSessionToken(res.adminToken);
  }
  return res;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await adminFetch('/api/admin/auth/logout', { method: 'POST' });
  } finally {
    setAdminSessionToken(null);
  }
}

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  return adminFetch<AdminOverviewData>('/api/admin/overview');
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetailData> {
  return adminFetch<AdminUserDetailData>(`/api/admin/users/${encodeURIComponent(userId)}`);
}

export async function adminUpdateUser(
  userId: string,
  payload: {
    status?: 'active' | 'suspended';
    displayName?: string;
    adminVerified?: boolean;
    isHidden?: boolean;
    reason?: string;
  }
): Promise<void> {
  await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function adminChangeImportedVisibility(
  id: string,
  payload: {
    action: 'hide' | 'restore_hidden' | 'archive' | 'restore_archived';
    reason: string;
  }
): Promise<{ ok: boolean; visibilityStatus: RecordVisibilityStatus }> {
  return adminFetch<{ ok: boolean; visibilityStatus: RecordVisibilityStatus }>(
    `/api/admin/records/imported/${encodeURIComponent(id)}/visibility`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function adminVerifyImportedRecord(
  id: string,
  payload: { verified: boolean; note?: string; reason: string }
): Promise<{ ok: boolean; adminVerified: boolean }> {
  return adminFetch<{ ok: boolean; adminVerified: boolean }>(
    `/api/admin/records/imported/${encodeURIComponent(id)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function adminEditImportedMetadata(
  id: string,
  payload: {
    amount?: number;
    description?: string;
    phoneNumber?: string;
    referenceCode?: string;
    reason: string;
  }
): Promise<void> {
  await adminFetch(`/api/admin/records/imported/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteImportedRecord(id: string, reason: string): Promise<void> {
  await adminFetch(`/api/admin/records/imported/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export async function adminChangeWalletTxVisibility(
  userId: string,
  txId: string,
  payload: {
    action: 'hide' | 'restore_hidden' | 'archive' | 'restore_archived';
    reason: string;
  }
): Promise<{ ok: boolean; visibilityStatus: RecordVisibilityStatus }> {
  return adminFetch<{ ok: boolean; visibilityStatus: RecordVisibilityStatus }>(
    `/api/admin/records/wallet/${encodeURIComponent(userId)}/${encodeURIComponent(txId)}/visibility`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function adminVerifyWalletTx(
  userId: string,
  txId: string,
  payload: { verified: boolean; note?: string; reason: string }
): Promise<{ ok: boolean; adminVerified: boolean }> {
  return adminFetch<{ ok: boolean; adminVerified: boolean }>(
    `/api/admin/records/wallet/${encodeURIComponent(userId)}/${encodeURIComponent(txId)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function adminEditWalletTxMetadata(
  userId: string,
  txId: string,
  payload: {
    amount?: number;
    description?: string;
    phoneNumber?: string;
    reason: string;
  }
): Promise<void> {
  await adminFetch(
    `/api/admin/records/wallet/${encodeURIComponent(userId)}/${encodeURIComponent(txId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function adminDeleteWalletTx(
  userId: string,
  txId: string,
  reason: string
): Promise<void> {
  await adminFetch(
    `/api/admin/records/wallet/${encodeURIComponent(userId)}/${encodeURIComponent(txId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }
  );
}

export async function adminAddSimulatedWalletTx(
  userId: string,
  payload: {
    type: 'send' | 'receive' | 'withdraw' | 'deposit';
    amount: number;
    phoneNumber: string;
    description: string;
    reason: string;
  }
): Promise<{ ok: boolean; transaction: Record<string, unknown> }> {
  return adminFetch<{ ok: boolean; transaction: Record<string, unknown> }>(
    `/api/admin/records/wallet/${encodeURIComponent(userId)}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}
