import { parseCurriculum } from "@/lib/curriculum";

type Card = { label: string; value: string; sub: string | null };

// Compact summary cards built from the course's own data. A card only appears if its value exists.
export default function CourseSummary({
  lines, fallbackDuration,
}: {
  lines: string[];
  fallbackDuration: string | null;
}) {
  const p = parseCurriculum(lines);
  const get = (label: string) => p.meta.find((m) => m.label === label)?.value ?? null;

  const duration = get("Duration") ?? fallbackDuration;
  const lessons =
    get("Lessons") ?? (p.lessonCount > 0 ? `${p.lessonCount} ${p.lessonCount === 1 ? "lesson" : "lessons"}` : null);

  const cards = (
    [
      { label: "Duration", value: duration, sub: null },
      {
        label: "Lessons",
        value: lessons,
        sub: p.moduleCount > 0 ? `${p.moduleCount} ${p.moduleCount === 1 ? "module" : "modules"}` : null,
      },
      { label: "Schedule", value: get("Schedule"), sub: null },
      { label: "Session length", value: get("Session length"), sub: null },
    ] as { label: string; value: string | null; sub: string | null }[]
  ).filter((c): c is Card => !!c.value);

  if (cards.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-200 border-t-[3px] border-t-[#bfa26b] bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium text-[#7a5f1c]">{c.label}</dt>
          <dd className="mt-1 font-semibold leading-snug text-[#0b1423]">{c.value}</dd>
          {c.sub && <p className="mt-0.5 text-xs text-gray-500">{c.sub}</p>}
        </div>
      ))}
    </dl>
  );
}
