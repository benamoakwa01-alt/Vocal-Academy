import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { teamMemberIds } from "@/lib/team";
import ConfirmButton from "@/components/ConfirmButton";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import { addTeamMember, removeTeamMember, saveTopicTutors, setLead } from "./actions";

const field = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";
const errors: Record<string, string> = {
  choose: "Choose a tutor first.",
  role: "Only tutors and admins can be on a teaching team.",
  lead: "That tutor is the lead instructor. Choose a different lead first, then remove them.",
  notteam: "Topic tutors must be on the teaching team. Add them to the team first.",
  save: "Could not save.",
};
const saved: Record<string, string> = {
  added: "Added to the team.", removed: "Removed from the team.", lead: "Lead instructor saved.", topics: "Topic tutors saved.",
};

export default async function CourseTeamPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; detail?: string; n?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: course } = await supabase.from("courses").select("id, title, instructor_id").eq("id", id).maybeSingle();
  if (!course) notFound();

  const { data: tData } = await supabase.from("tutor_names").select("id, full_name").order("full_name");
  const tutors = (tData ?? []) as { id: string; full_name: string | null }[];
  const memberIds = await teamMemberIds(supabase, id);
  const nameOf = new Map(tutors.map((t) => [t.id, t.full_name ?? "Unnamed"]));
  const candidates = tutors.filter((t) => !memberIds.includes(t.id));

  const { data: upcoming } = await supabase
    .from("classes").select("tutor_id").eq("course_id", id).eq("status", "scheduled")
    .gte("ends_at", new Date(getNow()).toISOString());
  const load = new Map<string, number>();
  for (const r of (upcoming ?? []) as { tutor_id: string | null }[]) {
    if (r.tutor_id) load.set(r.tutor_id, (load.get(r.tutor_id) ?? 0) + 1);
  }

  const { data: sData } = await supabase
    .from("course_sessions").select("id, day_number, title, tutor_id").eq("course_id", id)
    .not("day_number", "is", null).order("day_number", { ascending: true });
  const sessions = (sData ?? []) as { id: string; day_number: number; title: string; tutor_id: string | null }[];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link href={`/admin/courses/${id}`} className="text-sm font-medium text-[#101B2D] underline">Back to the course</Link>
      <PageHeader title="Teaching team" description={course.title} />

      {sp.saved && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{saved[sp.saved] ?? "Saved."}</p>}
      {sp.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {sp.error === "busy"
            ? `That tutor is still down to teach ${sp.n ?? "some"} upcoming classes. Hand those over first (open each class and choose Hand over).`
            : errors[sp.error] ?? "Something went wrong."} {sp.detail ?? ""}
        </p>
      )}

      <Panel title="Lead instructor">
        <form action={setLead} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="course_id" value={id} />
          <select name="tutor_id" defaultValue={course.instructor_id ?? ""} className={field} aria-label="Lead instructor">
            <option value="">No lead instructor</option>
            {tutors.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>)}
          </select>
          <button className={`${btnSecondary} sm:shrink-0`}>Save lead</button>
        </form>
        <p className="mt-2 text-xs text-[#647084]">The lead is shown first on the course page and receives alerts when a cohort has no main tutor.</p>
      </Panel>

      <Panel title={`Team (${memberIds.length})`}>
        {memberIds.length === 0 ? (
          <p className="text-sm text-[#647084]">No tutors on this course yet.</p>
        ) : (
          <ul className="space-y-2">
            {memberIds.map((tid) => (
              <li key={tid} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#17253B]">
                    {nameOf.get(tid) ?? "Tutor"}
                    {tid === course.instructor_id && <span className="ml-2 rounded-full bg-[#D8BC7E]/40 px-2 py-0.5 text-xs font-medium text-[#101B2D]">Lead</span>}
                  </p>
                  <p className="text-xs text-[#647084]">{load.get(tid) ?? 0} upcoming classes</p>
                </div>
                {tid !== course.instructor_id && (
                  <form action={removeTeamMember}>
                    <input type="hidden" name="course_id" value={id} />
                    <input type="hidden" name="tutor_id" value={tid} />
                    <ConfirmButton label="Remove" message="Remove this tutor from the course team? They lose access to the course's classes, students and grading."
                      className="text-sm text-red-600 underline" />
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={addTeamMember} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="course_id" value={id} />
          <select name="tutor_id" required defaultValue="" className={field} aria-label="Add a tutor">
            <option value="" disabled>Add a tutor...</option>
            {candidates.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>)}
          </select>
          <button className={`${btnPrimary} sm:shrink-0`}>Add to team</button>
        </form>
        <p className="mt-2 text-xs text-[#647084]">
          Everyone on the team can see this course&apos;s classes and students, start any of its classes, mark attendance, review work, grade, and see recordings.
          New tutors are added to the site from People and tutors.
        </p>
      </Panel>

      <Panel title="Topic tutors">
        {sessions.length === 0 ? (
          <p className="text-sm text-[#647084]">This course has no numbered days yet. Add them in Curriculum first.</p>
        ) : (
          <form action={saveTopicTutors} className="space-y-3">
            <input type="hidden" name="course_id" value={id} />
            <p className="text-xs text-[#647084]">
              Pick who teaches each day. Days left on the default go to the cohort&apos;s main tutor. This is used when you generate a cohort&apos;s schedule.
            </p>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                  <input type="hidden" name="session_id" value={s.id} />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#17253B]">Day {s.day_number} · {s.title}</span>
                  <select name={`tutor_${s.id}`} defaultValue={s.tutor_id ?? ""} aria-label={`Tutor for day ${s.day_number}`}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]">
                    <option value="">Cohort&apos;s main tutor</option>
                    {memberIds.map((tid) => <option key={tid} value={tid}>{nameOf.get(tid) ?? "Tutor"}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="apply_now" />
              Also change classes already scheduled for these days (only those not yet started)
            </label>
            <button className={btnPrimary}>Save topic tutors</button>
          </form>
        )}
      </Panel>
    </main>
  );
}
