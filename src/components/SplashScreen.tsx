import { useEffect, useState } from 'react';

interface SplashScreenProps {
  active: boolean;
  onComplete: () => void;
}

export function SplashScreen({ active, onComplete }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!active) {
      setFading(false);
      return;
    }

    setFading(false);
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, 1050);

    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, 1350);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-label="جاري تحميل التطبيق"
      className={`fixed inset-0 z-[100] flex justify-center bg-[#E8EAEE] transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex h-full w-full max-w-[440px] items-center justify-center overflow-hidden bg-[#FD0000] shadow-xl">
        <img
          src="/assets/aistudio/IMG_5815_f405a8c4.png"
          alt="فودافون"
          draggable={false}
          className={`h-full w-full object-cover object-center select-none transition-transform duration-500 ${
            fading ? 'scale-[1.22]' : 'scale-[1.18]'
          }`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[#FD0000]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-[#FD0000]"
        />
      </div>
    </div>
  );
}
