import { createAdminClient } from "@/lib/supabase/admin";
import { pushNotice } from "@/lib/notices";
import { sendEmail } from "@/lib/email";
import { formatWhen } from "@/lib/due";

// A class was handed to another tutor: tell the new tutor, the old tutor and the students.
// This never breaks what the person was doing, so any failure is only logged.
export async function alertClassCover(classId: string, newTutorId: string, oldTutorId: string | null, actorId: string) {
  try {
    const admin = createAdminClient();
    const { data: c } = await admin
      .from("classes").select("title, starts_at, cohort_id, course_id").eq("id", classId).maybeSingle();
    if (!c) return;

    const ids = [newTutorId, oldTutorId, actorId].filter((x): x is string => !!x);
    const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
    const info = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));
    const nameOf = (id: string | null) => (id ? info.get(id)?.full_name ?? "a tutor" : "a tutor");
    const when = formatWhen(c.starts_at);

    // The tutor who is now teaching it (no need to tell someone who just did it themselves)
    if (newTutorId !== actorId) {
      const title = `You are teaching: ${c.title}`;
      const body = `${nameOf(actorId)} has asked you to teach this class on ${when} (Ghana time).`;
      await pushNotice(admin, newTutorId, { key: `cover-new:${classId}`, title, body: () => body, url: `/classes/${classId}` });
      const to = info.get(newTutorId)?.email;
      if (to) await sendEmail({ to, subject: title, heading: title, body, path: `/classes/${classId}`, buttonLabel: "Open the class" }).catch(() => false);
    }

    // The tutor who was going to teach it
    if (oldTutorId && oldTutorId !== actorId) {
      await pushNotice(admin, oldTutorId, {
        key: `cover-old:${classId}`,
        title: `${nameOf(newTutorId)} will teach: ${c.title}`,
        body: () => `This class on ${when} has been handed to ${nameOf(newTutorId)}.`,
        url: `/classes/${classId}`,
      });
    }

    // The students of that class
    const base = admin.from("enrollments").select("student_id").eq("status", "active");
    const { data: stu } = c.cohort_id
      ? await base.eq("cohort_id", c.cohort_id)
      : c.course_id
        ? await base.eq("course_id", c.course_id)
        : { data: [] };
    for (const s of (stu ?? []) as { student_id: string }[]) {
      await pushNotice(admin, s.student_id, {
        key: `cover:${classId}`,
        title: `Tutor change: ${c.title}`,
        body: () => `${nameOf(newTutorId)} will teach this lesson on ${when} (Ghana time).`,
        url: `/classes/${classId}`,
      });
    }
  } catch (e) {
    console.error("Cover alert not sent:", e instanceof Error ? e.message : e);
  }
}
