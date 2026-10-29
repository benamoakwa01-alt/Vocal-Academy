import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { loadCourseData } from "@/lib/grading-data";
import { PageHeader, Panel, btnPrimary } from "@/components/ui";
import { saveScheme, saveWeights } from "../actions";

const field = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B] disabled:bg-gray-50";
const errors: Record<string, string> = {
  weights: "Each weight must be a number that is zero or more.",
  sum: "The three weights must add up to exactly 100.",
  pass: "The pass mark must be between 0 and 100.",
  bands: "Each grade band needs a lowest score from 0 to 100 and a grade letter.",
  zero: "Add a band that starts at 0, so every score gets a grade.",
  weight: "Assignment weights must be zero or more.",
  save: "Could not save.",
};

export default async function GradingSettingsPage({
  params, searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; detail?: string }>;
}) {
  const { courseId } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const { data: course } = await supabase
    .from("courses").select("id, title, instructor_id").eq("id", courseId).maybeSingle();
  if (!course) notFound();
  const canEdit = profile.role === "admin" || course.instructor_id === user.id;

  const data = await loadCourseData(supabase, courseId);
  const s = data.scheme;
  const bandRows = Array.from({ length: 6 }, (_, i) => s.bands[i] ?? { min: "", grade: "", label: "" });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link href={`/grades?course=${courseId}`} className="text-sm font-medium text-[#101B2D] underline">All grades</Link>
      <PageHeader title="Grading settings" description={course.title} />

      {sp.saved && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Saved. Existing draft grades update the next time they are saved.</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors[sp.error] ?? "Something went wrong."} {sp.detail ?? ""}</p>}
      {!canEdit && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Only an admin or the course instructor can change these settings. You can see them here.</p>
      )}

      <Panel title="How the grade is made up">
        <form action={saveScheme} className="space-y-5">
          <input type="hidden" name="course_id" value={courseId} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">Attendance (%)
              <input name="attendance_weight" type="number" min={0} step="0.5" defaultValue={s.attendance_weight} disabled={!canEdit} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">Assignments (%)
              <input name="assignments_weight" type="number" min={0} step="0.5" defaultValue={s.assignments_weight} disabled={!canEdit} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">Final assessment (%)
              <input name="assessment_weight" type="number" min={0} step="0.5" defaultValue={s.assessment_weight} disabled={!canEdit} className={`${field} mt-1`} />
            </label>
          </div>
          <p className="text-xs text-[#647084]">The three must add up to 100. Use 0 for the final assessment if the course has none.</p>

          <label className="block text-sm sm:w-56">Late penalty (points)
              <input name="late_penalty" type="number" min={0} max={100} step="0.5" defaultValue={s.late_penalty} disabled={!canEdit} className={`${field} mt-1`} />
              <span className="mt-1 block text-xs text-[#647084]">Taken off the score of work handed in after its due time. Use 0 for no penalty.</span>
            </label>
          <label className="block text-sm sm:w-56">Pass mark (%)
            <input name="pass_mark" type="number" min={0} max={100} step="0.5" defaultValue={s.pass_mark} disabled={!canEdit} className={`${field} mt-1`} />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#17253B]">Grade bands</legend>
            <p className="text-xs text-[#647084]">A student gets the highest band whose lowest score they reach. Leave unused rows empty. One band must start at 0.</p>
            <div className="grid grid-cols-[6rem_6rem_1fr] gap-2 text-xs text-[#647084]"><span>Lowest score</span><span>Grade</span><span>Description</span></div>
            {bandRows.map((b, i) => (
              <div key={i} className="grid grid-cols-[6rem_6rem_1fr] gap-2">
                <input name={`band_min_${i}`} type="number" min={0} max={100} step="0.5" defaultValue={b.min} disabled={!canEdit} aria-label={`Band ${i + 1} lowest score`} className={field} />
                <input name={`band_grade_${i}`} defaultValue={b.grade} disabled={!canEdit} aria-label={`Band ${i + 1} grade`} className={field} />
                <input name={`band_label_${i}`} defaultValue={b.label} disabled={!canEdit} aria-label={`Band ${i + 1} description`} className={field} />
              </div>
            ))}
          </fieldset>
          {canEdit && <button className={btnPrimary}>Save grading scheme</button>}
        </form>
      </Panel>

      <Panel title="How much each assignment counts">
        {data.assignments.length === 0 ? (
          <p className="text-sm text-[#647084]">This course has no assignments yet.</p>
        ) : (
          <form action={saveWeights} className="space-y-3">
            <input type="hidden" name="course_id" value={courseId} />
            <p className="text-xs text-[#647084]">
              A weight of 2 counts twice as much as 1. Untick a box to leave an assignment out of the course grade, for example a practice task.
            </p>
            <ul className="space-y-2">
              {data.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#17253B]">{a.title}</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`counts_${a.id}`} defaultChecked={a.counts} disabled={!canEdit} /> Counts
                  </label>
                  <label className="flex items-center gap-2 text-sm">Weight
                    <input name={`weight_${a.id}`} type="number" min={0} step="0.5" defaultValue={a.weight} disabled={!canEdit}
                      aria-label={`Weight for ${a.title}`} className={`${field} w-24`} />
                  </label>
                </li>
              ))}
            </ul>
            {canEdit && <button className={btnPrimary}>Save assignment weights</button>}
          </form>
        )}
      </Panel>
    </main>
  );
}
