"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";

// Changes who an assignment is for: one cohort, or every cohort of the course
export async function setAssignmentCohort(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = String(formData.get("assignment_id") ?? "");
  const cohort = String(formData.get("cohort_id") ?? "") || null;

  // The database only lets an admin or the course team do this, and only for a cohort of the same course.
  const { data, error } = await supabase.from("assignments").update({ cohort_id: cohort }).eq("id", id).select("id");
  if (error || !data || data.length === 0) redirect(`/assignments/${id}?error=audience`);

  revalidatePath(`/assignments/${id}`);
  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  redirect(`/assignments/${id}`);
}
