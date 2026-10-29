"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { alertTutorOfNewStudent } from "@/lib/alerts";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const here = (id: string, qs: string) => `/admin/cohorts/${id}?${qs}`;
const problem = (id: string, message: string) => here(id, `error=add&detail=${encodeURIComponent(message)}`);

function parseDates(v: string) {
  const out = new Set<string>();
  for (const line of v.split(/[\n,]+/)) {
    const s = line.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime())) out.add(s);
  }
  return [...out].sort();
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export async function createCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = get(formData, "name");
  const course_id = get(formData, "course_id");
  const starts_on = get(formData, "starts_on");
  const session_time = get(formData, "session_time");
  const minutes = parseInt(get(formData, "session_minutes"), 10);

  if (!name || !course_id || !starts_on || !session_time || !(minutes > 0)) redirect("/admin/cohorts?error=invalid");
  if (isWeekend(starts_on)) redirect("/admin/cohorts?error=weekend");

  const id = crypto.randomUUID();
  const { error } = await supabase.from("cohorts").insert({
    id, name, course_id,
    tutor_id: get(formData, "tutor_id") || null,
    starts_on,
    session_time,
    session_minutes: minutes,
    skip_dates: parseDates(get(formData, "skip_dates")),
    status: "planned",
  });
  if (error) redirect("/admin/cohorts?error=failed&detail=" + encodeURIComponent(error.message));
  revalidatePath("/admin/cohorts");
  redirect(`/admin/cohorts/${id}`);
}

export async function updateCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  const tutor_id = get(formData, "tutor_id") || null;
  const status = get(formData, "status");
  const name = get(formData, "name");
  if (!name || !["planned", "active", "completed", "cancelled"].includes(status)) redirect(here(id, "error=invalid"));

  const { data: before } = await supabase.from("cohorts").select("tutor_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("cohorts").update({ name, tutor_id, status }).eq("id", id);
  if (error) redirect(problem(id, error.message));

  // A tutor change moves all classes that have not started yet.
  if (before && before.tutor_id !== tutor_id) {
    await supabase.from("classes").update({ tutor_id }).eq("cohort_id", id).eq("status", "scheduled");
  }
  revalidatePath(`/admin/cohorts/${id}`);
  redirect(here(id, "notice=saved"));
}

export async function setSkipDates(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  await supabase.from("cohorts").update({ skip_dates: parseDates(get(formData, "skip_dates")) }).eq("id", id);
  revalidatePath(`/admin/cohorts/${id}`);
  redirect(here(id, "notice=holidays"));
}

export async function generateSchedule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  const { data, error } = await supabase.rpc("generate_cohort_schedule", { coh: id });
  if (error) redirect(here(id, "error=generate"));
  revalidatePath(`/admin/cohorts/${id}`);
  revalidatePath("/dashboard");
  redirect(here(id, `generated=${data ?? 0}`));
}

async function tellAdded(supabase: SupabaseClient, studentId: string, cohortId: string) {
  await alertTutorOfNewStudent(studentId, cohortId);
  const { data: coh } = await supabase.from("cohorts").select("name, courses(title)").eq("id", cohortId).maybeSingle();
  const info = coh as unknown as { name: string; courses: { title: string } | null } | null;
  await notifyUser(supabase, studentId, {
    title: `You have been added to ${info?.name ?? "your cohort"}`,
    body: `Your schedule for ${info?.courses?.title ?? "your course"} is ready. Open your dashboard to see your next class.`,
    path: "/dashboard",
    buttonLabel: "See my schedule",
  });
}

// Adds students who have already paid (an active enrollment with no cohort yet)
export async function addWaitingToCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohort_id = get(formData, "cohort_id");
  const ids = formData.getAll("enrollment_id").map(String).filter(Boolean);
  if (!cohort_id) redirect("/admin/cohorts");
  if (ids.length === 0) redirect(here(cohort_id, "error=none"));

  const { data: updated, error } = await supabase
    .from("enrollments").update({ cohort_id }).in("id", ids).select("id, student_id");
  if (error) redirect(problem(cohort_id, error.message));

  const rows = (updated ?? []) as { id: string; student_id: string }[];
  for (const r of rows) await tellAdded(supabase, r.student_id, cohort_id);

  revalidatePath(`/admin/cohorts/${cohort_id}`);
  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard");
  redirect(here(cohort_id, `added=${rows.length}`));
}

// Enrolls any student straight into the cohort (for payments made outside the site)
export async function addStudentToCohort(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const cohort_id = get(formData, "cohort_id");
  const student_id = get(formData, "student_id");
  const course_id = get(formData, "course_id");
  if (!cohort_id) redirect("/admin/cohorts");
  if (!student_id || !course_id) redirect(here(cohort_id, "error=none"));

  const { data: existing, error: lookup } = await supabase
    .from("enrollments").select("id, status").eq("course_id", course_id).eq("student_id", student_id).maybeSingle();
  if (lookup) redirect(problem(cohort_id, lookup.message));

  const now = new Date().toISOString();
  let failure: { message: string } | null = null;

  if (existing) {
    const patch: Record<string, string | null> = { cohort_id };
    if (existing.status !== "active") {
      patch.status = "active";
      patch.starts_at = now;
      patch.expires_at = null;
      patch.completed_at = null;
      patch.payment_confirmed_at = now;
      patch.payment_confirmed_by = user.id;
    }
    const res = await supabase.from("enrollments").update(patch).eq("id", existing.id);
    failure = res.error;
  } else {
    const res = await supabase.from("enrollments").insert({
      course_id, student_id, cohort_id, status: "active", starts_at: now,
      payment_confirmed_at: now, payment_confirmed_by: user.id,
    });
    failure = res.error;
  }
  if (failure) redirect(problem(cohort_id, failure.message));

  await tellAdded(supabase, student_id, cohort_id);
  revalidatePath(`/admin/cohorts/${cohort_id}`);
  revalidatePath("/admin/enrollments");
  redirect(here(cohort_id, "added=1"));
}

export async function removeStudentFromCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enrollment_id = get(formData, "enrollment_id");
  const cohort_id = get(formData, "cohort_id");
  const { error } = await supabase.from("enrollments").update({ cohort_id: null }).eq("id", enrollment_id);
  if (error) redirect(problem(cohort_id, error.message));
  revalidatePath(`/admin/cohorts/${cohort_id}`);
  revalidatePath("/admin/enrollments");
  redirect(here(cohort_id, "removed=1"));
}
