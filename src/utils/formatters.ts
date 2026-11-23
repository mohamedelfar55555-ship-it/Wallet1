import { Transaction, TransactionStatus, TransactionType } from '../types/wallet';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function normalizePhoneInput(input: string): string {
  return input.replace(/[^\d]/g, '').slice(0, 11);
}

export function isValidEgyptianMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return /^01[0125]\d{8}$/.test(digits);
}

export function formatDateTime(isoString: string): { date: string; time: string; full: string } {
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) {
    return { date: 'تاريخ غير صالح', time: '', full: 'تاريخ غير صالح' };
  }

  const date = new Intl.DateTimeFormat('ar-EG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);

  const time = new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);

  return {
    date,
    time,
    full: `${date} · ${time}`,
  };
}

export function getTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'send':
      return 'تحويل أموال';
    case 'receive':
      return 'استلام أموال';
    case 'withdraw':
      return 'سحب نقدي';
    case 'deposit':
      return 'إيداع نقدي';
  }
}

export function getTransactionStatusLabel(status: TransactionStatus): string {
  switch (status) {
    case 'completed':
      return 'مكتملة';
    case 'pending':
      return 'قيد الانتظار';
    case 'failed':
      return 'فشلت';
  }
}

export function isCreditTransaction(type: TransactionType): boolean {
  return type === 'receive' || type === 'deposit';
}

export function generateTransactionId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `VFC-${y}${m}${d}-${randomDigits}`;
}

export function generateSimulatedOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function formatTransactionSummaryForCopy(tx: Transaction): string {
  const { full } = formatDateTime(tx.timestamp);
  const sign = isCreditTransaction(tx.type) ? '+' : '-';
  return [
    'تفاصيل معاملة فودافون كاش',
    `الرقم المرجعي: ${tx.id}`,
    `نوع المعاملة: ${getTransactionTypeLabel(tx.type)}`,
    `المبلغ: ${sign}${formatCurrency(tx.amount)} ج.م`,
    `رقم الهاتف: ${formatPhoneNumber(tx.phoneNumber)}`,
    `التاريخ والوقت: ${full}`,
    `الحالة: ${getTransactionStatusLabel(tx.status)}`,
    `الوصف: ${tx.description}`,
  ].join('\n');
}
