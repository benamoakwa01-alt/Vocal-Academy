"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { toEmbedUrl } from "@/lib/video";

export async function addLesson(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/lessons");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const video_url = String(formData.get("video_url") ?? "").trim();
  const course_id = String(formData.get("course_id") ?? "") || null;

  if (!title) redirect("/lessons?error=title");
  if (!toEmbedUrl(video_url)) redirect("/lessons?error=link");
  if (profile.role === "tutor" && !course_id) redirect("/lessons?error=course");

  // The database rules decide whether this insert is allowed.
  const { error } = await supabase.from("lessons").insert({
    title,
    description: description || null,
    video_url,
    course_id,
    created_by: user.id,
  });
  if (error) redirect("/lessons?error=denied");

  revalidatePath("/lessons");
  redirect("/lessons");
}

export async function setLessonCourse(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") return;
  const id = String(formData.get("id"));
  const course_id = String(formData.get("course_id") ?? "") || null;
  await supabase.from("lessons").update({ course_id }).eq("id", id);
  revalidatePath("/lessons");
}

export async function deleteLesson(formData: FormData) {
  const { supabase } = await requireAccess();
  const id = String(formData.get("id"));
  await supabase.from("lessons").delete().eq("id", id);
  revalidatePath("/lessons");
}
