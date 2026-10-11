"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function requestEnrollment(formData: FormData) {
  const { supabase } = await requireUser();
  const courseId = get(formData, "course_id");
  const slug = get(formData, "slug");
  const code = get(formData, "code");

  const { data: eid, error } = await supabase.rpc("request_enrollment", { cid: courseId, promo: code || null });
  if (error) {
    const m = error.message;
    const reason = m.includes("invalid_promo") ? "promo" : m.includes("no_price") ? "price" : "failed";
    redirect(`/courses/${slug}?error=${reason}`);
  }

  const { data: e } = await supabase.from("enrollments").select("status").eq("id", String(eid)).maybeSingle();
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  redirect(e?.status === "pending" ? `/courses/${slug}/enroll` : `/courses/${slug}`);
}

export async function reportPayment(formData: FormData) {
  const { supabase } = await requireUser();
  const slug = get(formData, "slug");
  const reference = get(formData, "reference");
  if (!reference) redirect(`/courses/${slug}/enroll?error=reference`);

  const { error } = await supabase.rpc("report_payment", { eid: get(formData, "enrollment_id"), ref: reference });
  if (error) redirect(`/courses/${slug}/enroll?error=failed`);
  revalidatePath(`/courses/${slug}/enroll`);
  redirect(`/courses/${slug}/enroll?saved=1`);
}

export async function cancelRequest(formData: FormData) {
  const { supabase } = await requireUser();
  const slug = get(formData, "slug");
  await supabase.rpc("cancel_enrollment_request", { eid: get(formData, "enrollment_id") });
  revalidatePath("/dashboard");
  redirect(`/courses/${slug}`);
}
