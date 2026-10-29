// Due dates for assignments. All times are shown in Ghana time, which is UTC all year.

export type DueState = "none" | "upcoming" | "soon" | "overdue" | "closed";
export type DueInfo = { state: DueState; label: string };

const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

function distance(ms: number): string {
  if (ms >= 2 * DAY) return `${Math.floor(ms / DAY)} days`;
  if (ms >= DAY) return "1 day";
  if (ms >= 2 * HOUR) return `${Math.floor(ms / HOUR)} hours`;
  if (ms >= HOUR) return "1 hour";
  const m = Math.max(1, Math.floor(ms / MIN));
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

export function describeDue(dueAt: string | null, closesAt: string | null, now: number): DueInfo {
  if (closesAt && now >= Date.parse(closesAt)) return { state: "closed", label: `Closed ${formatWhen(closesAt)}` };
  if (!dueAt) return { state: "none", label: "No due date" };
  const due = Date.parse(dueAt);
  if (now > due) return { state: "overdue", label: `Was due ${formatWhen(dueAt)}` };
  const left = due - now;
  return { state: left <= 2 * DAY ? "soon" : "upcoming", label: `Due ${formatWhen(dueAt)} (in ${distance(left)})` };
}

export function isLate(submittedAt: string, dueAt: string | null): boolean {
  return !!dueAt && Date.parse(submittedAt) > Date.parse(dueAt);
}

// <input type="datetime-local"> values, read and written as Ghana time (UTC)
export function toInputValue(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}
export function parseInputValue(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}:00Z`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
