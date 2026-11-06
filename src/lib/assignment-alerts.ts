import { createAdminClient } from "@/lib/supabase/admin";
import { pushNotice } from "@/lib/notices";
import { sendEmail } from "@/lib/email";
import { assignmentNotice } from "@/lib/assignment-notice";

// Tells the active students an assignment is for (one cohort, or the whole course) that it has been posted.
// This never breaks what the tutor was doing, so any failure is only logged.
export async function alertStudentsOfAssignment(assignmentId: string) {
  try {
    const admin = createAdminClient();
    const { data: a } = await admin
      .from("assignments").select("id, title, course_id, due_at, cohort_id").eq("id", assignmentId).maybeSingle();
    if (!a) return;
    const { data: course } = await admin.from("courses").select("title").eq("id", a.course_id).maybeSingle();
    const { data: enrolled } = await admin
      .from("enrollments").select("student_id, cohort_id").eq("course_id", a.course_id).eq("status", "active");
    const ids = [...new Set(
      ((enrolled ?? []) as { student_id: string; cohort_id: string | null }[])
        .filter((e) => !a.cohort_id || e.cohort_id === a.cohort_id)
        .map((e) => e.student_id)
    )];
    if (ids.length === 0) return;

    const { data: people } = await admin.from("profiles").select("id, email").in("id", ids);
    const notice = assignmentNotice(a.title, course?.title ?? null, a.due_at);
    const path = `/assignments/${a.id}`;
    const emails = (process.env.ASSIGNMENT_EMAILS ?? "true").trim() !== "false";

    for (const p of (people ?? []) as { id: string; email: string | null }[]) {
      const sent = await pushNotice(admin, p.id, {
        key: `assignment:${a.id}`,
        once: true,
        title: notice.title,
        body: () => notice.body,
        url: path,
      });
      if (sent && emails && p.email) {
        await sendEmail({
          to: p.email,
          subject: notice.title,
          heading: notice.title,
          body: notice.body,
          path,
          buttonLabel: "Open the assignment",
        }).catch(() => false);
      }
    }
  } catch (e) {
    console.error("Assignment notice not sent:", e instanceof Error ? e.message : e);
  }
}
