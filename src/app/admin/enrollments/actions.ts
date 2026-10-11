"use server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";

const allowed = ["pending", "active", "paused", "completed", "expired", "withdrawn", "cancelled"];

async function courseTitle(supabase: SupabaseClient, courseId: string) {
  const { data: c } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle();
  return c?.title ?? "your course";
}

export async function setEnrollmentStatus(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!allowed.includes(status)) return;

  const { data: before } = await supabase
    .from("enrollments").select("status, student_id, course_id, starts_at").eq("id", id).maybeSingle();
  if (!before) return;

  const patch: Record<string, string> = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  if (status === "active") {
    if (!before.starts_at) patch.starts_at = new Date().toISOString();
    if (before.status === "pending") {
      patch.payment_confirmed_at = new Date().toISOString();
      patch.payment_confirmed_by = user.id;
    }
  }
  await supabase.from("enrollments").update(patch).eq("id", id);

  const title = await courseTitle(supabase, before.course_id);
  if (status === "active" && before.status === "pending") {
    await notifyUser(supabase, before.student_id, {
      title: `Payment confirmed: you are enrolled in ${title}`,
      body: "Thank you. Your payment has been confirmed and your course access is now active. Open your dashboard to continue.",
      path: "/dashboard",
      buttonLabel: "Open my dashboard",
    });
  } else if (status === "active") {
    await notifyUser(supabase, before.student_id, {
      title: `Your enrollment in ${title} is active`,
      body: "Open your dashboard to see your next class.",
      path: "/dashboard",
      buttonLabel: "Open my dashboard",
    });
  } else if (status === "cancelled" && before.status === "pending") {
    await notifyUser(supabase, before.student_id, {
      title: `Your enrollment request for ${title} was not completed`,
      body: "We could not confirm your payment. Please contact the academy, or request enrollment again.",
      path: `/courses`,
      buttonLabel: "See courses",
    });
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard");
}

export async function enrollStudent(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const course_id = String(formData.get("course_id") ?? "");
  const student_id = String(formData.get("student_id") ?? "");
  if (!course_id || !student_id) return;

  const expiresOn = String(formData.get("expires_on") ?? "");
  let expires_at: string | null = null;
  if (expiresOn) {
    const d = new Date(`${expiresOn}T23:59:59Z`);
    if (!isNaN(d.getTime())) expires_at = d.toISOString();
  }

  const now = new Date().toISOString();
  await supabase.from("enrollments").upsert(
    {
      course_id, student_id, status: "active", starts_at: now, expires_at, completed_at: null,
      payment_confirmed_at: now, payment_confirmed_by: user.id,
    },
    { onConflict: "course_id,student_id" }
  );

  const title = await courseTitle(supabase, course_id);
  await notifyUser(supabase, student_id, {
    title: `You are enrolled in ${title}`,
    body: "Your enrollment is active. Open your dashboard to see your next class.",
    path: "/dashboard",
    buttonLabel: "Open my dashboard",
  });
  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard");
}
