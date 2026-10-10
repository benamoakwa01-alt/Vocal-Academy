"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access";

export async function addAttachment(input: {
  assignmentId: string;
  path: string;
  filename: string;
  mime: string | null;
  size: number;
}) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") return { ok: false as const };
  if (!input.path.startsWith(`${user.id}/`)) return { ok: false as const };

  // The database only allows admins and the course instructor to attach files.
  const { error } = await supabase.from("assignment_files").insert({
    assignment_id: input.assignmentId,
    path: input.path,
    filename: input.filename.slice(0, 200),
    mime_type: input.mime,
    size_bytes: input.size,
    created_by: user.id,
  });
  if (error) {
    await supabase.storage.from("assignment-files").remove([input.path]);
    return { ok: false as const };
  }
  revalidatePath(`/assignments/${input.assignmentId}`);
  return { ok: true as const };
}

export async function removeAttachment(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") return;
  const id = String(formData.get("id") ?? "");
  const assignmentId = String(formData.get("assignment_id") ?? "");

  const { data: f } = await supabase.from("assignment_files").select("path").eq("id", id).maybeSingle();
  const { data: deleted } = await supabase.from("assignment_files").delete().eq("id", id).select("id");
  if (f && deleted && deleted.length > 0) {
    await supabase.storage.from("assignment-files").remove([f.path]);
  }
  revalidatePath(`/assignments/${assignmentId}`);
}
