import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { enrollmentLabel } from "@/lib/enrollment";
import SignOutButton from "@/components/SignOutButton";
import LessonCard from "@/components/LessonCard";
import ClassList from "@/components/ClassList";

type EnrollmentRow = { status: string; courses: { title: string; slug: string } | null };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  const isStaff = profile.role !== "student";
  const isAdmin = profile.role === "admin";
  const now = getNow();
  const nowIso = new Date(now).toISOString();

  // RLS decides which classes each person can see.
  const { data: upcomingData } = await supabase
    .from("classes").select(CLASS_COLUMNS)
    .or(`status.eq.live,and(status.eq.scheduled,ends_at.gte.${nowIso})`)
    .order("starts_at", { ascending: true }).limit(6);
  const { data: doneData } = await supabase
    .from("classes").select(CLASS_COLUMNS)
    .eq("status", "completed").order("starts_at", { ascending: false }).limit(5);

  const upcoming = (upcomingData ?? []) as ClassRow[];
  const completed = (doneData ?? []) as ClassRow[];
  const next = upcoming[0];
  const others = upcoming.slice(1);
  const names = await tutorNames(supabase, [...upcoming, ...completed].map((c) => c.tutor_id));

  let waitingPayments = 0;
  let needCohort = 0;
  if (isAdmin) {
    const { count: w } = await supabase.from("enrollments")
      .select("id", { count: "exact", head: true }).eq("status", "pending");
    const { count: n } = await supabase.from("enrollments")
      .select("id", { count: "exact", head: true }).eq("status", "active").is("cohort_id", null);
    waitingPayments = w ?? 0;
    needCohort = n ?? 0;
  }

  let myCourses: EnrollmentRow[] = [];
  if (!isStaff) {
    const { data } = await supabase
      .from("enrollments").select("status, courses(title, slug)").eq("student_id", user.id);
    myCourses = ((data ?? []) as unknown as EnrollmentRow[]).filter((e) => e.courses);
  }

  const link = "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100";
  const count = (n: number) => (n > 0 ? ` (${n})` : "");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {profile.full_name ?? "friend"}</h1>
            <p className="text-sm text-gray-600">Signed in as <strong>{profile.role}</strong></p>
          </div>
          <SignOutButton />
        </div>

        {notice === "not-open" && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            That lesson is not open yet. Try again once your tutor has started it.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/classes" className={link}>{isStaff ? "Classes" : "My classes"}</Link>
          <Link href="/lessons" className={link}>Lessons</Link>
          <Link href="/assignments" className={link}>Assignments</Link>
          <Link href="/courses" className={link}>Explore courses</Link>
          {isAdmin && <Link href="/admin/enrollments" className={link}>Enrollments{count(waitingPayments)}</Link>}
          {isAdmin && <Link href="/admin/cohorts" className={link}>Cohorts{count(needCohort)}</Link>}
          {isAdmin && <Link href="/admin/curriculum" className={link}>Curriculum</Link>}
          {isAdmin && <Link href="/admin/recordings" className={link}>Recordings</Link>}
          {isAdmin && <Link href="/admin/courses" className={link}>Manage courses</Link>}
          {isAdmin && <Link href="/admin/promos" className={link}>Promos</Link>}
          {isAdmin && <Link href="/admin/settings" className={link}>Payment details</Link>}
          {isAdmin && <Link href="/admin/people" className={link}>People</Link>}
          {isAdmin && <Link href="/admin" className={link}>Accounts</Link>}
          {isStaff && <Link href="/classes/new" className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">Schedule class</Link>}
        </div>

        {isAdmin && waitingPayments > 0 && (
          <Link href="/admin/enrollments"
            className="block rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900 hover:bg-amber-100">
            {waitingPayments} {waitingPayments === 1 ? "student is" : "students are"} waiting for payment confirmation.
          </Link>
        )}

        {!isStaff && myCourses.length === 0 && (
          <section className="space-y-3 rounded-2xl bg-white p-6 text-center shadow">
            <h2 className="text-lg font-semibold">Start your journey</h2>
            <p className="text-sm text-gray-600">
              Browse the academy courses, enroll, and your lessons will appear here once your payment is confirmed.
            </p>
            <Link href="/courses" className="inline-block rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">
              Explore courses
            </Link>
          </section>
        )}

        {next ? (
          <LessonCard
            cls={next}
            tutorName={next.tutor_id ? names[next.tutor_id] ?? null : null}
            serverNow={now}
            isStaff={isStaff}
            heading={isStaff ? "Next class" : "Your Next Lesson"}
          />
        ) : (
          (isStaff || myCourses.length > 0) && (
            <section className="rounded-2xl bg-white p-5 shadow">
              <p className="font-semibold">No upcoming lessons</p>
              <p className="text-sm text-gray-600">
                {isStaff ? "Schedule a class to get started." : "When a lesson is scheduled for you, it will appear here."}
              </p>
            </section>
          )
        )}

        {others.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Also coming up</h2>
            <ClassList classes={others} names={names} now={now} empty="" />
          </section>
        )}

        {!isStaff && myCourses.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My courses</h2>
              <Link href="/courses" className="text-sm underline">Explore more</Link>
            </div>
            <ul className="space-y-2">
              {myCourses.map((e) => (
                <li key={e.courses!.slug}>
                  <Link
                    href={e.status === "pending" ? `/courses/${e.courses!.slug}/enroll` : `/courses/${e.courses!.slug}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                    <span className="font-medium">{e.courses!.title}</span>
                    <span className={`text-xs ${e.status === "pending" ? "font-medium text-amber-700" : "text-gray-600"}`}>
                      {e.status === "pending" ? "Awaiting payment" : enrollmentLabel(e.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(isStaff || myCourses.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Completed classes</h2>
            <ClassList classes={completed} names={names} now={now} empty="Nothing completed yet." />
          </section>
        )}
      </div>
    </main>
  );
}
