// Turns the flat list of curriculum lines saved on a course into a structure the page can show.
// The saved data is never changed; every line is either shown as a summary card, a module,
// a lesson, or a plain note, so nothing is dropped or renamed.

export type Meta = { label: string; value: string };
export type Item =
  | { kind: "lesson"; number: string; title: string }
  | { kind: "note"; text: string };
export type Section = {
  module: { label: string; title: string; summary: string | null } | null; // null = lines before the first module
  items: Item[];
};
export type ParsedCurriculum = {
  meta: Meta[];
  sections: Section[];
  lessonCount: number;
  moduleCount: number;
};

const META_KEYS: [RegExp, string][] = [
  [/^duration$/i, "Duration"],
  [/^(number of lessons|total lessons|lessons)$/i, "Lessons"],
  [/^schedule$/i, "Schedule"],
  [/^(session length|session duration|lesson length|lesson duration)$/i, "Session length"],
];
const KEY_VALUE = /^([^:]{2,40}):\s*(.+)$/;
const MODULE = /^((?:module|week|unit|part)\s+\d+)\s*[:.\-\u2013\u2014]\s*(.+)$/i;
const SUMMARY = /^summary\s*:\s*(.+)$/i;
const LESSON = /^((?:lesson|day|session)\s+(\d+))\s*[:.\-\u2013\u2014]\s*(.+)$/i;

export function parseCurriculum(lines: string[]): ParsedCurriculum {
  const meta: Meta[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const kv = KEY_VALUE.exec(line);
    if (kv && !MODULE.test(line) && !LESSON.test(line)) {
      const hit = META_KEYS.find(([re]) => re.test(kv[1].trim()));
      if (hit && !meta.some((m) => m.label === hit[1])) {
        meta.push({ label: hit[1], value: kv[2].trim() });
        continue;
      }
    }

    const mod = MODULE.exec(line);
    if (mod) {
      current = { module: { label: mod[1], title: mod[2].trim(), summary: null }, items: [] };
      sections.push(current);
      continue;
    }

    // Optional: a "Summary:" line directly under a module heading is shown as that module's description
    const sum = SUMMARY.exec(line);
    if (sum && current?.module && current.module.summary === null && current.items.length === 0) {
      current.module.summary = sum[1].trim();
      continue;
    }

    if (!current) {
      current = { module: null, items: [] };
      sections.push(current);
    }
    const les = LESSON.exec(line);
    current.items.push(
      les ? { kind: "lesson", number: les[2], title: les[3].trim() } : { kind: "note", text: line }
    );
  }

  const lessonCount = sections.reduce((n, s) => n + s.items.filter((i) => i.kind === "lesson").length, 0);
  const moduleCount = sections.filter((s) => s.module).length;
  return { meta, sections, lessonCount, moduleCount };
}
