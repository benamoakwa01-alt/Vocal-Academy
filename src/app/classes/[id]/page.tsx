import Link from "next/link";
import { requireAccess } from "@/lib/access";
import {
  CLASS_COLUMNS, TUTOR_EARLY_START_MINUTES, getLessonState, getNow, type ClassRow,
} from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { cancelClass, endClass, startClass } from "../actions";
import LessonCard from "@/components/LessonCard";
import LocalTime from "@/components/LocalTime";
import StatusBadge from "@/components/StatusBadge";
import AutoRefresh from "@/components/AutoRefresh";
import EnrollmentRequired from "@/components/EnrollmentRequired";

const errors: Record<string, string> = {
  link: "Enter a valid https:// meeting link (Google Meet, Zoom, etc.).",
  early: "It's too early to start this lesson.",
  late: "This class's scheduled time has passed.",
  state: "This class can't be started in its current state.",
  denied: "You don't have permission to do that.",
  students: "The class was created, but some students could not be assigned.",
};

export default async function ClassPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireAccess();

  const { data } = await supabase.from("classes").select(CLASS_COLUMNS).eq("id", id).maybeSingle();

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        <div className="mx-auto max-w-xl space-y-4">
          <Link href="/classes" className="text-sm underline">Back to classes</Link>
          <EnrollmentRequired
            title="You don't have access to this class"
            message="Live classes are only available to students enrolled in the course, or assigned to the class by their tutor."
          />
        </div>
      </main>
    );
  }

  const c = data as ClassRow;
  const now = getNow();
  const isStaff = profile.role !== "student";
  const canManage = profile.role === "admin" || c.tutor_id === user.id;
  const names = await tutorNames(supabase, [c.tutor_id]);
  const tutorName = c.tutor_id ? names[c.tutor_id] ?? null : null;

  const { data: course } = c.course_id
    ? await supabase.from("courses").select("title, slug").eq("id", c.course_id).maybeSingle()
    : { data: null };

  // Student view
  if (!isStaff) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <Link href="/classes" className="text-sm underline">Back to classes</Link>
          <LessonCard cls={c} tutorName={tutorName} serverNow={now} isStaff={false} heading="Lesson" />
          {course && (
            <p className="text-sm text-gray-600">
              Part of <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link>
            </p>
          )}
        </div>
      </main>
    );
  }

  // Staff view
  const startMs = new Date(c.starts_at).getTime();
  const endMs = new Date(c.ends_at).getTime();
  const state = getLessonState(c, now);
  const canStart = c.status === "scheduled" && now >= startMs - TUTOR_EARLY_START_MINUTES * 60000 && now <= endMs;
  const earliestStartIso = new Date(startMs - TUTOR_EARLY_START_MINUTES * 60000).toISOString();

  let people: { id: string; name: string; email: string | null; source: string; attended: boolean }[] = [];
  let meetingUrl: string | null = null;

  if (canManage) {
    const { data: assigned } = await supabase.from("class_students").select("student_id").eq("class_id", id);
    const { data: attended } = await supabase.from("attendance").select("student_id").eq("class_id", id);
    const enrolledRes = c.course_id
      ? await supabase.from("enrollments").select("student_id").eq("course_id", c.course_id).eq("status", "active")
      : { data: [] };

    const assignedIds = new Set((assigned ?? []).map((r: { student_id: string }) => r.student_id));
    const enrolledIds = new Set((enrolledRes.data ?? []).map((r: { student_id: string }) => r.student_id));
    const attendedIds = new Set((attended ?? []).map((r: { student_id: string }) => r.student_id));
    const allIds = [...new Set([...assignedIds, ...enrolledIds])];

    if (allIds.length) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, email").in("id", allIds);
      people = (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => ({
        id: p.id,
        name: p.full_name ?? "Unnamed",
        email: p.email,
        source: assignedIds.has(p.id) ? "Assigned" : "Course",
        attended: attendedIds.has(p.id),
      }));
    }

    if (c.status === "live") {
      const { data: session } = await supabase
        .from("live_sessions").select("meeting_url").eq("class_id", id).maybeSingle();
      meetingUrl = session?.meeting_url ?? null;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      {(c.status === "scheduled" || c.status === "live") && <AutoRefresh seconds={15} />}
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/classes" className="text-sm underline">Back to classes</Link>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">{c.title}</h1>
            <StatusBadge state={state} />
          </div>
          <p className="text-sm text-gray-600">
            {tutorName ? `${tutorName} · ` : ""}<LocalTime iso={c.starts_at} end={c.ends_at} />
          </p>
          {course && (
            <p className="text-sm text-gray-600">
              Course: <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link>
            </p>
          )}
          {c.description && <p className="pt-2 text-gray-700">{c.description}</p>}
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? "Something went wrong."}</p>}

        {canManage && c.status === "scheduled" && (
          <section className="space-y-3 rounded-xl bg-white p-5 shadow">
            <h2 className="font-semibold">Start the lesson</h2>
            <form action={startClass} className="space-y-3">
              <input type="hidden" name="class_id" value={c.id} />
              <input name="meeting_url" type="url" required disabled={!canStart}
                placeholder="Paste your Google Meet / Zoom link (https://…)"
                className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black disabled:bg-gray-100" />
              <button disabled={!canStart}
                className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto">
                START LESSON
              </button>
              {!canStart && now < startMs && (
                <p className="text-sm text-gray-600">
                  You can start from <LocalTime iso={earliestStartIso} />. Students can join from the scheduled time once you&apos;ve started.
                </p>
              )}
              {!canStart && now > endMs && <p className="text-sm text-gray-600">The scheduled time has passed.</p>}
            </form>
            <form action={cancelClass}>
              <input type="hidden" name="class_id" value={c.id} />
              <button className="text-sm text-red-600 underline">Cancel this class</button>
            </form>
          </section>
        )}

        {canManage && c.status === "live" && (
          <section className="space-y-3 rounded-xl bg-green-50 p-5 ring-2 ring-green-500">
            <h2 className="font-semibold text-green-800">Lesson is live</h2>
            {meetingUrl && (
              <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700">
                Open meeting
              </a>
            )}
            <form action={endClass}>
              <input type="hidden" name="class_id" value={c.id} />
              <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100">
                End lesson
              </button>
            </form>
          </section>
        )}

        {canManage && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Students ({people.length})</h2>
            {people.length === 0 && <p className="text-sm text-gray-500">No students assigned or enrolled yet.</p>}
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-gray-600">{p.email} · {p.source}</p>
                  </div>
                  {p.attended && <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-800">Joined</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
