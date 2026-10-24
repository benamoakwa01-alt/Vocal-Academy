import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { computeGrade, toInput } from "@/lib/grading";
import { loadCourseData } from "@/lib/grading-data";
import PrintButton from "@/components/PrintButton";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import { saveGrade } from "../actions";

type Saved = {
  status: string; final_score: number | null; assessment_score: number | null;
  tutor_comment: string | null; missing_as_zero: boolean; published_at: string | null;
};

const errors: Record<string, string> = {
  assessment: "The assessment score must be a number from 0 to 100.",
  notready: "This grade is not ready to publish. Fix the items marked below, or tick the box to publish anyway.",
  nodata: "There is nothing to grade yet.",
  published: "This grade is published. Use Update published grade, or Unpublish it first.",
  save: "Could not save the grade.",
};
const workLabel: Record<string, string> = {
  graded: "Graded", pending: "Waiting for review", missing: "Not submitted", ungraded: "Reviewed, no score",
};
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function GradeRecordPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; detail?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const { data: enr } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, cohort_id, profiles!student_id(full_name, email), courses(title, slug), cohorts(name)")
    .eq("id", id).maybeSingle();
  if (!enr) notFound();
  const person = enr.profiles as unknown as { full_name: string | null; email: string | null } | null;
  const course = enr.courses as unknown as { title: string; slug: string } | null;
  const cohort = enr.cohorts as unknown as { name: string } | null;

  const { data: sRow } = await supabase.from("course_grades").select("*").eq("enrollment_id", id).maybeSingle();
  const saved = (sRow ?? null) as Saved | null;
  const published = saved?.status === "published";

  const data = await loadCourseData(supabase, enr.course_id);
  const assessmentNow = saved && saved.assessment_score !== null ? Number(saved.assessment_score) : null;
  const input = toInput(data, enr, { assessment: assessmentNow, missingAsZero: saved?.missing_as_zero ?? true });
  const result = computeGrade(input);
  const changed = published && saved?.final_score !== null && saved?.final_score !== undefined && Number(saved.final_score) !== result.final;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link href={`/grades?course=${enr.course_id}`} className="no-print text-sm font-medium text-[#101B2D] underline">All grades</Link>
      <PageHeader
        title={person?.full_name ?? "Student record"}
        description={`${course?.title ?? "Course"}${cohort ? ` · ${cohort.name}` : ""}`}
        actions={<PrintButton />}
      />

      {sp.saved && (
        <p role="status" className="no-print rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {sp.saved === "published" ? "Published. The student has been notified." : sp.saved === "unpublished" ? "Unpublished. The student can no longer see the grade." : "Draft saved."}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="no-print rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors[sp.error] ?? "Something went wrong."} {sp.detail ?? ""}
        </p>
      )}
      {changed && (
        <p className="no-print rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The records have changed since you published (published {saved?.final_score}%, now {result.final}%). Use Update published grade to refresh the student report.
        </p>
      )}

      <Panel title="Result">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="font-display text-6xl font-semibold text-[#101B2D]">{result.grade ?? "-"}</p>
            <p className="text-sm text-[#647084]">{result.label ?? "Not enough information"}</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-[#17253B]">{result.final === null ? "-" : `${result.final.toFixed(1)}%`}</p>
            <p className="text-sm text-[#647084]">
              {result.passed === null ? "Final score" : result.passed ? `Passed (pass mark ${data.scheme.pass_mark}%)` : `Below the pass mark of ${data.scheme.pass_mark}%`}
            </p>
            <p className="mt-1 text-xs text-[#647084]">
              {published ? `Published${saved?.published_at ? ` on ${dateOf(saved.published_at)}` : ""}` : saved ? "Draft, not visible to the student" : "Not saved yet"}
            </p>
          </div>
        </div>
        <table className="mt-5 w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-[#647084]">
            <tr><th className="py-2 font-medium">Part</th><th className="py-2 font-medium">Weight</th><th className="py-2 font-medium">Score</th></tr>
          </thead>
          <tbody>
            {result.parts.map((p) => (
              <tr key={p.key} className="border-b border-gray-100 last:border-0">
                <td className="py-2">{p.label}</td>
                <td className="py-2">{p.weight}%</td>
                <td className="py-2">{p.weight === 0 ? "Not used" : p.value === null ? "Not yet" : `${p.value.toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(result.blockers.length > 0 || result.warnings.length > 0) && (
          <ul className="no-print mt-4 space-y-1 text-sm">
            {result.blockers.map((b) => <li key={b} className="text-red-700">Needs attention: {b}</li>)}
            {result.warnings.map((w) => <li key={w} className="text-amber-700">Note: {w}</li>)}
          </ul>
        )}
      </Panel>

      <Panel title={`Attendance (${result.attendance.present} present, ${result.attendance.excused} excused, ${result.attendance.absent} absent)`}>
        {input.classes.length === 0 ? (
          <p className="text-sm text-[#647084]">No completed classes yet for this cohort.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {input.classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/classes/${c.id}`} className="min-w-0 truncate text-[#17253B] underline-offset-2 hover:underline">{c.title} · {dateOf(c.starts_at)}</Link>
                <span className={c.status === "present" ? "text-green-700" : c.status === "excused" ? "text-[#647084]" : "text-red-700"}>
                  {c.status === "present" ? "Present" : c.status === "excused" ? "Excused" : "Absent"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="no-print mt-3 text-xs text-[#647084]">To change a mark, open the class and use the attendance register.</p>
      </Panel>

      <Panel title={`Assignments (${result.assignments.graded} graded of ${result.assignments.counted} counted)`}>
        {input.work.filter((w) => w.counts && w.weight > 0).length === 0 ? (
          <p className="text-sm text-[#647084]">No assignments count toward this course grade.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {input.work.filter((w) => w.counts && w.weight > 0).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/assignments/${w.id}`} className="min-w-0 truncate text-[#17253B] underline-offset-2 hover:underline">
                  {w.title}{w.weight !== 1 ? ` (weight ${w.weight})` : ""}
                </Link>
                <span className="shrink-0 text-[#647084]">
                  {workLabel[w.state]}{w.state === "graded" && w.score !== null ? ` · ${w.score}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {saved?.tutor_comment && published && (
        <Panel title="Tutor comment"><p className="whitespace-pre-line text-sm text-[#17253B]">{saved.tutor_comment}</p></Panel>
      )}

      <Panel title="Final assessment, comment and publishing" className="no-print">
        <form action={saveGrade} className="space-y-4">
          <input type="hidden" name="enrollment_id" value={enr.id} />
          <label className="block text-sm">Final assessment score (0 to 100, optional)
            <input name="assessment" type="number" min={0} max={100} step="0.1" defaultValue={saved?.assessment_score ?? ""}
              className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B] sm:w-48" />
            <span className="mt-1 block text-xs text-[#647084]">
              {data.scheme.assessment_weight > 0 ? `This counts for ${data.scheme.assessment_weight}% of the grade.` : "This course gives the final assessment no weight, so it is only recorded."}
            </span>
          </label>
          <label className="block text-sm">Tutor comment (shown on the student report once published)
            <textarea name="comment" rows={5} defaultValue={saved?.tutor_comment ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-[#17253B]" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="missing_as_zero" defaultChecked={saved?.missing_as_zero ?? true} />
            Count work that was never submitted as zero
          </label>
          {!result.ready && (
            <label className="flex items-center gap-2 text-sm text-amber-800">
              <input type="checkbox" name="force" />
              Publish even though the items marked above are not finished
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {!published && <button name="intent" value="draft" className={btnSecondary}>Save draft</button>}
            <button name="intent" value="publish" className={btnPrimary}>{published ? "Update published grade" : "Publish to student"}</button>
            {published && <button name="intent" value="unpublish" className={btnSecondary}>Unpublish</button>}
          </div>
        </form>
      </Panel>
    </main>
  );
}
