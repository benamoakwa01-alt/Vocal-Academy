"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { syncClassRecordings } from "@/lib/recordings";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function refreshRecordings(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = text(formData, "class_id");
  await syncClassRecordings(supabase, id);
  revalidatePath(`/classes/${id}`);
  redirect(`/classes/${id}`);
}

async function changeStatus(formData: FormData, from: string, to: string) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = text(formData, "id");
  const classId = text(formData, "class_id");
  // The database only lets the class tutor or an admin make this change.
  await supabase.from("recordings")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", from);
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/admin/recordings");
  revalidatePath("/my-courses");
  redirect(`/classes/${classId}`);
}

// Publish to students
export async function approveRecording(formData: FormData) {
  return changeStatus(formData, "review", "ready");
}

// Take it back off the students' pages
export async function hideRecording(formData: FormData) {
  return changeStatus(formData, "ready", "review");
}
