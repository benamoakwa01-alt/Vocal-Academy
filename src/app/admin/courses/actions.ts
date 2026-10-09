"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function createCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const title = get("title");
  if (!title) redirect("/admin/courses?error=title");

  const { error } = await supabase.from("courses").insert({
    slug: slugify(title),
    title,
    summary: get("summary") || null,
    description: get("description") || null,
    duration: get("duration") || null,
    format: get("format") || null,
    outcomes: lines(get("outcomes")),
    curriculum: lines(get("curriculum")),
    instructor_id: get("instructor_id") || null,
    published: formData.get("published") === "on",
  });
  if (error) redirect("/admin/courses?error=failed");

  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/courses");
}

export async function setPublished(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  const published = formData.get("published") === "true";
  await supabase.from("courses").update({ published }).eq("id", id);
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}
