interface VodafoneRingLoaderProps {
  tone?: 'light' | 'dark';
  sizeClass?: string;
}

// Exact Vodafone teardrop silhouette matching IMG_5827_de48f2c4.jpeg
const MAIN_TEARDROP_PATH =
  'M 66 19 C 42 20, 25 37, 25 60 C 25 74, 36 85, 50 85 C 64 85, 75 74, 75 60 C 75 47, 67 38, 56 36 C 56 28, 60 22, 66 19 Z';

const OUTER_ORBIT_PATH =
  'M 67 14 C 39 15, 20 34, 20 60 C 20 77, 33 90, 50 90 C 67 90, 80 77, 80 60 C 80 44, 71 34, 60.5 31.5 C 61 24.5, 63.5 18.5, 67 14 Z';

const INNER_LINE_PATH =
  'M 62.5 23.5 C 44 25, 29.5 39.5, 29.5 60 C 29.5 71.5, 38.5 80.5, 50 80.5 C 61.5 80.5, 70.5 71.5, 70.5 60 C 70.5 49.5, 64 41.5, 52 39.5 C 52 32.5, 56 26.5, 62.5 23.5 Z';

export function VodafoneRingLoader({
  sizeClass = 'h-[88px] w-[88px]',
}: VodafoneRingLoaderProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${sizeClass}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="h-full w-full" fill="none">
        {/* Thin animated segmented orbital arcs outside the teardrop */}
        <path
          d={OUTER_ORBIT_PATH}
          pathLength={100}
          stroke="#FFFFFF"
          strokeOpacity="0.92"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="22 8 14 9 18 10 11 8"
          className="vf-orbit-glide"
        />

        {/* Crisp white primary teardrop outline */}
        <path
          d={MAIN_TEARDROP_PATH}
          stroke="#FFFFFF"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner subtle white parallel contour */}
        <path
          d={INNER_LINE_PATH}
          pathLength={100}
          stroke="#FFFFFF"
          strokeOpacity="0.72"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="34 8 24 8 18 8"
          className="vf-orbit-glide-reverse"
        />
      </svg>
    </div>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  label?: string;
}

export function LoadingOverlay({ visible, label = 'جاري التحميل' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-[70] flex justify-center pointer-events-auto"
    >
      <div className="flex h-full w-full max-w-[440px] items-center justify-center bg-[#C2C2C4]/75">
        <VodafoneRingLoader sizeClass="h-[88px] w-[88px]" />
      </div>
    </div>
  );
}
