"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (courseId: string, qs: string) => `/grades/settings/${courseId}?${qs}`;

export async function saveScheme(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const courseId = get(formData, "course_id");

  const a = Number(get(formData, "attendance_weight"));
  const s = Number(get(formData, "assignments_weight"));
  const f = Number(get(formData, "assessment_weight"));
  const pass = Number(get(formData, "pass_mark"));
  if (![a, s, f].every((n) => Number.isFinite(n) && n >= 0)) redirect(back(courseId, "error=weights"));
  if (Math.abs(a + s + f - 100) > 0.01) redirect(back(courseId, "error=sum"));
  if (!Number.isFinite(pass) || pass < 0 || pass > 100) redirect(back(courseId, "error=pass"));

  const bands: { min: number; grade: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const grade = get(formData, `band_grade_${i}`);
    const minRaw = get(formData, `band_min_${i}`);
    if (!grade && !minRaw) continue;
    const min = Number(minRaw);
    if (!grade || minRaw === "" || !Number.isFinite(min) || min < 0 || min > 100) redirect(back(courseId, "error=bands"));
    bands.push({ min, grade, label: get(formData, `band_label_${i}`) });
  }
  if (bands.length === 0 || !bands.some((b) => b.min === 0)) redirect(back(courseId, "error=zero"));
  bands.sort((x, y) => y.min - x.min);

  // The database only lets an admin or the course instructor save this.
  const { error } = await supabase.from("grading_schemes").upsert(
    {
      course_id: courseId, attendance_weight: a, assignments_weight: s, assessment_weight: f,
      pass_mark: pass, bands, updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id" }
  );
  if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
  revalidatePath(`/grades/settings/${courseId}`);
  revalidatePath("/grades");
  redirect(back(courseId, "saved=scheme"));
}

export async function saveWeights(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const courseId = get(formData, "course_id");
  const ids = formData.getAll("assignment_id").map(String).filter(Boolean);

  for (const id of ids) {
    const weight = Number(get(formData, `weight_${id}`));
    if (!Number.isFinite(weight) || weight < 0) redirect(back(courseId, "error=weight"));
    const { error } = await supabase.from("assignments")
      .update({ weight, counts_toward_grade: formData.get(`counts_${id}`) === "on" }).eq("id", id);
    if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
  }
  revalidatePath(`/grades/settings/${courseId}`);
  revalidatePath("/grades");
  redirect(back(courseId, "saved=weights"));
}
