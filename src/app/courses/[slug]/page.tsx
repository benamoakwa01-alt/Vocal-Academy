import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { requestEnrollment } from "../actions";
import ClassList from "@/components/ClassList";
import EnrollmentRequired from "@/components/EnrollmentRequired";

export default async function CoursePage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireUser();

  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
  if (!course) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments").select("status").eq("course_id", course.id).eq("student_id", user.id).maybeSingle();

  const isAdmin = profile.role === "admin";
  const isInstructor = course.instructor_id === user.id;
  // Ask the database directly, so this page can never disagree with the access rules.
  const { data: accessData } = await supabase.rpc("has_course_access", { cid: course.id });
  const hasAccess = accessData === true;

  const names = await tutorNames(supabase, [course.instructor_id]);
  const instructor = course.instructor_id ? names[course.instructor_id] : null;
  const now = getNow();

  let classes: ClassRow[] = [];
  if (hasAccess) {
    const { data } = await supabase
      .from("classes").select(CLASS_COLUMNS).eq("course_id", course.id).order("starts_at", { ascending: true });
    classes = (data ?? []) as ClassRow[];
  }
  const classNames = await tutorNames(supabase, classes.map((c) => c.tutor_id));

  const outcomes: string[] = course.outcomes ?? [];
  const curriculum: string[] = course.curriculum ?? [];

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/courses" className="text-sm underline">All courses</Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{course.title}</h1>
          {course.summary && <p className="text-gray-600">{course.summary}</p>}
          <p className="text-sm text-gray-500">
            {[instructor ? `Instructor: ${instructor}` : null,
              course.duration ? `Duration: ${course.duration}` : null,
              course.format ? `Format: ${course.format}` : null].filter(Boolean).join(" · ")}
          </p>
        </header>

        {course.description && <p className="whitespace-pre-line text-gray-700">{course.description}</p>}

        {outcomes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What you will learn</h2>
            <ul className="list-disc space-y-1 pl-5 text-gray-700">
              {outcomes.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>
        )}

        {curriculum.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Curriculum overview</h2>
            <ol className="list-decimal space-y-1 pl-5 text-gray-700">
              {curriculum.map((m) => <li key={m}>{m}</li>)}
            </ol>
          </section>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">We couldn&apos;t send your request. Please try again.</p>}

        {!hasAccess && (
          <section className="space-y-3">
            {!enrollment && (
              <form action={requestEnrollment} className="rounded-xl bg-white p-5 shadow">
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="slug" value={course.slug} />
                <p className="mb-3 text-sm text-gray-600">
                  Request enrollment, then complete payment with the academy. Your access is switched on once payment is confirmed.
                </p>
                <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Request enrollment</button>
              </form>
            )}
            {enrollment?.status === "pending" && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Your enrollment request is pending. The academy will activate it once your payment is confirmed.
              </p>
            )}
            {enrollment && enrollment.status !== "pending" && (
              <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
                Your enrollment isn&apos;t currently active, so course content is locked. Please contact the academy to renew or re-enroll.
              </p>
            )}
            <EnrollmentRequired
              title="Course content is locked"
              message="Live classes, recordings, assignments and feedback for this course are available to enrolled students."
              courseSlug={undefined}
            />
          </section>
        )}

        {hasAccess && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {enrollment?.status === "completed" ? "Completed" : isAdmin || isInstructor ? "Course classes" : "You're enrolled"}
              </h2>
              {(isAdmin || isInstructor) && (
                <Link href="/classes/new" className="text-sm underline">Schedule a class</Link>
              )}
            </div>
            <ClassList classes={classes} names={classNames} now={now} empty="No classes scheduled yet." />
          </section>
        )}
      </div>
    </main>
  );
}
