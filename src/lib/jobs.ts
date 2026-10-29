import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClassRecordings } from "@/lib/recordings";
import { deleteRecording } from "@/lib/daily";
import { cohortExpiry, planRetention } from "@/lib/retention";
import { pushNotice } from "@/lib/notices";
import { sendEmail } from "@/lib/email";
import { submissionStatus } from "@/lib/assignments";
import { formatWhen } from "@/lib/due";

const DAY = 86400000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
function chunk<T>(list: T[], size = 40) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
const sameTime = (a: string | null, b: string | null) => (a === null || b === null ? a === b : Date.parse(a) === Date.parse(b));

// ---------------------------------------------------------------- Recording check
export type RecordingCheck = { closed: number; checked: number; found: number; failed: number; errors: string[] };

// Finds new recordings without anyone opening a page, and closes classes that were never ended in the app
export async function runRecordingCheck(admin: SupabaseClient, now: number = Date.now()): Promise<RecordingCheck> {
  const out: RecordingCheck = { closed: 0, checked: 0, found: 0, failed: 0, errors: [] };

  const stale = new Date(now - 90 * 60000).toISOString();
  const { data: live } = await admin.from("classes").select("id").eq("status", "live").lt("ends_at", stale);
  for (const c of (live ?? []) as { id: string }[]) {
    await admin.from("live_sessions").update({ ended_at: new Date(now).toISOString() }).eq("class_id", c.id);
    const { data } = await admin.from("classes").update({ status: "completed" }).eq("id", c.id).eq("status", "live").select("id");
    if (data && data.length) out.closed += 1;
  }

  const since = new Date(now - 3 * DAY).toISOString();
  const { data: cls } = await admin.from("classes").select("id").eq("status", "completed").gte("ends_at", since).limit(200);
  const ids = ((cls ?? []) as { id: string }[]).map((c) => c.id);

  const held = new Set<string>();
  for (const part of chunk(ids)) {
    const { data } = await admin.from("live_sessions").select("class_id").in("class_id", part).not("room_name", "is", null);
    for (const r of (data ?? []) as { class_id: string }[]) held.add(r.class_id);
  }
  const done = new Set<string>();
  for (const part of chunk([...held])) {
    const { data } = await admin.from("recordings").select("class_id, status").in("class_id", part);
    for (const r of (data ?? []) as { class_id: string; status: string }[]) {
      if (r.status === "ready" || r.status === "review") done.add(r.class_id);
    }
  }

  for (const id of [...held].filter((x) => !done.has(x)).slice(0, 40)) {
    const res = await syncClassRecordings(admin, id);
    out.checked += 1;
    if (res.ok) out.found += res.found;
    else if (res.reason !== "no-room") {
      out.failed += 1;
      if (out.errors.length < 3) out.errors.push(res.detail);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Daily tasks
type Rec = {
  id: string; class_id: string; provider_recording_id: string;
  expires_at: string | null; deleted_at: string | null; purged_at: string | null; keep: boolean;
};
type ClassRow = { id: string; cohort_id: string | null; course_id: string | null };
type CourseRow = { id: string; title: string; slug: string; instructor_id: string | null; recording_retention_days: number | null };

export type DailySummary = {
  dryRun: boolean;
  retention: { cohortsToWarn: number; toTrash: number; toPurge: number; expiryUpdated: number; errors: string[] };
  reminders: { students: number };
  digest: { reviewers: number; emails: number };
};

async function retentionPass(admin: SupabaseClient, dryRun: boolean, now: number) {
  const out = { cohortsToWarn: 0, toTrash: 0, toPurge: 0, expiryUpdated: 0, errors: [] as string[] };

  const { data: rData } = await admin
    .from("recordings")
    .select("id, class_id, provider_recording_id, expires_at, deleted_at, purged_at, keep")
    .is("purged_at", null);
  const recs = (rData ?? []) as Rec[];
  if (recs.length === 0) return out;

  const classes: ClassRow[] = [];
  for (const part of chunk([...new Set(recs.map((r) => r.class_id))])) {
    const { data } = await admin.from("classes").select("id, cohort_id, course_id").in("id", part);
    classes.push(...((data ?? []) as ClassRow[]));
  }
  const classById = new Map(classes.map((c) => [c.id, c]));

  const courseIds = [...new Set(classes.map((c) => c.course_id).filter((x): x is string => !!x))];
  const { data: cData } = courseIds.length
    ? await admin.from("courses").select("id, title, slug, instructor_id, recording_retention_days").in("id", courseIds)
    : { data: [] };
  const courses = new Map(((cData ?? []) as CourseRow[]).map((c) => [c.id, c]));

  const keyOf = (c: ClassRow) => c.cohort_id ?? (c.course_id ? `course:${c.course_id}` : null);
  const groups = new Map<string, ClassRow>();
  for (const c of classes) {
    const k = keyOf(c);
    if (k) groups.set(k, c);
  }

  // Each cohort's own clock
  const expiryByKey = new Map<string, string | null>();
  for (const [key, g] of groups) {
    const q = g.cohort_id
      ? admin.from("classes").select("status, ends_at").eq("cohort_id", g.cohort_id)
      : admin.from("classes").select("status, ends_at").eq("course_id", g.course_id as string).is("cohort_id", null);
    const { data } = await q;
    const days = g.course_id ? courses.get(g.course_id)?.recording_retention_days : null;
    expiryByKey.set(key, cohortExpiry((data ?? []) as { status: string; ends_at: string }[], days === null || days === undefined ? null : Number(days), now).expiresAt);
  }

  const warn = new Map<string, { classRow: ClassRow; expiresAt: string }>();
  for (const r of recs) {
    const c = classById.get(r.class_id);
    const key = c ? keyOf(c) : null;
    const exp = key ? expiryByKey.get(key) ?? null : null;

    if (!r.deleted_at && !sameTime(exp, r.expires_at)) {
      out.expiryUpdated += 1;
      if (!dryRun) await admin.from("recordings").update({ expires_at: exp }).eq("id", r.id);
    }

    const action = planRetention(r, exp, now);
    if (action === "warn" && key && exp && c) warn.set(key, { classRow: c, expiresAt: exp });
    if (action === "trash") {
      out.toTrash += 1;
      if (!dryRun) await admin.from("recordings").update({ deleted_at: new Date(now).toISOString() }).eq("id", r.id);
    }
    if (action === "purge") {
      out.toPurge += 1;
      if (!dryRun) {
        try {
          await deleteRecording(r.provider_recording_id);
          await admin.from("recordings").update({ purged_at: new Date(now).toISOString() }).eq("id", r.id);
        } catch (e) {
          out.errors.push(msg(e));
        }
      }
    }
  }

  // One warning per cohort, to its students and its tutor, a week before the recordings go to the trash
  for (const [key, { classRow, expiresAt }] of warn) {
    out.cohortsToWarn += 1;
    if (dryRun) continue;
    const course = classRow.course_id ? courses.get(classRow.course_id) : undefined;
    const when = formatWhen(expiresAt).replace(/,.*$/, "") ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
    const title = `Recordings for ${course?.title ?? "your course"} will be removed on ${when}`;

    const studentQuery = admin.from("enrollments").select("student_id").in("status", ["active", "completed"]);
    const { data: stu } = classRow.cohort_id
      ? await studentQuery.eq("cohort_id", classRow.cohort_id)
      : await studentQuery.eq("course_id", classRow.course_id as string);
    for (const s of (stu ?? []) as { student_id: string }[]) {
      await pushNotice(admin, s.student_id, {
        key: `expire:${key}`, once: true, title,
        body: () => "Watch anything you still need before then. Ask your tutor if you need more time.",
        url: course ? `/my-courses/${course.slug}` : "/my-courses",
      });
    }
    const staff = new Set<string>();
    if (course?.instructor_id) staff.add(course.instructor_id);
    if (classRow.cohort_id) {
      const { data: k } = await admin.from("cohorts").select("tutor_id").eq("id", classRow.cohort_id).maybeSingle();
      if (k?.tutor_id) staff.add(k.tutor_id);
    }
    for (const id of staff) {
      await pushNotice(admin, id, {
        key: `expire:${key}`, once: true, title,
        body: () => "Open the class and choose Keep on any recording that must not be deleted.",
        url: "/classes",
      });
    }
  }
  return out;
}

async function reminderPass(admin: SupabaseClient, dryRun: boolean, now: number) {
  let students = 0;
  const from = new Date(now).toISOString();
  const to = new Date(now + 36 * 3600000).toISOString();
  const { data: due } = await admin.from("assignments").select("id, title, course_id, due_at").gt("due_at", from).lte("due_at", to);
  for (const a of (due ?? []) as { id: string; title: string; course_id: string; due_at: string }[]) {
    const { data: enr } = await admin.from("enrollments").select("student_id").eq("course_id", a.course_id).eq("status", "active");
    const { data: subs } = await admin.from("submissions").select("student_id").eq("assignment_id", a.id);
    const handed = new Set(((subs ?? []) as { student_id: string }[]).map((s) => s.student_id));
    for (const e of (enr ?? []) as { student_id: string }[]) {
      if (handed.has(e.student_id)) continue;
      if (dryRun) {
        students += 1;
        continue;
      }
      const sent = await pushNotice(admin, e.student_id, {
        key: `due:${a.id}`, once: true, title: `Due soon: ${a.title}`,
        body: () => `Due ${formatWhen(a.due_at)} (Ghana time).`, url: `/assignments/${a.id}`,
      });
      if (sent) students += 1;
    }
  }
  return { students };
}

// One email a day to each tutor who has work waiting, instead of one email per submission
async function digestPass(admin: SupabaseClient, dryRun: boolean) {
  const out = { reviewers: 0, emails: 0 };
  const { data: sData } = await admin.from("submissions").select("id, assignment_id, student_id, updated_at").limit(5000);
  const { data: fData } = await admin.from("feedback").select("submission_id, updated_at, needs_revision").limit(5000);
  const fb = new Map(((fData ?? []) as { submission_id: string; updated_at: string; needs_revision: boolean }[]).map((f) => [f.submission_id, f]));
  const waiting = ((sData ?? []) as { id: string; assignment_id: string; student_id: string; updated_at: string }[]).filter((s) => {
    const st = submissionStatus(s, fb.get(s.id));
    return st === "submitted" || st === "resubmitted";
  });
  if (waiting.length === 0) return out;

  const assignmentIds = [...new Set(waiting.map((w) => w.assignment_id))];
  const assignments = new Map<string, { title: string; course_id: string }>();
  for (const part of chunk(assignmentIds)) {
    const { data } = await admin.from("assignments").select("id, title, course_id").in("id", part);
    for (const a of (data ?? []) as { id: string; title: string; course_id: string }[]) assignments.set(a.id, a);
  }
  const courseIds = [...new Set([...assignments.values()].map((a) => a.course_id))];
  const { data: eData } = await admin.from("enrollments").select("student_id, course_id, cohort_id").in("course_id", courseIds).limit(5000);
  const enrollment = new Map(((eData ?? []) as { student_id: string; course_id: string; cohort_id: string | null }[]).map((e) => [`${e.course_id}:${e.student_id}`, e]));
  const { data: kData } = await admin.from("cohorts").select("id, tutor_id").in("course_id", courseIds);
  const tutorOf = new Map(((kData ?? []) as { id: string; tutor_id: string | null }[]).map((k) => [k.id, k.tutor_id]));
  const { data: cData } = await admin.from("courses").select("id, instructor_id").in("id", courseIds);
  const instructorOf = new Map(((cData ?? []) as { id: string; instructor_id: string | null }[]).map((c) => [c.id, c.instructor_id]));

  const perReviewer = new Map<string, Map<string, number>>();
  for (const w of waiting) {
    const a = assignments.get(w.assignment_id);
    if (!a) continue;
    const e = enrollment.get(`${a.course_id}:${w.student_id}`);
    const reviewer = (e?.cohort_id ? tutorOf.get(e.cohort_id) : null) ?? instructorOf.get(a.course_id) ?? null;
    if (!reviewer) continue;
    const titles = perReviewer.get(reviewer) ?? new Map<string, number>();
    titles.set(a.title, (titles.get(a.title) ?? 0) + 1);
    perReviewer.set(reviewer, titles);
  }

  out.reviewers = perReviewer.size;
  if (dryRun || perReviewer.size === 0) return out;
  const { data: pData } = await admin.from("profiles").select("id, email").in("id", [...perReviewer.keys()]);
  const emailOf = new Map(((pData ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));

  for (const [id, titles] of perReviewer) {
    const to = emailOf.get(id);
    if (!to) continue;
    const total = [...titles.values()].reduce((a, b) => a + b, 0);
    const lines = [...titles.entries()].slice(0, 6).map(([t, n]) => `${t}: ${n} waiting`).join("\n");
    try {
      await sendEmail({
        to,
        subject: `${total} ${total === 1 ? "submission is" : "submissions are"} waiting for your review`,
        heading: `${total} ${total === 1 ? "submission is" : "submissions are"} waiting for your review`,
        body: lines,
        path: "/assignments",
        buttonLabel: "Open assignments",
      });
      out.emails += 1;
    } catch (e) {
      console.error("Digest email failed:", msg(e));
    }
  }
  return out;
}

export async function runDailyTasks(admin: SupabaseClient, opts: { dryRun?: boolean; now?: number } = {}): Promise<DailySummary> {
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? Date.now();
  const summary: DailySummary = {
    dryRun,
    retention: { cohortsToWarn: 0, toTrash: 0, toPurge: 0, expiryUpdated: 0, errors: [] },
    reminders: { students: 0 },
    digest: { reviewers: 0, emails: 0 },
  };
  try { summary.retention = await retentionPass(admin, dryRun, now); } catch (e) { summary.retention.errors.push(msg(e)); }
  try { summary.reminders = await reminderPass(admin, dryRun, now); } catch (e) { summary.retention.errors.push(`reminders: ${msg(e)}`); }
  try { summary.digest = await digestPass(admin, dryRun); } catch (e) { summary.retention.errors.push(`digest: ${msg(e)}`); }
  return summary;
}
