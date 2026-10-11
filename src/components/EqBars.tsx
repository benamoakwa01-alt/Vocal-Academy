const DELAYS = [0, 0.35, 0.15, 0.55, 0.25, 0.45];

// Small animated equalizer bars, like the waveform on the academy crest.
export default function EqBars({ className = "h-4", bars = 4 }: { className?: string; bars?: number }) {
  return (
    <span className={`inline-flex items-end gap-[3px] align-middle ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="eq-bar"
          style={{ animationDelay: `${DELAYS[i % DELAYS.length]}s`, animationDuration: `${0.9 + (i % 3) * 0.25}s` }}
        />
      ))}
    </span>
  );
}
