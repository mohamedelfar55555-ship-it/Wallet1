import { Delete } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface WalletPinSheetProps {
  open: boolean;
  onClose: () => void;
  onCompletePin: (pin: string) => void;
  onForgotPin: () => void;
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function WalletPinSheet({
  open,
  onClose,
  onCompletePin,
  onForgotPin,
}: WalletPinSheetProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (open) {
      setPin('');
    }
  }, [open]);

  const handleDigit = useCallback(
    (digit: string) => {
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + digit;
        if (next.length === 6) {
          window.setTimeout(() => {
            onCompletePin(next);
          }, 140);
        }
        return next;
      });
    },
    [onCompletePin]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleDigit, handleBackspace, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ادخل رقم المحفظة السري"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={onClose}
    >
      <div
        className="animate-view-enter flex h-[92vh] max-h-[760px] w-full max-w-[440px] flex-col items-center justify-between rounded-t-[28px] bg-[#F7F8FA] px-6 pt-6 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Section: Cash Logo + Title + 6 Teal Dots + Forgot PIN */}
        <div className="flex w-full flex-col items-center text-center">
          {/* Subtle drag handle */}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="mb-4 h-1 w-10 rounded-full bg-slate-300 cursor-pointer"
          />

          {/* Vodafone Cash Red Emblem */}
          <div className="flex flex-col items-center text-[#E60000]" aria-hidden="true">
            <svg viewBox="0 0 36 30" className="h-7 w-8" fill="none">
              <rect x="9" y="2" width="16" height="23" rx="2.5" stroke="#E60000" strokeWidth="1.9" />
              <path d="M13 10l8-3.8v6.6l-8 3.8V10Z" fill="#E60000" />
              <path d="M7 22c3-1.4 19-1.4 22 0" stroke="#E60000" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="-mt-0.5 text-[10px] font-black leading-none text-[#E60000]">كاش</span>
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-slate-950">ادخل رقم المحفظة السري</h2>

          {/* 6 PIN Dots (fill left-to-right in teal #006B7D matching 00:06-00:07) */}
          <div
            dir="ltr"
            className="mt-5 flex items-center justify-center gap-2.5"
            aria-label={`تم إدخال ${pin.length} من 6 أرقام`}
          >
            {Array.from({ length: 6 }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <span
                  key={idx}
                  className={`h-3.5 w-3.5 rounded-full transition-colors duration-150 ${
                    filled ? 'bg-[#006B7D]' : 'bg-slate-300/90'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={onForgotPin}
            className="mt-5 text-xs font-bold text-[#E60000] hover:underline cursor-pointer"
          >
            نسيت الرقم السري؟
          </button>
        </div>

        {/* Numeric Keypad 3x4 Grid (matching 00:02-00:07) */}
        <div dir="ltr" className="w-full max-w-[280px] space-y-4">
          {KEYPAD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-3 justify-items-center gap-4">
              {row.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-[24px] font-medium text-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-transform active:scale-95 active:bg-slate-100 cursor-pointer select-none"
                >
                  {digit}
                </button>
              ))}
            </div>
          ))}

          {/* Bottom Row: Spacer | 0 | Backspace */}
          <div className="grid grid-cols-3 justify-items-center gap-4">
            <div className="h-[68px] w-[68px]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-[24px] font-medium text-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-transform active:scale-95 active:bg-slate-100 cursor-pointer select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="حذف رقم"
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-slate-800 transition-transform active:scale-90 hover:bg-slate-200/60 cursor-pointer"
            >
              <Delete className="h-6 w-6 stroke-[1.6]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
