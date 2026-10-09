export const TUTOR_EARLY_START_MINUTES = 15;

export type ClassRow = {
  id: string;
  title: string;
  description: string | null;
  tutor_id: string | null;
  course_id: string | null;
  cohort_id: string | null;
  course_session_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
};

export const CLASS_COLUMNS =
  "id, title, description, tutor_id, course_id, cohort_id, course_session_id, starts_at, ends_at, status";

export type LessonState =
  | "countdown" | "waiting" | "preparing" | "live" | "completed" | "cancelled" | "missed";

export function getNow() {
  return Date.now();
}

export function getLessonState(
  c: Pick<ClassRow, "status" | "starts_at" | "ends_at">,
  now: number
): LessonState {
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "completed") return "completed";
  if (c.status === "live") return now >= start ? "live" : "preparing";
  if (now < start) return "countdown";
  if (now <= end) return "waiting";
  return "missed";
}

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} day${d > 1 ? "s" : ""} ${h} hr`;
  if (h > 0) return `${h} hr ${m} min`;
  if (m >= 10) return `${m} minutes`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((dayStart(d) - dayStart(new Date())) / 86400000);
  const time = d.toLocaleTimeString(undefined, timeOpts);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff === -1) return `Yesterday, ${time}`;
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${time}`;
}

export function formatRange(startIso: string, endIso: string) {
  return `${formatWhen(startIso)} – ${new Date(endIso).toLocaleTimeString(undefined, timeOpts)}`;
}
