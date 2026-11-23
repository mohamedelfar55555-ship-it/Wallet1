# محاكاة محفظة كاش وإدارة البيانات (Web + PWA + Android Capacitor)

تطبيق ويب متكامل (`React 19 + TypeScript + Vite + Express + SQLite`) جاهز للتشغيل على الويب والنشر السحابي وبناء ملف **Android APK** تلقائياً عبر **GitHub Actions**.

---

## 1. محتويات المشروع الأساسية
- **الواجهة الأمامية (`src/`)**: شاشات الهاتف، لوحة المحفظة، مركز استيراد البيانات (الحافظة / OCR / CSV / JSON / Excel / Web Share Target)، قسم المزيد، ولوحة تحكم المسؤول.
- **الخادم الخلفي (`server.ts`, `server/`)**: Express + `node:sqlite` لمصادقة المستخدمين (`OTP`) وجلسات المسؤول (`scrypt`) وسجل التدقيق.
- **إعدادات Android Capacitor**: `capacitor.config.ts` وملفات الإضافات في `android-capacitor/`.
- **مسار بناء APK التلقائي**: `.github/workflows/build-android-apk.yml`.
- **ملف حاوية الإنتاج**: `Dockerfile` و`.env.example`.

---

## 2. رفع المشروع إلى GitHub وبناء ملف APK تلقائياً (أسهل طريقة)

1. فك ضغط ملف المشروع (`wallet-project-github-ready.zip`) في مجلد على جهازك.
2. أنشئ مستودعاً جديداً (**New Repository** — يفضّل Private) على حسابك في [GitHub](https://github.com).
3. ارفع جميع الملفات (بما فيها مجلد `.github/workflows/`) عبر واجهة GitHub أو عبر الأوامر التالية:
   ```bash
   git init
   git add .
   git commit -m "Initial project upload"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
4. في صفحة المستودع على GitHub افتح تبويب **Actions**.
5. من القائمة اليسرى اختر **Build Android APK** ثم اضغط **Run workflow**.
6. في حقل **`VITE_API_BASE_URL`** أدخل رابط الخادم السحابي المنشور (مثل `https://your-service.run.app`)، أو اتركه فارغاً للتجربة المحلية، ثم اضغط **Run workflow**.
7. بعد اكتمال البناء (حوالي 3 دقائق)، انقر على مهمة البناء المكتملة ثم حمّل حزمة **`wallet-app-debug-apk`** من قسم **Artifacts**؛ بداخلها ستجد ملف **`app-debug.apk`** الجاهز للتثبيت على Android.

---

## 3. التشغيل المحلي أو النشر على الخادم

1. انسخ ملف البيئة النموذجي:
   ```bash
   cp .env.example .env
   ```
2. عيّن القيم الأساسية في `.env` (بدون حفظ أسرار داخل الكود):
   - `NODE_ENV=production` (عند النشر) أو `development` (للتطوير)
   - `SESSION_SECRET=<مفتاح عشوائي بطول 32+ حرفاً>`
   - `OTP_PROVIDER=demo` (للاختبار المحلي بدون Twilio)
   - `ADMIN_USERNAME=Admin`
   - `WALLET_DB_PATH=/app/data/demo_wallet.db` (عند النشر مع قرص دائم)
3. التثبيت والبناء والتشغيل:
   ```bash
   bun install --frozen-lockfile   # أو: npm install --legacy-peer-deps
   npm run build
   npm start                       # يشغّل الخادم والواجهة معاً عبر node server.ts
   ```
4. إعداد حساب المسؤول لأول مرة يتم بشكل آمن عبر واجهة **المزيد ← دخول المسؤول** (لا يتم تضمين أي كلمات مرور أو قاعدة بيانات خاصة داخل حزمة الرفع).
