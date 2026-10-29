// When recordings are removed. Each cohort has its own clock, so several cohorts in a month never interfere.

export const TRASH_DAYS = 14; // time in the trash before a recording is deleted for good
export const WARN_DAYS = 7;   // people are warned this long before a recording goes to the trash
const DAY = 86400000;

export type ClassTiming = { status: string; ends_at: string };

// The clock starts when the cohort's last class is over (plus one day, in case it is still wrapping up).
export function cohortExpiry(classes: ClassTiming[], retentionDays: number | null, now: number) {
  const real = classes.filter((c) => c.status !== "cancelled");
  if (real.length === 0) return { finished: false, endedAt: null as string | null, expiresAt: null as string | null };
  const latest = Math.max(...real.map((c) => Date.parse(c.ends_at)));
  const live = real.some((c) => c.status === "live");
  const finished = !live && now > latest + DAY;
  return {
    finished,
    endedAt: new Date(latest).toISOString(),
    expiresAt: finished && retentionDays !== null ? new Date(latest + retentionDays * DAY).toISOString() : null,
  };
}

export type RetentionAction = "none" | "warn" | "trash" | "purge";

export function planRetention(
  rec: { keep: boolean; deleted_at: string | null; purged_at: string | null },
  expiresAt: string | null,
  now: number
): RetentionAction {
  if (rec.purged_at || rec.keep) return "none";
  if (rec.deleted_at) return now >= Date.parse(rec.deleted_at) + TRASH_DAYS * DAY ? "purge" : "none";
  if (!expiresAt) return "none";
  const exp = Date.parse(expiresAt);
  if (now >= exp) return "trash";
  if (now >= exp - WARN_DAYS * DAY) return "warn";
  return "none";
}

export function purgeDate(deletedAt: string): string {
  return new Date(Date.parse(deletedAt) + TRASH_DAYS * DAY).toISOString();
}
