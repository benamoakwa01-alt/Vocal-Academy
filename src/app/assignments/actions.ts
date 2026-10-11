"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { notifyUser } from "@/lib/notify";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type FileInfo = { path: string; filename: string; mime_type: string | null; size_bytes: number | null };

function parseFiles(raw: string, userId: string): FileInfo[] | null {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length > 10) return null;
    const out: FileInfo[] = [];
    for (const f of arr) {
      if (!f || typeof f.path !== "string" || !f.path.startsWith(`${userId}/`) || f.path.includes("..")) return null;
      out.push({
        path: f.path,
        filename: String(f.filename ?? "file").slice(0, 200),
        mime_type: typeof f.mime_type === "string" ? f.mime_type : null,
        size_bytes: typeof f.size_bytes === "number" ? f.size_bytes : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

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

  const newId = crypto.randomUUID();
  const { error } = await supabase.from("assignments").insert({
    id: newId,
    course_id,
    course_session_id: sessionId,
    title,
    instructions: get(formData, "instructions") || null,
    created_by: user.id,
  });
  if (error) redirect("/assignments/new?error=denied");

  revalidatePath("/assignments");
  redirect(`/assignments/${newId}`);
}

export async function deleteAssignment(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/assignments");
  const id = get(formData, "id");
  const { data: files } = await supabase.from("assignment_files").select("path").eq("assignment_id", id);
  const { data: gone } = await supabase.from("assignments").delete().eq("id", id).select("id");
  if (gone && gone.length > 0 && files && files.length > 0) {
    await supabase.storage.from("assignment-files").remove(files.map((f: { path: string }) => f.path));
  }
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
  const files = parseFiles(get(formData, "files_json"), user.id);

  if (files === null || (audio && !audio.startsWith(`${user.id}/`))) redirect(`${back}?error=audio`);
  if (!text && !audio && files.length === 0) redirect(`${back}?error=empty`);

  const { data: existing } = await supabase
    .from("submissions").select("id, audio_path")
    .eq("assignment_id", assignmentId).eq("student_id", user.id).maybeSingle();

  let subId: string;
  if (existing) {
    subId = existing.id;
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
    subId = crypto.randomUUID();
    const { error } = await supabase.from("submissions").insert({
      id: subId, assignment_id: assignmentId, student_id: user.id, text_body: text || null, audio_path: audio,
    });
    if (error) redirect(`${back}?error=denied`);
  }

  // Keep the attached files in step with what the student chose
  const { data: old } = await supabase.from("submission_files").select("id, path").eq("submission_id", subId);
  const oldRows = (old ?? []) as { id: string; path: string }[];
  const keep = new Set(files.map((f) => f.path));
  const removed = oldRows.filter((o) => !keep.has(o.path));
  if (removed.length) {
    await supabase.from("submission_files").delete().in("id", removed.map((r) => r.id));
    await supabase.storage.from("submissions").remove(removed.map((r) => r.path));
  }
  const have = new Set(oldRows.map((o) => o.path));
  const fresh = files.filter((f) => !have.has(f.path));
  if (fresh.length) {
    await supabase.from("submission_files").insert(
      fresh.map((f) => ({
        submission_id: subId, path: f.path, filename: f.filename, mime_type: f.mime_type, size_bytes: f.size_bytes,
      }))
    );
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

  const revise = formData.get("needs_revision") === "on";
  const { error } = await supabase.from("feedback").upsert(
    {
      submission_id: submissionId,
      tutor_id: user.id,
      comment,
      score,
      audio_path: audio,
      needs_revision: revise,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" }
  );
  if (error) redirect(`${back}?error=denied`);

  // Tell the student
  const { data: subRow } = await supabase
    .from("submissions").select("student_id, assignments(title)").eq("id", submissionId).maybeSingle();
  const info = subRow as unknown as { student_id: string; assignments: { title: string } | null } | null;
  if (info) {
    await notifyUser(supabase, info.student_id, {
      title: `New feedback on ${info.assignments?.title ?? "your assignment"}`,
      body: revise
        ? "Your tutor has reviewed your work and asked you to revise and resubmit."
        : "Your tutor has reviewed your work. Open it to read the feedback.",
      path: `/assignments/${assignmentId}`,
      buttonLabel: "Read the feedback",
    });
  }

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/assignments");
  redirect(`/assignments/${assignmentId}?reviewed=1`);
}
