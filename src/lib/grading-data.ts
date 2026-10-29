import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCHEME, type Band, type CourseData, type Scheme, type WorkState } from "@/lib/grading";
import { submissionStatus } from "@/lib/assignments";
import { isLate } from "@/lib/due";

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function parseBands(value: unknown): Band[] {
  if (!Array.isArray(value)) return DEFAULT_SCHEME.bands;
  const bands = value.flatMap((b) => {
    const min = Number((b as { min?: unknown })?.min);
    const grade = String((b as { grade?: unknown })?.grade ?? "").trim();
    const label = String((b as { label?: unknown })?.label ?? "").trim();
    return Number.isFinite(min) && grade ? [{ min, grade, label }] : [];
  });
  return bands.length ? bands : DEFAULT_SCHEME.bands;
}

export function schemeFromRow(row: Record<string, unknown> | null): Scheme {
  if (!row) return DEFAULT_SCHEME;
  return {
    attendance_weight: Number(row.attendance_weight),
    assignments_weight: Number(row.assignments_weight),
    assessment_weight: Number(row.assessment_weight),
    pass_mark: Number(row.pass_mark),
    late_penalty: Number(row.late_penalty ?? 0),
    bands: parseBands(row.bands),
  };
}

// Reads everything needed to grade one course. Row-level security limits it to what the signed-in person may see.
export async function loadCourseData(supabase: SupabaseClient, courseId: string, now: number = Date.now()): Promise<CourseData> {
  const { data: s } = await supabase.from("grading_schemes").select("*").eq("course_id", courseId).maybeSingle();
  const scheme = schemeFromRow(s as Record<string, unknown> | null);

  const { data: cData } = await supabase
    .from("classes").select("id, title, starts_at, cohort_id")
    .eq("course_id", courseId).eq("status", "completed").order("starts_at", { ascending: true });
  const classes = (cData ?? []) as CourseData["classes"];

  const attendance: CourseData["attendance"] = {};
  for (const part of chunk(classes.map((c) => c.id), 40)) {
    const { data } = await supabase.from("attendance").select("class_id, student_id, status").in("class_id", part);
    for (const r of (data ?? []) as { class_id: string; student_id: string; status: string }[]) {
      attendance[`${r.class_id}:${r.student_id}`] = r.status === "excused" ? "excused" : "present";
    }
  }

  const { data: aData } = await supabase
    .from("assignments").select("id, title, weight, counts_toward_grade, due_at")
    .eq("course_id", courseId).order("created_at", { ascending: true });
  const assignments = ((aData ?? []) as { id: string; title: string; weight: number | string; counts_toward_grade: boolean; due_at: string | null }[])
    .map((a) => ({ id: a.id, title: a.title, weight: Number(a.weight), counts: a.counts_toward_grade, due_at: a.due_at }));
  const dueOf = new Map(assignments.map((a) => [a.id, a.due_at]));

  const subs: { id: string; assignment_id: string; student_id: string; submitted_at: string; updated_at: string }[] = [];
  for (const part of chunk(assignments.map((a) => a.id), 40)) {
    const { data } = await supabase
      .from("submissions").select("id, assignment_id, student_id, submitted_at, updated_at").in("assignment_id", part);
    subs.push(...((data ?? []) as typeof subs));
  }
  const { data: fData } = await supabase
    .from("feedback").select("submission_id, score, needs_revision, updated_at").limit(5000);
  const fbBySub = new Map(
    ((fData ?? []) as { submission_id: string; score: number | null; needs_revision: boolean; updated_at: string }[])
      .map((f) => [f.submission_id, f])
  );

  const work: CourseData["work"] = {};
  for (const sub of subs) {
    const f = fbBySub.get(sub.id);
    const st = submissionStatus(sub, f);
    let state: WorkState = "pending";
    let score: number | null = null;
    if (st === "reviewed") {
      if (f && f.score !== null && f.score !== undefined) {
        state = "graded";
        score = Number(f.score);
      } else {
        state = "ungraded";
      }
    }
    work[`${sub.assignment_id}:${sub.student_id}`] = { state, score, late: isLate(sub.submitted_at, dueOf.get(sub.assignment_id) ?? null) };
  }

  return { now, scheme, classes, attendance, assignments, work };
}
