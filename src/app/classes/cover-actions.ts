"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { alertClassCover } from "@/lib/cover-alerts";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Hands a class that has not started to another tutor on the course's team
export async function changeClassTutor(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const classId = text(formData, "class_id");
  const newTutor = text(formData, "tutor_id");
  const note = text(formData, "note").slice(0, 200) || null;
  const back = `/classes/${classId}`;
  if (!newTutor) redirect(`${back}?error=cover`);

  const { data: cls } = await supabase
    .from("classes").select("tutor_id, original_tutor_id, status").eq("id", classId).maybeSingle();
  if (!cls || cls.status !== "scheduled") redirect(`${back}?error=cover`);
  if (cls.tutor_id === newTutor) redirect(back);

  // Remember who it was covered for. Handing it back to that person clears the cover.
  const original: string | null = cls.original_tutor_id ?? cls.tutor_id;
  const patch = newTutor === original
    ? { tutor_id: newTutor, original_tutor_id: null, cover_note: null }
    : { tutor_id: newTutor, original_tutor_id: original, cover_note: note };

  // The database only allows this for the course team, and only to someone on the team.
  const { data: updated, error } = await supabase
    .from("classes").update(patch).eq("id", classId).eq("status", "scheduled").select("id");
  if (error || !updated || updated.length === 0) {
    redirect(`${back}?error=${error?.message.includes("teaching team") ? "team" : "cover"}`);
  }

  await alertClassCover(classId, newTutor, cls.tutor_id, user.id);
  revalidatePath(back);
  revalidatePath("/classes");
  revalidatePath("/dashboard");
  redirect(back);
}
