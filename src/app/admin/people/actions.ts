"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export async function promoteToTutor(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === user.id) return;
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target || target.role === "admin") return;
  await supabase.from("profiles").update({ role: "tutor", approved: true }).eq("id", id);
  revalidatePath("/admin/people");
}

export async function removeTutor(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === user.id) return;
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target || target.role !== "tutor") return;
  await supabase.from("courses").update({ instructor_id: null }).eq("instructor_id", id);
  // Back to a student who must be re-approved before getting any access.
  await supabase.from("profiles").update({ role: "student", approved: false }).eq("id", id);
  revalidatePath("/admin/people");
}

export async function assignInstructor(formData: FormData) {
  const { supabase } = await requireAdmin();
  const course_id = String(formData.get("course_id") ?? "");
  const tutor_id = String(formData.get("tutor_id") ?? "");
  if (!course_id) return;
  if (tutor_id) {
    const { data: t } = await supabase.from("profiles").select("role").eq("id", tutor_id).maybeSingle();
    if (!t || (t.role !== "tutor" && t.role !== "admin")) return;
  }
  await supabase.from("courses").update({ instructor_id: tutor_id || null }).eq("id", course_id);
  revalidatePath("/admin/people");
  revalidatePath("/courses");
}
