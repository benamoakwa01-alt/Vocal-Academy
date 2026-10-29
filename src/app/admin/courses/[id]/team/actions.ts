"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { teamMemberIds } from "@/lib/team";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (courseId: string, qs = "") => `/admin/courses/${courseId}/team${qs ? `?${qs}` : ""}`;

function refresh(courseId: string) {
  revalidatePath(back(courseId));
  revalidatePath("/classes");
  revalidatePath("/dashboard");
  revalidatePath("/courses");
}

export async function addTeamMember(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = get(formData, "course_id");
  const tutorId = get(formData, "tutor_id");
  if (!courseId || !tutorId) redirect(back(courseId, "error=choose"));

  const { data: p } = await supabase.from("profiles").select("role").eq("id", tutorId).maybeSingle();
  if (!p || (p.role !== "tutor" && p.role !== "admin")) redirect(back(courseId, "error=role"));

  const { error } = await supabase.from("course_tutors")
    .upsert({ course_id: courseId, tutor_id: tutorId }, { onConflict: "course_id,tutor_id", ignoreDuplicates: true });
  if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
  refresh(courseId);
  redirect(back(courseId, "saved=added"));
}

export async function removeTeamMember(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = get(formData, "course_id");
  const tutorId = get(formData, "tutor_id");

  const { data: course } = await supabase.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
  if (course?.instructor_id === tutorId) redirect(back(courseId, "error=lead"));

  // A tutor still down to teach upcoming classes cannot be removed until those are reassigned
  const { count } = await supabase.from("classes").select("id", { count: "exact", head: true })
    .eq("course_id", courseId).eq("tutor_id", tutorId).eq("status", "scheduled")
    .gte("ends_at", new Date().toISOString());
  if ((count ?? 0) > 0) redirect(back(courseId, `error=busy&n=${count}`));

  const { error } = await supabase.from("course_tutors").delete().eq("course_id", courseId).eq("tutor_id", tutorId);
  if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
  await supabase.from("course_sessions").update({ tutor_id: null }).eq("course_id", courseId).eq("tutor_id", tutorId);
  refresh(courseId);
  redirect(back(courseId, "saved=removed"));
}

export async function setLead(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = get(formData, "course_id");
  const tutorId = get(formData, "tutor_id") || null;
  if (tutorId) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", tutorId).maybeSingle();
    if (!p || (p.role !== "tutor" && p.role !== "admin")) redirect(back(courseId, "error=role"));
  }
  const { error } = await supabase.from("courses").update({ instructor_id: tutorId }).eq("id", courseId);
  if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
  refresh(courseId);
  redirect(back(courseId, "saved=lead"));
}

// One tutor for each curriculum day. Used the next time a cohort's schedule is generated.
export async function saveTopicTutors(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = get(formData, "course_id");
  const ids = formData.getAll("session_id").map(String).filter(Boolean);
  const applyNow = formData.get("apply_now") === "on";
  const team = await teamMemberIds(supabase, courseId);
  const nowIso = new Date().toISOString();

  for (const sid of ids) {
    const tutor = get(formData, `tutor_${sid}`) || null;
    if (tutor && !team.includes(tutor)) redirect(back(courseId, "error=notteam"));
    const { error } = await supabase.from("course_sessions").update({ tutor_id: tutor }).eq("id", sid).eq("course_id", courseId);
    if (error) redirect(back(courseId, `error=save&detail=${encodeURIComponent(error.message)}`));
    if (applyNow && tutor) {
      await supabase.from("classes").update({ tutor_id: tutor })
        .eq("course_session_id", sid).eq("status", "scheduled").gt("starts_at", nowIso);
    }
  }
  refresh(courseId);
  redirect(back(courseId, "saved=topics"));
}
