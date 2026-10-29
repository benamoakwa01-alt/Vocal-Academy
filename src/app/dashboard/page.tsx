import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { enrollmentLabel } from "@/lib/enrollment";
import { submissionStatus } from "@/lib/assignments";
import LessonCard from "@/components/LessonCard";
import ClassList from "@/components/ClassList";
import AssignmentStatus from "@/components/AssignmentStatus";
import LocalTime from "@/components/LocalTime";
import DueSoonPanel from "@/components/DueSoonPanel";
import { EmptyState, PageHeader, Panel, StatCard, btnPrimary, btnSecondary } from "@/components/ui";

type Sub = { id: string; assignment_id: string; updated_at: string };
type Fb = { submission_id: string; updated_at: string; needs_revision: boolean };
type Asg = {
  id: string; title: string; course_id: string;
  courses: { title: string } | null;
  course_sessions: { day_number: number | null } | null;
};
type Enr = { status: string; course_id: string; courses: { title: string; slug: string } | null };
type RecentFb = {
  score: number | null; comment: string | null; updated_at: string; needs_revision: boolean;
  submissions: { assignment_id: string; assignments: { title: string } | null } | null;
};
type Note = { id: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

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
  const weekIso = new Date(now + 7 * 86400000).toISOString();
  const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] || "there";

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
  const tutorOf = (c: ClassRow) => (c.tutor_id ? names[c.tutor_id] ?? null : null);

  const notNow = notice === "not-open" && (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      That lesson is not open yet. Try again once your tutor has started it.
    </p>
  );

  // ================= Admin and tutor =================
  if (isStaff) {
    const { count: weekCount } = await supabase.from("classes")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled").gte("starts_at", nowIso).lte("starts_at", weekIso);

    const { data: subData } = await supabase.from("submissions").select("id, assignment_id, updated_at").limit(1000);
    const { data: fbData } = await supabase.from("feedback").select("submission_id, updated_at, needs_revision").limit(1000);
    const fbBySub = new Map(((fbData ?? []) as Fb[]).map((f) => [f.submission_id, f]));
    const toReview = ((subData ?? []) as Sub[]).filter((s) => {
      const st = submissionStatus(s, fbBySub.get(s.id));
      return st === "submitted" || st === "resubmitted";
    }).length;

    let waiting = 0, noCohort = 0, activeEnrollments = 0, accounts = 0, recordingsToCheck = 0;
    if (isAdmin) {
      const head = { count: "exact" as const, head: true };
      waiting = (await supabase.from("enrollments").select("id", head).eq("status", "pending")).count ?? 0;
      noCohort = (await supabase.from("enrollments").select("id", head).eq("status", "active").is("cohort_id", null)).count ?? 0;
      activeEnrollments = (await supabase.from("enrollments").select("id", head).eq("status", "active")).count ?? 0;
      accounts = (await supabase.from("profiles").select("id", head).eq("role", "student")).count ?? 0;
      recordingsToCheck = (await supabase.from("recordings").select("id", head).eq("status", "review")).count ?? 0;
    }

    const tasks: { label: string; n: number; href: string }[] = [];
    if (isAdmin) tasks.push({ label: "Payments waiting for confirmation", n: waiting, href: "/admin/enrollments" });
    if (isAdmin) tasks.push({ label: "Paid students not in a cohort", n: noCohort, href: "/admin/cohorts" });
    tasks.push({ label: "Submissions to review", n: toReview, href: "/assignments" });
    if (isAdmin) tasks.push({ label: "Recordings waiting for approval", n: recordingsToCheck, href: "/admin/recordings" });
    const open = tasks.filter((t) => t.n > 0);

    const actions: { label: string; href: string }[] = [
      { label: "Schedule a class", href: "/classes/new" },
      { label: "Review assignments", href: "/assignments" },
    ];
    if (isAdmin) {
      actions.push(
        { label: "Confirm payments", href: "/admin/enrollments" },
        { label: "Manage cohorts", href: "/admin/cohorts" },
        { label: "Create a promo", href: "/admin/promos" },
        { label: "Add a tutor", href: "/admin/people" },
      );
    } else {
      actions.push({ label: "Video library", href: "/lessons" });
    }

    return (
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <PageHeader
          title={`Welcome back, ${firstName}`}
          description={isAdmin ? "Here is what is happening across the academy." : "Here is your teaching overview."}
          actions={<Link href="/classes/new" className={btnPrimary}>Schedule a class</Link>}
        />
        {notNow}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {isAdmin && <StatCard label="Waiting for payment" value={waiting} href="/admin/enrollments" attention={waiting > 0} hint="Enrollments to confirm" />}
          <StatCard label="Submissions to review" value={toReview} href="/assignments" attention={toReview > 0} hint="Student work awaiting feedback" />
          <StatCard label="Classes in the next 7 days" value={weekCount ?? 0} href="/classes" />
          {isAdmin && <StatCard label="Active enrollments" value={activeEnrollments} href="/admin/enrollments" />}
          {isAdmin && <StatCard label="Not in a cohort" value={noCohort} href="/admin/cohorts" attention={noCohort > 0} hint="Paid, no schedule yet" />}
          {isAdmin && <StatCard label="Student accounts" value={accounts} href="/admin" />}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {next ? (
              <LessonCard cls={next} tutorName={tutorOf(next)} serverNow={now} isStaff heading="Next class" />
            ) : (
              <EmptyState title="No upcoming classes" text="Schedule a class to get started." href="/classes/new" cta="Schedule a class" />
            )}
            {others.length > 0 && (
              <Panel title="Coming up" action={<Link href="/classes" className="text-sm font-medium text-[#101B2D] underline">All classes</Link>}>
                <ClassList classes={others} names={names} now={now} empty="" />
              </Panel>
            )}
            <Panel title="Recently completed">
              <ClassList classes={completed} names={names} now={now} empty="Completed classes appear here." />
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Needs your attention">
              {open.length === 0 ? (
                <p className="text-sm text-[#647084]">Nothing needs your attention right now.</p>
              ) : (
                <ul className="space-y-2">
                  {open.map((t) => (
                    <li key={t.label}>
                      <Link href={t.href}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50">
                        <span className="text-[#17253B]">{t.label}</span>
                        <span className="rounded-full bg-[#D8BC7E]/30 px-2.5 py-0.5 font-semibold text-[#8a6d2f]">{t.n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Quick actions">
              <ul className="grid gap-2">
                {actions.map((a) => (
                  <li key={a.href + a.label}><Link href={a.href} className={`${btnSecondary} w-full justify-start`}>{a.label}</Link></li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </main>
    );
  }

  // ================= Student =================
  const { data: enrData } = await supabase
    .from("enrollments").select("status, course_id, courses(title, slug)").eq("student_id", user.id);
  const enrollments = ((enrData ?? []) as unknown as Enr[]).filter((e) => e.courses);
  const activeCourseIds = new Set(enrollments.filter((e) => e.status === "active").map((e) => e.course_id));

  const { data: aData } = await supabase
    .from("assignments").select("id, title, course_id, courses(title), course_sessions(day_number)")
    .order("created_at", { ascending: false }).limit(50);
  const assignments = (aData ?? []) as unknown as Asg[];
  const { data: sData } = await supabase.from("submissions").select("id, assignment_id, updated_at");
  const mySubs = (sData ?? []) as Sub[];
  const { data: fData } = await supabase.from("feedback").select("submission_id, updated_at, needs_revision");
  const fbBySub = new Map(((fData ?? []) as Fb[]).map((f) => [f.submission_id, f]));
  const subByAssignment = new Map(mySubs.map((s) => [s.assignment_id, s]));

  const todo = assignments
    .filter((a) => activeCourseIds.has(a.course_id))
    .map((a) => {
      const sub = subByAssignment.get(a.id);
      return { a, status: submissionStatus(sub, sub ? fbBySub.get(sub.id) : null) };
    })
    .filter((x) => x.status === "todo" || x.status === "revision")
    .slice(0, 5);

  const { data: rfData } = await supabase
    .from("feedback")
    .select("score, comment, updated_at, needs_revision, submissions(assignment_id, assignments(title))")
    .order("updated_at", { ascending: false }).limit(3);
  const recentFeedback = (rfData ?? []) as unknown as RecentFb[];

  const { data: nData } = await supabase
    .from("notifications").select("id, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false }).limit(3);
  const notes = (nData ?? []) as Note[];

  const hasCourse = enrollments.some((e) => ["active", "completed", "paused"].includes(e.status));
  const waitingPayment = enrollments.filter((e) => e.status === "pending");

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title={`Welcome back, ${firstName}`} description="Pick up where you left off." />
      {notNow}

      {waitingPayment.map((e) => (
        <Link key={e.courses!.slug} href={`/courses/${e.courses!.slug}/enroll`}
          className="block rounded-xl border border-[#D8BC7E] bg-white p-4 text-sm hover:bg-gray-50">
          <span className="font-semibold text-[#101B2D]">{e.courses!.title}</span>
          <span className="text-[#647084]"> is waiting for payment. See the payment details.</span>
        </Link>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {next ? (
            <LessonCard cls={next} tutorName={tutorOf(next)} serverNow={now} isStaff={false} heading="Your next lesson" />
          ) : hasCourse ? (
            <Panel title="Your next lesson">
              <p className="text-sm text-[#647084]">No upcoming lessons yet. When a lesson is scheduled for you, it appears here.</p>
            </Panel>
          ) : (
            <EmptyState
              title="Start your journey"
              text="Browse the academy courses and enroll. Your lessons appear here once your payment is confirmed."
              href="/courses" cta="Explore courses"
            />
          )}

          {others.length > 0 && (
            <Panel title="Coming up" action={<Link href="/classes" className="text-sm font-medium text-[#101B2D] underline">My classes</Link>}>
              <ClassList classes={others} names={names} now={now} empty="" />
            </Panel>
          )}

          <DueSoonPanel supabase={supabase} studentId={user.id} now={now} />

          <Panel title="To do" action={<Link href="/assignments" className="text-sm font-medium text-[#101B2D] underline">All assignments</Link>}>
            {todo.length === 0 ? (
              <p className="text-sm text-[#647084]">
                {hasCourse ? "You are all caught up. New assignments appear here." : "Assignments for your courses appear here."}
              </p>
            ) : (
              <ul className="space-y-2">
                {todo.map(({ a, status }) => (
                  <li key={a.id}>
                    <Link href={`/assignments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#17253B]">{a.title}</span>
                        <span className="block text-xs text-[#647084]">
                          {a.courses?.title}{a.course_sessions?.day_number ? ` \u00b7 Day ${a.course_sessions.day_number}` : ""}
                        </span>
                      </span>
                      <AssignmentStatus status={status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Past lessons and recordings">
            <ClassList classes={completed} names={names} now={now} empty="Recordings of your completed lessons appear here." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="My courses" action={<Link href="/my-courses" className="text-sm font-medium text-[#101B2D] underline">See all</Link>}>
            {enrollments.length === 0 ? (
              <p className="text-sm text-[#647084]">You are not enrolled in a course yet.</p>
            ) : (
              <ul className="space-y-2">
                {enrollments.map((e) => (
                  <li key={e.courses!.slug}>
                    <Link href={e.status === "pending" ? `/courses/${e.courses!.slug}/enroll` : `/my-courses/${e.courses!.slug}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50">
                      <span className="font-medium text-[#17253B]">{e.courses!.title}</span>
                      <span className={`shrink-0 text-xs ${e.status === "pending" ? "font-medium text-[#8a6d2f]" : "text-[#647084]"}`}>
                        {e.status === "pending" ? "Awaiting payment" : enrollmentLabel(e.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent feedback">
            {recentFeedback.length === 0 ? (
              <p className="text-sm text-[#647084]">Feedback from your tutor appears here.</p>
            ) : (
              <ul className="space-y-3">
                {recentFeedback.map((f, i) => (
                  <li key={i} className="text-sm">
                    <Link href={f.submissions ? `/assignments/${f.submissions.assignment_id}` : "/assignments"}
                      className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                      <span className="block font-medium text-[#17253B]">{f.submissions?.assignments?.title ?? "Assignment"}</span>
                      <span className="block text-xs text-[#647084]">
                        {f.score !== null ? `${f.score} / 100 \u00b7 ` : ""}{f.needs_revision ? "Revision requested \u00b7 " : ""}<LocalTime iso={f.updated_at} />
                      </span>
                      {f.comment && <span className="mt-1 line-clamp-2 block text-[#647084]">{f.comment}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Notifications" action={<Link href="/notifications" className="text-sm font-medium text-[#101B2D] underline">See all</Link>}>
            {notes.length === 0 ? (
              <p className="text-sm text-[#647084]">No notifications yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link href={n.url ?? "/notifications"} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-gray-50">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-blue-600"}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-medium text-[#17253B]">{n.title}</span>
                        <span className="block text-xs text-[#647084]"><LocalTime iso={n.created_at} /></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
