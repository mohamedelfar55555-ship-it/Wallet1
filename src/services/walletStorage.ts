import { INITIAL_DEMO_STATE } from '../data/demoData';
import { TELECOM_DEMO_PROFILE } from '../data/telecomDemoData';
import { OperationPayload, OperationResult, Transaction, WalletState } from '../types/wallet';
import { generateTransactionId, isCreditTransaction, isValidEgyptianMobile } from '../utils/formatters';

const STORAGE_KEY = 'vfc_wallet_v8';
const TELECOM_STORAGE_KEY = 'anavf_line_v3';

export interface TelecomLineState {
  lineBalance: number;
  billAmount: number;
  billPaid: boolean;
  subscriberName: string;
  mobileNumber: string;
  address: string;
  biometricEnabled: boolean;
}

function getDefaultLineState(): TelecomLineState {
  return {
    lineBalance: TELECOM_DEMO_PROFILE.lineBalance,
    billAmount: TELECOM_DEMO_PROFILE.billAmount,
    billPaid: true,
    subscriberName: TELECOM_DEMO_PROFILE.subscriberName,
    mobileNumber: TELECOM_DEMO_PROFILE.mobileNumber,
    address: TELECOM_DEMO_PROFILE.defaultAddress,
    biometricEnabled: true,
  };
}

function cloneInitialState(): WalletState {
  return {
    version: INITIAL_DEMO_STATE.version,
    account: { ...INITIAL_DEMO_STATE.account },
    transactions: INITIAL_DEMO_STATE.transactions.map((tx) => ({ ...tx })),
  };
}

export function loadWalletState(): WalletState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = cloneInitialState();
      saveWalletState(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw) as Partial<WalletState>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.account ||
      typeof parsed.account.balance !== 'number' ||
      typeof parsed.account.accountNumber !== 'string' ||
      !Array.isArray(parsed.transactions)
    ) {
      const seeded = cloneInitialState();
      saveWalletState(seeded);
      return seeded;
    }

    return {
      version: parsed.version ?? INITIAL_DEMO_STATE.version,
      account: {
        accountNumber: parsed.account.accountNumber,
        holderName: parsed.account.holderName || INITIAL_DEMO_STATE.account.holderName,
        balance: Number(parsed.account.balance.toFixed(2)),
        currency: 'EGP',
      },
      transactions: parsed.transactions,
    };
  } catch {
    return cloneInitialState();
  }
}

export function saveWalletState(state: WalletState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues in restricted browser contexts
  }
}

export function resetWalletState(): WalletState {
  const seeded = cloneInitialState();
  saveWalletState(seeded);
  return seeded;
}

export function loadTelecomLineState(): TelecomLineState {
  try {
    const raw = window.localStorage.getItem(TELECOM_STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultLineState();
      saveTelecomLineState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<TelecomLineState>;
    if (typeof parsed.lineBalance !== 'number' || typeof parsed.billAmount !== 'number') {
      return getDefaultLineState();
    }
    return {
      lineBalance: Number(parsed.lineBalance.toFixed(2)),
      billAmount: Number(parsed.billAmount.toFixed(2)),
      billPaid: Boolean(parsed.billPaid),
      subscriberName: parsed.subscriberName || TELECOM_DEMO_PROFILE.subscriberName,
      mobileNumber: parsed.mobileNumber || TELECOM_DEMO_PROFILE.mobileNumber,
      address: parsed.address || TELECOM_DEMO_PROFILE.defaultAddress,
      biometricEnabled:
        typeof parsed.biometricEnabled === 'boolean' ? parsed.biometricEnabled : true,
    };
  } catch {
    return getDefaultLineState();
  }
}

export function saveTelecomLineState(state: TelecomLineState): void {
  try {
    window.localStorage.setItem(TELECOM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function resetTelecomLineState(): TelecomLineState {
  const initial = getDefaultLineState();
  saveTelecomLineState(initial);
  return initial;
}

export function executeWalletOperation(
  currentState: WalletState,
  payload: OperationPayload
): OperationResult {
  const cleanPhone = payload.phoneNumber.replace(/\D/g, '');
  const roundedAmount = Math.round(payload.amount * 100) / 100;

  if (!isValidEgyptianMobile(cleanPhone)) {
    return {
      success: false,
      error: 'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015.',
    };
  }

  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return {
      success: false,
      error: 'يجب أن يكون المبلغ أكبر من 0.00 ج.م.',
    };
  }

  if (roundedAmount > 50000) {
    return {
      success: false,
      error: 'الحد الأقصى للعملية الواحدة هو 50,000.00 ج.م.',
    };
  }

  const isCredit = isCreditTransaction(payload.type);
  if (!isCredit && roundedAmount > currentState.account.balance) {
    return {
      success: false,
      error: 'رصيد المحفظة غير كافٍ لإتمام هذه العملية.',
    };
  }

  const nextBalance = isCredit
    ? Math.round((currentState.account.balance + roundedAmount) * 100) / 100
    : Math.round((currentState.account.balance - roundedAmount) * 100) / 100;

  const now = new Date();
  const receiptDigits = `0259${String(Math.floor(100000000 + Math.random() * 900000000))}`;
  const newTransaction: Transaction = {
    id: generateTransactionId(now),
    type: payload.type,
    amount: roundedAmount,
    fee: payload.type === 'send' ? 1.0 : 0.0,
    receiptNumber: receiptDigits,
    phoneNumber: cleanPhone,
    timestamp: now.toISOString(),
    status: 'completed',
    description: payload.description.trim(),
  };

  const nextState: WalletState = {
    ...currentState,
    account: {
      ...currentState.account,
      balance: nextBalance,
    },
    transactions: [newTransaction, ...currentState.transactions],
  };

  saveWalletState(nextState);

  return {
    success: true,
    transaction: newTransaction,
    nextState,
  };
}
