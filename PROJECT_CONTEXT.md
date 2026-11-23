# Project Context — محاكاة محفظة كاش التعليمية

> **Important Notice**: This project is an **independent educational wallet & telecom UI simulation**. It does **not** impersonate Vodafone's official application, does **not** access protected data belonging to other applications, and marks all user-imported records as **unverified demo data** that never alters live financial balances.

---

## 1. Technical Architecture
- **Web & Full-Stack Core**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`dir="rtl" lang="ar"`) served by an Express (`server.ts`) backend with Node built-in `node:sqlite` (`data/demo_wallet.db`) for persistent per-user accounts, OTP challenges, user sessions, dedicated single-administrator authentication (`admin_credentials`, `admin_sessions`), wallets, imported records, import batches, `record_change_history`, and `audit_logs`.
- **PWA Layer**: Configured via `vite-plugin-pwa` (`strategies: 'injectManifest'`, custom `src/sw.ts`) with installable manifest, offline caching, and **Web Share Target** (`POST /share-target`) for shared text, URLs, images, CSV, and JSON files.
- **Native Android Layer (Capacitor Wrapper)**: `capacitor.config.ts` (`com.demo.wallet.simulator`, `webDir: 'dist'`) + native Kotlin plugins in `/android-capacitor/` (`SimInfoPlugin.kt`, `ShareBridgePlugin.kt`, `MlKitOcrPlugin.kt`, `AndroidManifest.permissions.xml`) ready for Android Studio / Gradle APK compilation.

---

## 2. Navigation, More Menu & Central Admin Panel
### Main App Navigation (`src/components/BottomNav.tsx`, `src/App.tsx`)
- Opens directly on the **Home** screen (`home`).
- Bottom navigation bar preserves the original 5-slot RTL bar: **الرئيسية** (`home`), **عروض** (`offers`), raised center **الملف الشخصي** (`ProfileScreen`), **تسوّق** (`internet`), and **المزيد** (`more`) positioned on the far left.
- Tapping **فودافون كاش** on Home or inside **المزيد** launches the wallet with the 2-stage opening transition (`WalletDashboardScreen`).

### Dedicated More Screen (`src/components/MoreScreen.tsx`)
Organized Arabic RTL sections accessible from **المزيد**:
1. **إعدادات الحساب**: OTP/SIM linking (`AuthSimSheet`), quick access to Vodafone Cash, Data Import (`ImportWalletDataScreen`), and Reset Demo Data confirmation.
2. **المعلومات الشخصية**: Subscriber name, phone copy button, line & wallet balances, and button to open `ProfileScreen`.
3. **الإشعارات**: Unread count & quick modal trigger.
4. **الخصوصية والأمان**: Biometric lock toggle (`biometricEnabled`) and per-user data isolation disclosure.
5. **المساعدة والدعم**: Expandable support FAQ & 7001 copy action.
6. **معلومات التطبيق**: Version (`TELECOM_DEMO_PROFILE.appVersion`) and status.
7. **دخول المسؤول**: Single administrator login entry point (hidden from Home, exposes zero admin controls to ordinary users).

### Single-Administrator Auth (`src/components/AdminLoginScreen.tsx`, `server.ts`, `server/db.ts`)
- Strictly **one administrator account** (`usr_demo_admin_01`, enforced via partial unique SQLite index `idx_single_admin_user ON users(role) WHERE role = 'admin'`).
- Dedicated credential verification separated from ordinary OTP login:
  - Supports administrator username login (default `Admin`, configurable via `ADMIN_USERNAME` or email) with `scrypt` password hashing (`crypto.timingSafeEqual`).
  - Uses `ADMIN_ACCESS_PASSWORD` env var when configured, OR atomic first-run setup (`POST /api/admin/auth/setup` using `BEGIN IMMEDIATE` inside `admin_credentials` `CHECK (id = 1)`).
  - Admin session tokens live in server `admin_sessions` (4-hour TTL) + `HttpOnly` cookie + volatile JS module memory only (never `localStorage`).
  - Ordinary OTP users always receive `role: 'user'` and are rejected (`401`/`403`) on all `/api/admin/*` endpoints.

### Central Admin Dashboard (`src/components/AdminDashboardScreen.tsx`)
1. **Overview**: Live SQLite counts (`totalUsers`, `activeUsers`, `suspendedUsers`, `totalWalletRecords`, `totalImportedRecords`, `totalImportBatches`) + recent administrative audit activity.
2. **Users Management**: Search by phone/ID/name/email; inspect individual user profile (`GET /api/admin/users/:userId`) including account info, SIM details, wallet balances, simulated transactions, imported records, and change history; verify/unverify accounts (`adminVerified`) and suspend/reactivate accounts (suspending immediately revokes user `sessions`) with required audit reason.
3. **Wallet Records Management**: Unified searchable & filterable view across `simulated_wallet_tx` and `imported_record` with visibility filtering (`visible`, `hidden`, `archived`).
   - **Verify / Unverify**: Mark simulated transactions or imported records as verified/unverified with optional note and required audit reason.
   - **Hide / Restore Hidden** & **Archive / Restore Archived**: Preserves records in SQLite without altering actual balances; hidden/archived records are filtered out from ordinary user endpoints and survive `PUT /api/wallet` syncs.
   - **Metadata Edit (Simulated Records Only)**: Updates description/amount/phone/reference with a required reason while preserving `original_source_text` / `originalSnapshot` untouched and writing immutable entries to `record_change_history` and `audit_logs`.
   - **Remove / Delete**: Deletes simulated transactions or imported records (`DELETE /api/admin/records/...`) with required reason, saves permanent `DELETE` snapshots in `record_change_history` + `audit_logs`, and prevents `PUT /api/wallet` from resurrecting admin-deleted transactions.
4. **Audit & Change History**: Dedicated inspector for `record_change_history` (showing `originalSnapshot`, `previousValue`, `newValue`, `adminId`, `reason`, `createdAt`) and `audit_logs`.

---

## 3. Verification & Commands
- **Unit & Integration Tests**:
  - `npx tsx tests/parserAndBackend.test.ts` (Arabic/English parser, duplicates, CSV)
  - `npx tsx tests/adminAndMoreIntegration.test.ts` (Isolated SQLite E2E: single-admin lock, username login/logout, ordinary OTP isolation, user inspect/verify/suspend/reactivate, tx/import verify, hide/restore & archive/restore persistence across `PUT /api/wallet` sync, metadata edit preserving `originalSourceText`, delete with audit snapshots, and `record_change_history`)
- **Run Server**: `npm run dev` (Express + Vite + SQLite on port `3000`).
- **Build & Typecheck**: `npm run build` / `npm run lint` (`tsc --noEmit`).
