"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";

const fail = (message: string) => `/admin/enrollments?error=${encodeURIComponent(message)}`;

export async function assignToCohort(formData: FormData) {
  const { supabase } = await requireAdmin();
  const enrollmentId = String(formData.get("enrollment_id") ?? "");
  const cohortId = String(formData.get("cohort_id") ?? "");
  if (!enrollmentId || !cohortId) redirect(fail("Choose a cohort first."));

  const { data, error } = await supabase
    .from("enrollments").update({ cohort_id: cohortId }).eq("id", enrollmentId).select("student_id");
  if (error || !data || data.length === 0) redirect(fail(error?.message ?? "Nothing was changed."));

  const { data: coh } = await supabase.from("cohorts").select("name, courses(title)").eq("id", cohortId).maybeSingle();
  const info = coh as unknown as { name: string; courses: { title: string } | null } | null;
  await notifyUser(supabase, data[0].student_id, {
    title: `You have been added to ${info?.name ?? "your cohort"}`,
    body: `Your schedule for ${info?.courses?.title ?? "your course"} is ready. Open your dashboard to see your next class.`,
    path: "/dashboard",
    buttonLabel: "See my schedule",
  });

  revalidatePath("/admin/enrollments");
  revalidatePath("/dashboard");
  redirect("/admin/enrollments?assigned=1");
}
