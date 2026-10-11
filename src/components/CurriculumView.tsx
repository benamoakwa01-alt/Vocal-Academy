"use client";
import { useId, useState } from "react";
import { parseCurriculum, type Item } from "@/lib/curriculum";

function LessonList({ items }: { items: Item[] }) {
  return (
    <ol className="space-y-1">
      {items.map((it, i) =>
        it.kind === "lesson" ? (
          <li key={i} className="flex items-start gap-3 rounded-lg px-2 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b1423] text-xs font-semibold text-[#ead39e]">
              {it.number}
            </span>
            <span className="pt-0.5 text-gray-800">{it.title}</span>
          </li>
        ) : (
          <li key={i} className="px-2 py-2 text-sm text-gray-600">{it.text}</li>
        )
      )}
    </ol>
  );
}

// Collapsible modules, one open at a time. All content comes from the saved curriculum lines.
export default function CurriculumView({ lines }: { lines: string[] }) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(null);

  const parsed = parseCurriculum(lines);
  const loose = parsed.sections.filter((s) => !s.module);
  const modules = parsed.sections.filter((s) => s.module);
  if (loose.length === 0 && modules.length === 0) return null;

  return (
    <div className="space-y-3">
      {loose.map((s, i) => (
        <div key={`loose-${i}`} className="rounded-xl border border-gray-200 bg-white p-2 sm:p-3">
          <LessonList items={s.items} />
        </div>
      ))}

      {modules.length > 0 && (
        <ul className="space-y-3">
          {modules.map((s, i) => {
            const mod = s.module!;
            const nums = s.items.flatMap((it) => (it.kind === "lesson" ? [it.number] : []));
            const range =
              nums.length === 0
                ? null
                : nums.length === 1
                  ? `Lesson ${nums[0]}`
                  : `Lessons ${nums[0]}\u2013${nums[nums.length - 1]}`;
            const isOpen = open === i;
            const buttonId = `${baseId}-button-${i}`;
            const panelId = `${baseId}-panel-${i}`;

            return (
              <li key={i}
                className={`overflow-hidden rounded-xl border bg-white ${isOpen ? "border-[#bfa26b]" : "border-gray-200"}`}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b1423]"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-[#7a5f1c]">{mod.label}</span>
                      <span className="block font-semibold leading-snug text-[#0b1423]">{mod.title}</span>
                      {mod.summary && <span className="mt-1 block text-sm text-gray-700">{mod.summary}</span>}
                      <span className="mt-1 block text-sm text-gray-600">
                        {nums.length} {nums.length === 1 ? "lesson" : "lessons"}
                        {range ? ` \u00b7 ${range}` : ""}
                      </span>
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      className={`h-5 w-5 shrink-0 text-[#0b1423] transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 7.5l5 5 5-5" />
                    </svg>
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}
                  className="border-t border-gray-100 p-2 sm:p-3">
                  <LessonList items={s.items} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
