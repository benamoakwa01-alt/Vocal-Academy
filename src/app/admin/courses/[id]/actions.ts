"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export async function updateCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const id = get("id");
  const title = get("title");
  if (!title) redirect(`/admin/courses/${id}?error=title`);

  const priceRaw = get("price");
  const price = priceRaw === "" ? null : Number(priceRaw);
  if (price !== null && (!isFinite(price) || price < 0)) redirect(`/admin/courses/${id}?error=price`);

  const { error } = await supabase.from("courses").update({
    title,
    summary: get("summary") || null,
    price_ghs: price,
    description: get("description") || null,
    duration: get("duration") || null,
    format: get("format") || null,
    outcomes: lines(get("outcomes")),
    curriculum: lines(get("curriculum")),
    instructor_id: get("instructor_id") || null,
    published: formData.get("published") === "on",
  }).eq("id", id);
  if (error) redirect(`/admin/courses/${id}?error=failed`);

  revalidatePath("/courses");
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${id}?saved=1`);
}
