"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

export async function requestEnrollment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const courseId = String(formData.get("course_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const { error } = await supabase
    .from("enrollments")
    .insert({ course_id: courseId, student_id: user.id, status: "pending" });
  // 23505 = already requested; fine.
  if (error && error.code !== "23505") redirect(`/courses/${slug}?error=failed`);

  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  redirect(`/courses/${slug}`);
}
