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

async function change(formData: FormData, patch: Record<string, unknown>, onlyIf?: { column: string; value: string }) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = text(formData, "id");
  const classId = text(formData, "class_id");
  // The database only lets the class tutor or an admin make these changes.
  let q = supabase.from("recordings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (onlyIf) q = q.eq(onlyIf.column, onlyIf.value);
  await q;
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/admin/recordings");
  revalidatePath("/my-courses");
  redirect(`/classes/${classId}`);
}

export async function approveRecording(formData: FormData) {
  return change(formData, { status: "ready" }, { column: "status", value: "review" });
}
export async function hideRecording(formData: FormData) {
  return change(formData, { status: "review" }, { column: "status", value: "ready" });
}
// Keep: never delete this recording automatically
export async function keepRecording(formData: FormData) {
  return change(formData, { keep: text(formData, "on") === "true" });
}
// Move to the trash now. It can be restored until the trash window ends.
export async function trashRecording(formData: FormData) {
  return change(formData, { deleted_at: new Date().toISOString() });
}
// Restore from the trash. It is also put on hold so the next automatic run does not remove it again.
export async function restoreRecording(formData: FormData) {
  return change(formData, { deleted_at: null, keep: true });
}
