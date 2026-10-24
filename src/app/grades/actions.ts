"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { buildDetail, computeGrade, toInput } from "@/lib/grading";
import { loadCourseData } from "@/lib/grading-data";
import { notifyUser } from "@/lib/notify";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveGrade(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const id = get(formData, "enrollment_id");
  const back = `/grades/${id}`;
  const intent = get(formData, "intent");
  const fail = (code: string, detail = "") => redirect(`${back}?error=${code}${detail ? `&detail=${encodeURIComponent(detail)}` : ""}`);

  const raw = get(formData, "assessment");
  const assessment = raw === "" ? null : Number(raw);
  if (assessment !== null && (!Number.isFinite(assessment) || assessment < 0 || assessment > 100)) fail("assessment");

  const missingAsZero = formData.get("missing_as_zero") === "on";
  const force = formData.get("force") === "on";
  const comment = get(formData, "comment") || null;

  const { data: enr } = await supabase
    .from("enrollments").select("id, student_id, course_id, cohort_id, courses(title, slug)").eq("id", id).maybeSingle();
  if (!enr) redirect("/grades");
  const course = enr.courses as unknown as { title: string; slug: string } | null;

  const { data: existing } = await supabase.from("course_grades").select("status").eq("enrollment_id", id).maybeSingle();
  const now = new Date().toISOString();

  if (intent === "unpublish") {
    const { error } = await supabase.from("course_grades")
      .update({ status: "draft", published_at: null, updated_at: now }).eq("enrollment_id", id);
    if (error) fail("save", error.message);
    revalidatePath(back);
    revalidatePath("/grades");
    redirect(`${back}?saved=unpublished`);
  }

  const publish = intent === "publish";
  if (existing?.status === "published" && !publish) fail("published");

  const data = await loadCourseData(supabase, enr.course_id);
  const input = toInput(data, enr, { assessment, missingAsZero });
  const result = computeGrade(input);

  if (publish) {
    if (result.final === null) fail("nodata");
    if (!result.ready && !force) fail("notready");
  }

  const { error } = await supabase.from("course_grades").upsert(
    {
      enrollment_id: id,
      attendance_pct: result.attendance.pct,
      assignments_pct: result.assignments.pct,
      assessment_score: assessment,
      final_score: result.final,
      grade: result.grade,
      passed: result.passed,
      tutor_comment: comment,
      missing_as_zero: missingAsZero,
      detail: buildDetail(result, input),
      status: publish ? "published" : "draft",
      calculated_at: now,
      graded_by: user.id,
      published_at: publish ? now : null,
      updated_at: now,
    },
    { onConflict: "enrollment_id" }
  );
  if (error) fail("save", error.message);

  if (publish) {
    await notifyUser(supabase, enr.student_id, {
      title: `Your final grade for ${course?.title ?? "your course"} is ready`,
      body: "Your tutor has published your final grade and report. Open your course to see it.",
      path: `/my-courses/${course?.slug ?? ""}/report`,
      buttonLabel: "See my report",
    });
  }

  revalidatePath(back);
  revalidatePath("/grades");
  redirect(`${back}?saved=${publish ? "published" : "draft"}`);
}
