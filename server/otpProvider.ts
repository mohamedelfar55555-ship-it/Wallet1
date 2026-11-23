import crypto from 'node:crypto';

export interface OtpDispatchResult {
  sent: boolean;
  provider: 'twilio' | 'demo-sandbox';
  message: string;
  demoOtpPreview?: string;
}

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtpCode(code: string, salt: string): string {
  return crypto.scryptSync(code, salt, 32).toString('hex');
}

export function verifyOtpHash(code: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtpCode(code, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function toE164Egypt(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `+2${digits}`;
  }
  return `+${digits}`;
}

export async function dispatchOtpViaAuthorizedProvider(
  phone: string,
  code: string
): Promise<OtpDispatchResult> {
  const providerMode = (process.env.OTP_PROVIDER || 'demo').toLowerCase();
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (providerMode === 'twilio' && sid && token && fromNumber) {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const body = new URLSearchParams({
      To: toE164Egypt(phone),
      From: fromNumber,
      Body: `رمز التحقق لتطبيق المحفظة: ${code}. صالح لمدة 5 دقائق.`,
    });

    const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Twilio API error');
      throw new Error(`SMS provider error (${response.status}): ${errText.slice(0, 160)}`);
    }

    return {
      sent: true,
      provider: 'twilio',
      message: 'تم إرسال رمز التحقق عبر مزود الرسائل النصية SMS.',
    };
  }

  // Authorized Demo Sandbox OTP Provider when external SMS gateway credentials are not configured
  return {
    sent: true,
    provider: 'demo-sandbox',
    message:
      'تم توليد رمز تحقق مؤقت عبر المزود المحلي (بيئة اختبار محلية — لم يتم إرسال SMS حقيقي).',
    demoOtpPreview: code,
  };
}
