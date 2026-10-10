"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createAssignment(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/assignments");

  const course_id = get(formData, "course_id");
  const sessionId = get(formData, "course_session_id") || null;
  const title = get(formData, "title");
  if (!title || !course_id) redirect("/assignments/new?error=missing");

  if (sessionId) {
    const { data: s } = await supabase.from("course_sessions").select("course_id").eq("id", sessionId).maybeSingle();
    if (!s || s.course_id !== course_id) redirect("/assignments/new?error=day");
  }

  const { error } = await supabase.from("assignments").insert({
    course_id,
    course_session_id: sessionId,
    title,
    instructions: get(formData, "instructions") || null,
    created_by: user.id,
  });
  if (error) redirect("/assignments/new?error=denied");

  revalidatePath("/assignments");
  redirect("/assignments");
}

export async function deleteAssignment(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/assignments");
  await supabase.from("assignments").delete().eq("id", get(formData, "id"));
  revalidatePath("/assignments");
  redirect("/assignments");
}

export async function submitAssignment(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role !== "student") redirect("/assignments");

  const assignmentId = get(formData, "assignment_id");
  const back = `/assignments/${assignmentId}`;
  const text = get(formData, "text_body");
  const audio = get(formData, "audio_path") || null;

  if (audio && !audio.startsWith(`${user.id}/`)) redirect(`${back}?error=audio`);
  if (!text && !audio) redirect(`${back}?error=empty`);

  const { data: existing } = await supabase
    .from("submissions").select("id, audio_path")
    .eq("assignment_id", assignmentId).eq("student_id", user.id).maybeSingle();

  if (existing) {
    // The database refuses this if the work has already been reviewed.
    const { data: updated } = await supabase
      .from("submissions")
      .update({ text_body: text || null, audio_path: audio, updated_at: new Date().toISOString() })
      .eq("id", existing.id).select("id");
    if (!updated || updated.length === 0) redirect(`${back}?error=locked`);
    if (existing.audio_path && existing.audio_path !== audio) {
      await supabase.storage.from("submissions").remove([existing.audio_path]);
    }
  } else {
    const { error } = await supabase.from("submissions").insert({
      assignment_id: assignmentId, student_id: user.id, text_body: text || null, audio_path: audio,
    });
    if (error) redirect(`${back}?error=denied`);
  }

  revalidatePath(back);
  revalidatePath("/assignments");
  redirect(`${back}?done=1`);
}

export async function saveFeedback(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/assignments");

  const submissionId = get(formData, "submission_id");
  const assignmentId = get(formData, "assignment_id");
  const back = `/assignments/${assignmentId}/submissions/${submissionId}`;

  const comment = get(formData, "comment") || null;
  const scoreRaw = get(formData, "score");
  const score = scoreRaw === "" ? null : Number(scoreRaw);
  if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) redirect(`${back}?error=score`);

  const audio = get(formData, "audio_path") || null;
  if (audio && !audio.startsWith(`${user.id}/`)) redirect(`${back}?error=audio`);
  if (!comment && score === null && !audio) redirect(`${back}?error=empty`);

  const { error } = await supabase.from("feedback").upsert(
    {
      submission_id: submissionId,
      tutor_id: user.id,
      comment,
      score,
      audio_path: audio,
      needs_revision: formData.get("needs_revision") === "on",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" }
  );
  if (error) redirect(`${back}?error=denied`);

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/assignments");
  redirect(`/assignments/${assignmentId}?reviewed=1`);
}
