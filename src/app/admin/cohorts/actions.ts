"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

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
  if (error) {
    console.error("createCohort failed:", error);
    redirect("/admin/cohorts?error=failed&detail=" + encodeURIComponent(error.message));
  }
  revalidatePath("/admin/cohorts");
  redirect(`/admin/cohorts/${id}`);
}

export async function updateCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  const tutor_id = get(formData, "tutor_id") || null;
  const status = get(formData, "status");
  const name = get(formData, "name");
  if (!name || !["planned", "active", "completed", "cancelled"].includes(status)) redirect(`/admin/cohorts/${id}?error=invalid`);

  const { data: before } = await supabase.from("cohorts").select("tutor_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("cohorts").update({ name, tutor_id, status }).eq("id", id);
  if (error) redirect(`/admin/cohorts/${id}?error=failed`);

  // A tutor change moves all classes that haven't started yet.
  if (before && before.tutor_id !== tutor_id) {
    await supabase.from("classes").update({ tutor_id }).eq("cohort_id", id).eq("status", "scheduled");
  }
  revalidatePath(`/admin/cohorts/${id}`);
  redirect(`/admin/cohorts/${id}?notice=saved`);
}

export async function setSkipDates(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  await supabase.from("cohorts").update({ skip_dates: parseDates(get(formData, "skip_dates")) }).eq("id", id);
  revalidatePath(`/admin/cohorts/${id}`);
  redirect(`/admin/cohorts/${id}?notice=holidays`);
}

export async function generateSchedule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  const { data, error } = await supabase.rpc("generate_cohort_schedule", { coh: id });
  if (error) redirect(`/admin/cohorts/${id}?error=generate`);
  revalidatePath(`/admin/cohorts/${id}`);
  revalidatePath("/dashboard");
  redirect(`/admin/cohorts/${id}?generated=${data ?? 0}`);
}

export async function addStudentToCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const cohort_id = get(formData, "cohort_id");
  const student_id = get(formData, "student_id");
  const course_id = get(formData, "course_id");
  if (!cohort_id || !student_id || !course_id) return;

  const { data: existing } = await supabase
    .from("enrollments").select("id, status").eq("course_id", course_id).eq("student_id", student_id).maybeSingle();

  if (existing) {
    const patch: Record<string, string> = { cohort_id };
    if (existing.status === "pending") {
      patch.status = "active";
      patch.starts_at = new Date().toISOString();
    }
    await supabase.from("enrollments").update(patch).eq("id", existing.id);
  } else {
    await supabase.from("enrollments").insert({
      course_id, student_id, cohort_id, status: "active", starts_at: new Date().toISOString(),
    });
  }
  revalidatePath(`/admin/cohorts/${cohort_id}`);
  redirect(`/admin/cohorts/${cohort_id}`);
}

export async function removeStudentFromCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enrollment_id = get(formData, "enrollment_id");
  const cohort_id = get(formData, "cohort_id");
  await supabase.from("enrollments").update({ cohort_id: null }).eq("id", enrollment_id);
  revalidatePath(`/admin/cohorts/${cohort_id}`);
  redirect(`/admin/cohorts/${cohort_id}`);
}
