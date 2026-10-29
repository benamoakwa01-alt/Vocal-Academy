"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { TUTOR_EARLY_START_MINUTES } from "@/lib/classes";
import { ensureRoom, roomNameFor } from "@/lib/daily";
import { syncClassRecordings } from "@/lib/recordings";

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}
function parseDate(v: string) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function createClass(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const title = text(formData, "title");
  const description = text(formData, "description");
  const tutorId = profile.role === "admin" ? text(formData, "tutor_id") || user.id : user.id;
  const courseId = text(formData, "course_id") || null;
  const start = parseDate(text(formData, "starts_at"));
  const end = parseDate(text(formData, "ends_at"));
  const studentIds = formData.getAll("student_ids").map(String).filter(Boolean);

  if (!title) redirect("/classes/new?error=title");
  if (!start || !end || end <= start) redirect("/classes/new?error=time");

  // Generate the id here so we don't need to read the row back (RLS-safe).
  const id = crypto.randomUUID();
  const { error } = await supabase.from("classes").insert({
    id,
    title,
    description: description || null,
    tutor_id: tutorId,
    course_id: courseId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  });
  if (error) redirect(error.message.includes("teaching team") ? "/classes/new?error=team" : "/classes/new?error=denied");

  if (studentIds.length) {
    const { error: e2 } = await supabase
      .from("class_students")
      .insert(studentIds.map((student_id) => ({ class_id: id, student_id })));
    if (e2) redirect(`/classes/${id}?error=students`);
  }

  revalidatePath("/classes");
  revalidatePath("/dashboard");
  redirect(`/classes/${id}`);
}

export async function startClass(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const id = text(formData, "class_id");
  const back = `/classes/${id}`;

  const { data: cls } = await supabase
    .from("classes").select("status, starts_at, ends_at, tutor_id").eq("id", id).maybeSingle();
  if (!cls) redirect("/classes");
  const { data: mayManage } = await supabase.rpc("can_manage_class", { cid: id });
  if (mayManage !== true) redirect(back);
  if (cls.status !== "scheduled") redirect(`${back}?error=state`);

  const now = Date.now();
  if (now < new Date(cls.starts_at).getTime() - TUTOR_EARLY_START_MINUTES * 60000) redirect(`${back}?error=early`);
  if (now > new Date(cls.ends_at).getTime()) redirect(`${back}?error=late`);

  // Claim the start atomically: if two people click at once, only one update matches.
  const { data: claimed } = await supabase
    .from("classes").update({ status: "live" }).eq("id", id).eq("status", "scheduled").select("id");
  if (!claimed || claimed.length === 0) redirect(`${back}?error=state`);

  const room = roomNameFor(id);
  let failed = false;
  try {
    await ensureRoom(room, Math.floor(new Date(cls.ends_at).getTime() / 1000) + 2 * 3600);
    const { error } = await supabase.from("live_sessions").upsert(
      {
        class_id: id,
        started_by: user.id,
        room_name: room,
        meeting_url: null,
        started_at: new Date().toISOString(),
        ended_at: null,
      },
      { onConflict: "class_id" }
    );
    if (error) throw error;
  } catch (e) {
    console.error("startClass failed:", e);
    failed = true;
  }

  if (failed) {
    // Put the class back so the tutor can retry. Nothing pretends to be live.
    await supabase.from("classes").update({ status: "scheduled" }).eq("id", id).eq("status", "live");
    redirect(`${back}?error=room`);
  }

  revalidatePath(back);
  revalidatePath("/dashboard");
  redirect(`${back}/room`);
}

export async function endClass(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = text(formData, "class_id");

  await supabase.from("live_sessions").update({ ended_at: new Date().toISOString() }).eq("class_id", id);
  await supabase.from("classes").update({ status: "completed" }).eq("id", id).eq("status", "live");
  await syncClassRecordings(supabase, id);

  revalidatePath(`/classes/${id}`);
  revalidatePath("/dashboard");
  redirect(`/classes/${id}`);
}

export async function cancelClass(formData: FormData) {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const id = text(formData, "class_id");

  await supabase.from("classes").update({ status: "cancelled" }).eq("id", id).eq("status", "scheduled");

  revalidatePath(`/classes/${id}`);
  revalidatePath("/dashboard");
  redirect(`/classes/${id}`);
}

export async function joinClass(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  const id = text(formData, "class_id");

  // The database decides: class is live, start time has passed, and this person has access.
  const { data: allowed } = await supabase.rpc("can_join_class", { cid: id });
  if (allowed !== true) redirect("/dashboard?notice=not-open");

  if (profile.role === "student") {
    await supabase.from("attendance").upsert(
      { class_id: id, student_id: user.id },
      { onConflict: "class_id,student_id", ignoreDuplicates: true }
    );
  }
  redirect(`/classes/${id}/room`);
}
