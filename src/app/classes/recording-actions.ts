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

// Only an admin can approve a flagged recording, so a tutor can't wave through a short one.
export async function approveRecording(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role !== "admin") redirect("/dashboard");
  const id = text(formData, "id");
  const classId = text(formData, "class_id");
  await supabase.from("recordings").update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "review");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/admin/recordings");
  redirect(`/classes/${classId}`);
}
