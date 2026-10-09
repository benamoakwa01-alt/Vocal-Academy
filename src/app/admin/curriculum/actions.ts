"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

const back = (courseId: string, extra = "") => `/admin/curriculum?course=${courseId}${extra}`;
const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function addCourseSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const course_id = get(formData, "course_id");
  const title = get(formData, "title");
  const day = parseInt(get(formData, "day_number"), 10);
  if (!title || !Number.isInteger(day) || day < 1) redirect(back(course_id, "&error=invalid"));

  const { error } = await supabase.from("course_sessions").insert({
    course_id, title, day_number: day, objectives: get(formData, "objectives") || null,
  });
  if (error) redirect(back(course_id, "&error=exists"));
  revalidatePath("/admin/curriculum");
  redirect(back(course_id));
}

export async function bulkCreateDays(formData: FormData) {
  const { supabase } = await requireAdmin();
  const course_id = get(formData, "course_id");
  const count = parseInt(get(formData, "count"), 10);
  if (!Number.isInteger(count) || count < 1 || count > 200) redirect(back(course_id, "&error=invalid"));

  const { data } = await supabase.from("course_sessions").select("day_number").eq("course_id", course_id);
  const have = new Set((data ?? []).map((r: { day_number: number | null }) => r.day_number));
  const rows = [];
  for (let n = 1; n <= count; n++) {
    if (!have.has(n)) rows.push({ course_id, day_number: n, title: `Day ${n}` });
  }
  if (rows.length) await supabase.from("course_sessions").insert(rows);
  revalidatePath("/admin/curriculum");
  redirect(back(course_id));
}

export async function updateCourseSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = get(formData, "id");
  const course_id = get(formData, "course_id");
  const title = get(formData, "title");
  if (!title) redirect(back(course_id, "&error=invalid"));
  await supabase.from("course_sessions")
    .update({ title, objectives: get(formData, "objectives") || null }).eq("id", id);
  revalidatePath("/admin/curriculum");
  redirect(back(course_id));
}

export async function deleteCourseSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("course_sessions").delete().eq("id", get(formData, "id"));
  revalidatePath("/admin/curriculum");
  redirect(back(get(formData, "course_id")));
}
