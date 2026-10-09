"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

const allowed = ["pending", "active", "paused", "completed", "expired", "withdrawn", "cancelled"];

export async function setEnrollmentStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!allowed.includes(status)) return;

  const patch: Record<string, string> = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  if (status === "active") {
    const { data } = await supabase.from("enrollments").select("starts_at").eq("id", id).maybeSingle();
    if (!data?.starts_at) patch.starts_at = new Date().toISOString();
  }
  await supabase.from("enrollments").update(patch).eq("id", id);
  revalidatePath("/admin/enrollments");
}

export async function enrollStudent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const course_id = String(formData.get("course_id") ?? "");
  const student_id = String(formData.get("student_id") ?? "");
  if (!course_id || !student_id) return;

  const expiresOn = String(formData.get("expires_on") ?? "");
  let expires_at: string | null = null;
  if (expiresOn) {
    const d = new Date(`${expiresOn}T23:59:59Z`);
    if (!isNaN(d.getTime())) expires_at = d.toISOString();
  }

  await supabase.from("enrollments").upsert(
    { course_id, student_id, status: "active", starts_at: new Date().toISOString(), expires_at, completed_at: null },
    { onConflict: "course_id,student_id" }
  );
  revalidatePath("/admin/enrollments");
}
