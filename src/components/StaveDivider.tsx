const NOTES: [number, number][] = [
  [50, 40], [110, 35], [170, 30], [230, 25], [290, 20], [350, 25], [410, 30], [470, 35], [530, 40],
];

// A five-line stave with a short melody and a playhead that slowly sweeps across it.
export default function StaveDivider({
  className = "", tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const line = tone === "light" ? "#bfa26b" : "#a88b4a";
  const note = tone === "light" ? "#ead39e" : "#0b1423";
  return (
    <svg viewBox="0 0 600 60" className={`h-auto w-full ${className}`} aria-hidden="true" role="presentation">
      <g stroke={line} strokeOpacity={tone === "light" ? 0.45 : 0.6} strokeWidth="1">
        {[10, 20, 30, 40, 50].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} />
        ))}
      </g>
      <g fill={note} stroke={note}>
        {NOTES.map(([x, y]) => {
          const up = y >= 30;
          const stemX = up ? x + 5.6 : x - 5.6;
          return (
            <g key={x}>
              <ellipse cx={x} cy={y} rx="6.5" ry="4.8" transform={`rotate(-20 ${x} ${y})`} stroke="none" />
              <line x1={stemX} x2={stemX} y1={y} y2={up ? y - 28 : y + 28} strokeWidth="1.6" />
            </g>
          );
        })}
      </g>
      <rect className="playhead" x="0" y="2" width="2" height="56" fill={line} opacity="0.8" />
    </svg>
  );
}
