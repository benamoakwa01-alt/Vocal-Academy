import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { submissionStatus } from "@/lib/assignments";
import { enrollmentLabel } from "@/lib/enrollment";
import LessonCard from "@/components/LessonCard";
import ClassList from "@/components/ClassList";
import Classmates from "@/components/Classmates";
import ProgressPanel from "@/components/ProgressPanel";
import CourseSummary from "@/components/CourseSummary";
import CurriculumView from "@/components/CurriculumView";
import AssignmentStatus from "@/components/AssignmentStatus";
import LocalTime from "@/components/LocalTime";
import { EmptyState, Panel } from "@/components/ui";

type Asg = { id: string; title: string; course_sessions: { day_number: number | null } | null };
type Sub = { id: string; assignment_id: string; updated_at: string };
type Fb = { submission_id: string; updated_at: string; needs_revision: boolean };

export default async function MyCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireAccess();
  const now = getNow();

  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
  if (!course) notFound();

  const { data: enr } = await supabase
    .from("enrollments").select("id, status, cohort_id").eq("course_id", course.id).eq("student_id", user.id).maybeSingle();
  if (!enr) redirect(`/courses/${slug}`);
  if (enr.status === "pending") redirect(`/courses/${slug}/enroll`);

  const { data: access } = await supabase.rpc("has_course_access", { cid: course.id });
  if (access !== true) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <Link href="/my-courses" className="text-sm font-medium text-[#101B2D] underline">My courses</Link>
        <EmptyState title={`${course.title} is not active`}
          text={`Your enrollment is ${enrollmentLabel(enr.status).toLowerCase()}, so course content is locked. Please contact the academy to renew or re-enroll.`} />
      </main>
    );
  }

  const { data: cohort } = enr.cohort_id
    ? await supabase.from("cohorts").select("name, starts_on, tutor_id").eq("id", enr.cohort_id).maybeSingle()
    : { data: null };

  const { data: clsData } = await supabase
    .from("classes").select(CLASS_COLUMNS).eq("course_id", course.id).order("starts_at", { ascending: true });
  const classes = (clsData ?? []) as ClassRow[];
  const isUpcoming = (c: ClassRow) =>
    c.status === "live" || (c.status === "scheduled" && new Date(c.ends_at).getTime() >= now);
  const upcoming = classes.filter(isUpcoming);
  const past = classes.filter((c) => !isUpcoming(c)).reverse();
  const next = upcoming[0];
  const others = upcoming.slice(1);

  const pastIds = past.map((c) => c.id);
  const { data: recData } = pastIds.length
    ? await supabase.from("recordings").select("class_id").eq("status", "ready").in("class_id", pastIds)
    : { data: [] };
  const recorded = new Set(((recData ?? []) as { class_id: string }[]).map((r) => r.class_id));
  const withRecording = past.filter((c) => recorded.has(c.id));

  const names = await tutorNames(supabase, [course.instructor_id, cohort?.tutor_id ?? null, ...classes.map((c) => c.tutor_id)]);
  const tutorName = cohort?.tutor_id ? names[cohort.tutor_id] : course.instructor_id ? names[course.instructor_id] : null;

  const { data: aData } = await supabase
    .from("assignments").select("id, title, course_sessions(day_number)").eq("course_id", course.id)
    .order("created_at", { ascending: false });
  const assignments = (aData ?? []) as unknown as Asg[];
  const { data: sData } = await supabase.from("submissions").select("id, assignment_id, updated_at");
  const subs = (sData ?? []) as Sub[];
  const { data: fData } = await supabase.from("feedback").select("submission_id, updated_at, needs_revision");
  const fbBySub = new Map(((fData ?? []) as Fb[]).map((f) => [f.submission_id, f]));
  const subByAsg = new Map(subs.map((s) => [s.assignment_id, s]));

  const { data: lData } = await supabase
    .from("lessons").select("id, title, description").eq("course_id", course.id).order("created_at", { ascending: false });
  const lessons = (lData ?? []) as { id: string; title: string; description: string | null }[];

  const curriculum: string[] = course.curriculum ?? [];
  const nav = [
    ["classes", "Classes"], ["recordings", "Recordings"], ["assignments", "Assignments"],
    ["lessons", "Video library"], ["classmates", "Cohort"], ["about", "About"],
  ];

  return (
    <main className="space-y-6 pb-10">
      <section className="bg-[#101B2D] pb-6 pt-6 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link href="/my-courses" className="text-sm text-[#D8BC7E] underline">My courses</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-white">{course.title}</h1>
            <span className="rounded-full bg-[#D8BC7E] px-3 py-1 text-xs font-semibold text-[#101B2D]">{enrollmentLabel(enr.status)}</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {cohort?.name && <li className="rounded-full border border-[#D8BC7E]/40 px-3 py-1 text-[#D8BC7E]">Cohort: {cohort.name}</li>}
            {tutorName && <li className="rounded-full border border-[#D8BC7E]/40 px-3 py-1 text-[#D8BC7E]">Tutor: {tutorName}</li>}
          </ul>
          <nav aria-label="This course" className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`}
                className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-sm text-[#E3E8F0] hover:bg-white/10">{label}</a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        {next ? (
          <LessonCard cls={next} tutorName={next.tutor_id ? names[next.tutor_id] ?? null : null}
            serverNow={now} isStaff={false} heading="Your next lesson" />
        ) : (
          <Panel title="Your next lesson">
            <p className="text-sm text-[#647084]">
              {cohort ? "No upcoming class yet. When one is scheduled, it appears here." : "You will see your schedule once you are added to a cohort."}
            </p>
          </Panel>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section id="classes" className="scroll-mt-24">
              <Panel title="Classes">
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#17253B]">Upcoming</h3>
                    <ClassList classes={others} names={names} now={now} empty={next ? "No other upcoming classes." : "No upcoming classes."} />
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-[#17253B]">Past classes ({past.length})</summary>
                    <div className="mt-2"><ClassList classes={past} names={names} now={now} empty="No past classes yet." /></div>
                  </details>
                </div>
              </Panel>
            </section>

            <section id="recordings" className="scroll-mt-24">
              <Panel title="Recordings">
                {withRecording.length === 0 ? (
                  <p className="text-sm text-[#647084]">Recordings of your classes appear here after each lesson.</p>
                ) : (
                  <ul className="space-y-2">
                    {withRecording.map((c) => (
                      <li key={c.id}>
                        <Link href={`/classes/${c.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[#17253B]">{c.title}</span>
                            <span className="block text-xs text-[#647084]"><LocalTime iso={c.starts_at} /></span>
                          </span>
                          <span className="shrink-0 font-medium text-[#101B2D] underline">Watch</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>

            <section id="assignments" className="scroll-mt-24">
              <Panel title="Assignments" action={<Link href="/assignments" className="text-sm font-medium text-[#101B2D] underline">All assignments</Link>}>
                {assignments.length === 0 ? (
                  <p className="text-sm text-[#647084]">No assignments for this course yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => {
                      const sub = subByAsg.get(a.id);
                      return (
                        <li key={a.id}>
                          <Link href={`/assignments/${a.id}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-[#17253B]">{a.title}</span>
                              {a.course_sessions?.day_number && <span className="block text-xs text-[#647084]">Day {a.course_sessions.day_number}</span>}
                            </span>
                            <AssignmentStatus status={submissionStatus(sub, sub ? fbBySub.get(sub.id) : null)} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </section>

            <section id="lessons" className="scroll-mt-24">
              <Panel title="Video library" action={<Link href="/lessons" className="text-sm font-medium text-[#101B2D] underline">Full library</Link>}>
                {lessons.length === 0 ? (
                  <p className="text-sm text-[#647084]">No videos for this course yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {lessons.map((l) => (
                      <li key={l.id}>
                        <Link href={`/lessons/${l.id}`} className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                          <span className="block font-medium text-[#17253B]">{l.title}</span>
                          {l.description && <span className="block text-sm text-[#647084]">{l.description}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>
          </div>

          <div className="space-y-6">
            <ProgressPanel supabase={supabase} courseId={course.id} slug={slug} enrollmentId={enr.id} studentId={user.id} cohortId={enr.cohort_id} />
            <section id="classmates" className="scroll-mt-24 space-y-6">
              <Panel title="Your cohort">
                {cohort ? (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-[#647084]">Cohort</dt><dd className="text-right font-medium text-[#17253B]">{cohort.name}</dd></div>
                    {cohort.starts_on && <div className="flex justify-between gap-3"><dt className="text-[#647084]">Started</dt><dd className="text-right text-[#17253B]">{new Date(`${cohort.starts_on}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</dd></div>}
                    {tutorName && <div className="flex justify-between gap-3"><dt className="text-[#647084]">Tutor</dt><dd className="text-right text-[#17253B]">{tutorName}</dd></div>}
                  </dl>
                ) : (
                  <p className="text-sm text-[#647084]">You have not been added to a cohort yet. The academy will add you, and your schedule and classmates will appear here.</p>
                )}
              </Panel>
              <Classmates supabase={supabase} courseId={course.id} />
            </section>
          </div>
        </div>

        <section id="about" className="scroll-mt-24 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#101B2D]">About this course</h2>
          <CourseSummary lines={curriculum} fallbackDuration={course.duration ?? null} />
          {curriculum.length > 0 && <CurriculumView lines={curriculum} />}
        </section>
      </div>
    </main>
  );
}
