import { createAdminClient } from "@/lib/supabase/admin";
import { pushNotice } from "@/lib/notices";
import { sendEmail } from "@/lib/email";

// Alerts must never break what the person was doing, so every one is wrapped.
async function safely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`Alert not sent (${label}):`, e instanceof Error ? e.message : e);
  }
}

// A student handed in work: tell whoever reviews it (their cohort tutor, otherwise the course instructor)
export async function alertReviewersOfSubmission(studentId: string, assignmentId: string) {
  await safely("submission", async () => {
    const admin = createAdminClient();
    const { data: a } = await admin.from("assignments").select("title, course_id").eq("id", assignmentId).maybeSingle();
    if (!a) return;
    const { data: e } = await admin.from("enrollments").select("cohort_id").eq("course_id", a.course_id).eq("student_id", studentId).maybeSingle();
    const { data: c } = await admin.from("courses").select("instructor_id").eq("id", a.course_id).maybeSingle();
    let tutor: string | null = null;
    if (e?.cohort_id) {
      const { data: k } = await admin.from("cohorts").select("tutor_id").eq("id", e.cohort_id).maybeSingle();
      tutor = k?.tutor_id ?? null;
    }
    const to = tutor ?? c?.instructor_id ?? null;
    if (!to) return;
    await pushNotice(admin, to, {
      key: `work:${assignmentId}`,
      title: `New work to review: ${a.title}`,
      body: (n) => `${n} ${n === 1 ? "student has" : "students have"} handed in work.`,
      url: `/assignments/${assignmentId}`,
    });
  });
}

async function enrollmentInfo(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: e } = await admin
    .from("enrollments").select("id, status, student_id, course_id, amount_due, payment_reference").eq("id", id).maybeSingle();
  if (!e) return null;
  const { data: p } = await admin.from("profiles").select("full_name, email").eq("id", e.student_id).maybeSingle();
  const { data: c } = await admin.from("courses").select("title").eq("id", e.course_id).maybeSingle();
  return { e, name: p?.full_name ?? p?.email ?? "A student", course: c?.title ?? "a course" };
}

async function admins(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from("profiles").select("id, email").eq("role", "admin");
  return (data ?? []) as { id: string; email: string | null }[];
}

// A student asked to enrol in a paid course: tell the admins
export async function alertEnrollmentRequest(enrollmentId: string) {
  await safely("enrollment request", async () => {
    const admin = createAdminClient();
    const info = await enrollmentInfo(admin, enrollmentId);
    if (!info || info.e.status !== "pending") return;
    for (const a of await admins(admin)) {
      await pushNotice(admin, a.id, {
        key: `enroll:${enrollmentId}`,
        title: `New enrollment request: ${info.course}`,
        body: () => `${info.name} wants to join. Amount to pay: GHS ${Number(info.e.amount_due ?? 0)}.`,
        url: "/admin/enrollments",
      });
    }
  });
}

// A student says they have paid: tell the admins in the app, and by email because it needs action
export async function alertPaymentReported(enrollmentId: string) {
  await safely("payment reported", async () => {
    const admin = createAdminClient();
    const info = await enrollmentInfo(admin, enrollmentId);
    if (!info) return;
    const title = `Payment to confirm: ${info.name}, ${info.course}`;
    const body = `${info.name} says they paid GHS ${Number(info.e.amount_due ?? 0)} for ${info.course}. Reference: ${info.e.payment_reference ?? "none given"}.`;
    for (const a of await admins(admin)) {
      await pushNotice(admin, a.id, { key: `enroll:${enrollmentId}`, title, body: () => body, url: "/admin/enrollments" });
      if (a.email) {
        await sendEmail({ to: a.email, subject: title, heading: title, body, path: "/admin/enrollments", buttonLabel: "Confirm payment" }).catch(() => false);
      }
    }
  });
}

// A student was placed in a cohort: tell that cohort's tutor
export async function alertTutorOfNewStudent(studentId: string, cohortId: string) {
  await safely("new student", async () => {
    const admin = createAdminClient();
    const { data: k } = await admin.from("cohorts").select("name, tutor_id, course_id").eq("id", cohortId).maybeSingle();
    if (!k?.tutor_id) return;
    const { data: p } = await admin.from("profiles").select("full_name").eq("id", studentId).maybeSingle();
    await pushNotice(admin, k.tutor_id, {
      key: `cohort:${cohortId}`,
      title: `New student in ${k.name}`,
      body: (n) => (n === 1 ? `${p?.full_name ?? "A student"} has joined your cohort.` : `${n} new students have joined your cohort.`),
      url: `/grades?course=${k.course_id}&cohort=${cohortId}`,
    });
  });
}
