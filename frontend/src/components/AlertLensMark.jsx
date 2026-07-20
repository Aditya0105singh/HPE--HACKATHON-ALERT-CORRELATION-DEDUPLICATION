// The AlertLens brand mark — a focusing lens/aperture bringing a single
// signal into focus, rather than a generic "fast" bolt icon. The segmented
// ring reads as camera-aperture blades; the center point is the one alert
// that made it through. Ties directly to the product name and what it does:
// many signals in, one focused answer out.
export default function AlertLensMark({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="9.4 3.4"
        opacity="0.95"
        transform="rotate(-18 12 12)"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
