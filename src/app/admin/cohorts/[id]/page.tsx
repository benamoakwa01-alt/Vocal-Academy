import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import ClassList from "@/components/ClassList";
import ConfirmButton from "@/components/ConfirmButton";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import {
  addStudentToCohort, addWaitingToCohort, generateSchedule, removeStudentFromCohort, setSkipDates, updateCohort,
} from "../actions";

const input = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";

type Person = { full_name: string | null; email: string | null };
type Row = { id: string; student_id: string; profiles: Person | null };

export default async function CohortPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string; notice?: string; generated?: string; added?: string; removed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const now = getNow();

  const { data: cohort } = await supabase.from("cohorts").select("*").eq("id", id).maybeSingle();
  if (!cohort) notFound();

  const { data: course } = await supabase.from("courses").select("title").eq("id", cohort.course_id).maybeSingle();
  const { data: days } = await supabase
    .from("course_sessions").select("id").eq("course_id", cohort.course_id).not("day_number", "is", null);
  const { data: tutors } = await supabase.from("tutor_names").select("id, full_name").order("full_name");

  // "profiles!student_id" picks the student link (an enrollment also links to the admin who confirmed it)
  const { data: memberData, error: memberErr } = await supabase
    .from("enrollments").select("id, student_id, profiles!student_id(full_name, email)").eq("cohort_id", id);
  const members = (memberData ?? []) as unknown as Row[];

  const { data: waitData } = await supabase
    .from("enrollments").select("id, student_id, profiles!student_id(full_name, email)")
    .eq("course_id", cohort.course_id).eq("status", "active").is("cohort_id", null);
  const waiting = (waitData ?? []) as unknown as Row[];

  const { data: studentData } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "student").order("full_name").limit(500);
  const taken = new Set([...members, ...waiting].map((r) => r.student_id));
  const others = ((studentData ?? []) as { id: string; full_name: string | null; email: string | null }[])
    .filter((s) => !taken.has(s.id));

  const { data: classData } = await supabase
    .from("classes").select(CLASS_COLUMNS).eq("cohort_id", id).order("starts_at", { ascending: true });
  const classes = (classData ?? []) as ClassRow[];
  const names = await tutorNames(supabase, classes.map((c) => c.tutor_id));

  const generated = sp.generated !== undefined ? Number(sp.generated) : null;
  const added = sp.added !== undefined ? Number(sp.added) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link href="/admin/cohorts" className="text-sm font-medium text-[#101B2D] underline">All cohorts</Link>
      <PageHeader
        title={cohort.name}
        description={`${course?.title ?? "Course"} · starts ${cohort.starts_on} · ${String(cohort.session_time).slice(0, 5)} Ghana time · ${cohort.session_minutes} min`}
      />

      {added !== null && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {added === 0 ? "No one was added." : `Added ${added} ${added === 1 ? "student" : "students"} to this cohort. They have been notified.`}
        </p>
      )}
      {sp.removed && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Student removed from this cohort.</p>}
      {sp.notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {sp.notice === "holidays" ? "Holidays saved. Generate the schedule again to add new days. Classes already created do not move." : "Saved."}
        </p>
      )}
      {generated !== null && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {generated === 0
            ? "No new classes were created. Everything already exists, or the course has no numbered days."
            : `${generated} classes created.`}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {sp.error === "none" ? "Choose at least one student first."
            : sp.error === "generate" ? "Could not generate the schedule."
            : sp.error === "team" ? "That tutor is not on this course's teaching team. Add them to the team first."
            : sp.error === "add" ? `Could not add the student. ${sp.detail ?? ""}`
            : "Something went wrong. Please try again."}
        </p>
      )}
      {memberErr && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load the student list: {memberErr.message}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={`Students in this cohort (${members.length})`}>
            {members.length === 0 ? (
              <p className="text-sm text-[#647084]">No one is in this cohort yet. Add students below.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                    <div className="min-w-0">
                      <Link href={`/admin/students/${m.student_id}`} className="font-medium text-[#101B2D] underline-offset-2 hover:underline">
                        {m.profiles?.full_name ?? "No name"}
                      </Link>
                      <p className="truncate text-sm text-[#647084]">{m.profiles?.email}</p>
                    </div>
                    <form action={removeStudentFromCohort}>
                      <input type="hidden" name="enrollment_id" value={m.id} />
                      <input type="hidden" name="cohort_id" value={cohort.id} />
                      <ConfirmButton label="Remove" message="Remove this student from the cohort? They keep their enrollment but lose this schedule."
                        className="text-sm text-red-600 underline" />
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Paid and waiting for a cohort (${waiting.length})`}>
            {waiting.length === 0 ? (
              <p className="text-sm text-[#647084]">No paid students are waiting for this course.</p>
            ) : (
              <form action={addWaitingToCohort} className="space-y-3">
                <input type="hidden" name="cohort_id" value={cohort.id} />
                <ul className="space-y-2">
                  {waiting.map((w) => (
                    <li key={w.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                        <input type="checkbox" name="enrollment_id" value={w.id} className="h-4 w-4" />
                        <span className="min-w-0">
                          <span className="block font-medium text-[#17253B]">{w.profiles?.full_name ?? "No name"}</span>
                          <span className="block truncate text-sm text-[#647084]">{w.profiles?.email}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button className={btnPrimary}>Add selected to this cohort</button>
              </form>
            )}
          </Panel>

          <Panel title="Add any other student">
            <form action={addStudentToCohort} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="cohort_id" value={cohort.id} />
              <input type="hidden" name="course_id" value={cohort.course_id} />
              <select name="student_id" required defaultValue="" aria-label="Student" className={input}>
                <option value="" disabled>Choose a student...</option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name ?? s.email}{s.full_name && s.email ? ` (${s.email})` : ""}</option>
                ))}
              </select>
              <button className={`${btnPrimary} sm:shrink-0`}>Enroll and add</button>
            </form>
            <p className="mt-2 text-xs text-[#647084]">
              This enrolls the student in the course (as paid) and puts them in this cohort. Use it for cash payments or scholarships.
            </p>
          </Panel>

          <Panel title={`Classes (${classes.length})`}>
            <ClassList classes={classes} names={names} now={now} empty="No classes generated yet. Use Generate schedule." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <form action={updateCohort} className="space-y-3">
              <input type="hidden" name="id" value={cohort.id} />
              <label className="block text-sm">Name
                <input name="name" required defaultValue={cohort.name} className={`${input} mt-1`} />
              </label>
              <label className="block text-sm">Tutor
                <select name="tutor_id" defaultValue={cohort.tutor_id ?? ""} className={`${input} mt-1`}>
                  <option value="">No tutor</option>
                  {(tutors ?? []).map((t: { id: string; full_name: string | null }) => (
                    <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">Status
                <select name="status" defaultValue={cohort.status} className={`${input} mt-1`}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <button className={btnPrimary}>Save</button>
              <p className="text-xs text-[#647084]">Changing the tutor moves the classes that were with the previous main tutor. Topic tutors and covers stay as they are.</p>
            </form>
          </Panel>

          <Panel title="Schedule">
            <p className="text-sm text-[#647084]">
              The course has {days?.length ?? 0} numbered days. Generating creates one class per day, Monday to Friday, skipping the holidays below.
            </p>
            <form action={setSkipDates} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={cohort.id} />
              <label className="block text-sm">Holidays to skip (one date per line, YYYY-MM-DD)
                <textarea name="skip_dates" rows={3} defaultValue={(cohort.skip_dates ?? []).join("\n")}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-[#17253B]" />
              </label>
              <button className={btnSecondary}>Save holidays</button>
            </form>
            <form action={generateSchedule} className="mt-3">
              <input type="hidden" name="id" value={cohort.id} />
              <button className={btnPrimary}>Generate schedule</button>
            </form>
          </Panel>
        </div>
      </div>
    </main>
  );
}
