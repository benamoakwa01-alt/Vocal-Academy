import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import ClassList from "@/components/ClassList";
import {
  addStudentToCohort, generateSchedule, removeStudentFromCohort, setSkipDates, updateCohort,
} from "../actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function CohortPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string; generated?: string }>;
}) {
  const { id } = await params;
  const { error, notice, generated } = await searchParams;
  const { supabase } = await requireAdmin();
  const now = getNow();

  const { data: cohort } = await supabase.from("cohorts").select("*").eq("id", id).maybeSingle();
  if (!cohort) notFound();

  const { data: course } = await supabase.from("courses").select("title").eq("id", cohort.course_id).maybeSingle();
  const { data: dayCount } = await supabase
    .from("course_sessions").select("id").eq("course_id", cohort.course_id).not("day_number", "is", null);

  const { data: tutors } = await supabase.from("tutor_names").select("id, full_name").order("full_name");

  const { data: enrollData } = await supabase
    .from("enrollments").select("id, status, profiles!student_id(full_name, email)").eq("cohort_id", id);
  const members = (enrollData ?? []) as unknown as {
    id: string; status: string; profiles: { full_name: string | null; email: string | null } | null;
  }[];

  const { data: candidates } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "student").eq("approved", true).order("full_name");
  const { data: inCohortRows } = await supabase.from("enrollments").select("student_id").eq("cohort_id", id);
  const taken = new Set((inCohortRows ?? []).map((r: { student_id: string }) => r.student_id));
  const available = (candidates ?? []).filter((s: { id: string }) => !taken.has(s.id));

  const { data: classData } = await supabase
    .from("classes").select(CLASS_COLUMNS).eq("cohort_id", id).order("starts_at", { ascending: true });
  const classes = (classData ?? []) as ClassRow[];
  const names = await tutorNames(supabase, classes.map((c) => c.tutor_id));

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/admin/cohorts" className="text-sm underline">All cohorts</Link>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <header>
          <h1 className="text-2xl font-bold">{cohort.name}</h1>
          <p className="text-sm text-gray-600">
            {course?.title} · starts {cohort.starts_on} · {String(cohort.session_time).slice(0, 5)} Ghana time · {cohort.session_minutes} min
          </p>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error === "generate" ? "Couldn't generate the schedule." : "Something went wrong. Please try again."}
        </p>}
        {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice === "holidays" ? "Holidays saved. Re-run Generate to add any new days; already-created classes don't move." : "Saved."}
        </p>}
        {generated !== undefined && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {Number(generated) === 0 ? "No new classes were created (everything already exists, or the course has no numbered days)." : `${generated} classes created.`}
        </p>}

        <form action={updateCohort} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Details</h2>
          <input type="hidden" name="id" value={cohort.id} />
          <input name="name" required defaultValue={cohort.name} className={input} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="tutor_id" defaultValue={cohort.tutor_id ?? ""} className={input}>
              <option value="">No tutor</option>
              {(tutors ?? []).map((t: { id: string; full_name: string | null }) => (
                <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>
              ))}
            </select>
            <select name="status" defaultValue={cohort.status} className={input}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800">Save</button>
          <p className="text-xs text-gray-500">Changing the tutor also moves every class that hasn&apos;t started yet.</p>
        </form>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Schedule</h2>
          <p className="text-sm text-gray-600">
            The course has {dayCount?.length ?? 0} numbered days. Generating creates one class per day, Monday to Friday, skipping the holidays below.
          </p>
          <form action={setSkipDates} className="space-y-2">
            <input type="hidden" name="id" value={cohort.id} />
            <label className="block text-sm">Holidays to skip (one date per line, YYYY-MM-DD)
              <textarea name="skip_dates" rows={3} defaultValue={(cohort.skip_dates ?? []).join("\n")} className={`${input} mt-1`} />
            </label>
            <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Save holidays</button>
          </form>
          <form action={generateSchedule}>
            <input type="hidden" name="id" value={cohort.id} />
            <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Generate schedule</button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Students ({members.length})</h2>
          <form action={addStudentToCohort} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="cohort_id" value={cohort.id} />
            <input type="hidden" name="course_id" value={cohort.course_id} />
            <select name="student_id" required defaultValue="" className={input}>
              <option value="" disabled>Add a student…</option>
              {available.map((s: { id: string; full_name: string | null; email: string | null }) => (
                <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
              ))}
            </select>
            <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800 sm:whitespace-nowrap">Add to cohort</button>
          </form>
          {members.length === 0 && <p className="text-sm text-gray-500">No students in this cohort yet.</p>}
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div>
                  <p className="font-medium">{m.profiles?.full_name ?? "No name"}</p>
                  <p className="text-sm text-gray-600">{m.profiles?.email} · {m.status}</p>
                </div>
                <form action={removeStudentFromCohort}>
                  <input type="hidden" name="enrollment_id" value={m.id} />
                  <input type="hidden" name="cohort_id" value={cohort.id} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Classes ({classes.length})</h2>
          <ClassList classes={classes} names={names} now={now} empty="No classes generated yet." />
        </section>
      </div>
    </main>
  );
}
