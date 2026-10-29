import type { SupabaseClient } from "@supabase/supabase-js";

// Courses a person teaches: the ones they lead, plus the ones whose team they are on
export async function myCourseIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();
  const { data: led } = await supabase.from("courses").select("id").eq("instructor_id", userId);
  for (const c of (led ?? []) as { id: string }[]) ids.add(c.id);
  const { data: team } = await supabase.from("course_tutors").select("course_id").eq("tutor_id", userId);
  for (const t of (team ?? []) as { course_id: string }[]) ids.add(t.course_id);
  return [...ids];
}

// The lead instructor first, then everyone else on the team
export async function teamMemberIds(supabase: SupabaseClient, courseId: string): Promise<string[]> {
  const ids: string[] = [];
  const { data: c } = await supabase.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
  if (c?.instructor_id) ids.push(c.instructor_id);
  const { data } = await supabase.from("course_tutors").select("tutor_id").eq("course_id", courseId);
  for (const r of (data ?? []) as { tutor_id: string }[]) {
    if (!ids.includes(r.tutor_id)) ids.push(r.tutor_id);
  }
  return ids;
}

// Every course's team, for forms that need to filter tutors by course
export async function teamsByCourse(supabase: SupabaseClient): Promise<Record<string, string[]>> {
  const teams: Record<string, string[]> = {};
  const { data: leads } = await supabase.from("courses").select("id, instructor_id");
  for (const l of (leads ?? []) as { id: string; instructor_id: string | null }[]) {
    if (l.instructor_id) teams[l.id] = [l.instructor_id];
  }
  const { data: rows } = await supabase.from("course_tutors").select("course_id, tutor_id");
  for (const r of (rows ?? []) as { course_id: string; tutor_id: string }[]) {
    const list = teams[r.course_id] ?? [];
    if (!list.includes(r.tutor_id)) list.push(r.tutor_id);
    teams[r.course_id] = list;
  }
  return teams;
}

// Can this person teach this course? Admins always can.
export async function tutorOnTeam(supabase: SupabaseClient, courseId: string, tutorId: string): Promise<boolean> {
  const { data: p } = await supabase.from("profiles").select("role").eq("id", tutorId).maybeSingle();
  if (p?.role === "admin") return true;
  return (await teamMemberIds(supabase, courseId)).includes(tutorId);
}
