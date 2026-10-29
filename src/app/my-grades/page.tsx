import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { computeGrade, toInput } from "@/lib/grading";
import { loadCourseData } from "@/lib/grading-data";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

type Enr = {
  id: string; status: string; cohort_id: string | null; course_id: string;
  courses: { title: string; slug: string } | null;
};
type Published = {
  enrollment_id: string; status: string; final_score: number | null;
  grade: string | null; passed: boolean | null;
};

const stateLabel: Record<string, string> = {
  graded: "Graded", pending: "Waiting for your tutor", missing: "Not submitted yet", ungraded: "Reviewed", notdue: "Not due yet",
};
const pct = (n: number | null) => (n === null ? "None yet" : `${n.toFixed(1)}%`);

export default async function MyGradesPage() {
  const { supabase, user } = await requireAccess();

  const { data: eData, error } = await supabase
    .from("enrollments").select("id, status, cohort_id, course_id, courses(title, slug)")
    .eq("student_id", user.id).in("status", ["active", "completed", "paused"]);
  const enrollments = ((eData ?? []) as unknown as Enr[]).filter((e) => e.courses);

  // The database only returns a final grade once the tutor has published it
  const { data: gData } = await supabase
    .from("course_grades").select("enrollment_id, status, final_score, grade, passed");
  const published = new Map(
    ((gData ?? []) as Published[]).filter((g) => g.status === "published").map((g) => [g.enrollment_id, g])
  );

  const blocks = await Promise.all(
    enrollments.map(async (e) => {
      const data = await loadCourseData(supabase, e.course_id);
      // While a course is running, work not yet handed in is not held against the student
      const input = toInput(data, { student_id: user.id, cohort_id: e.cohort_id }, { assessment: null, missingAsZero: false });
      return { e, input, result: computeGrade(input) };
    })
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeader title="My grades" description="Your attendance, assignment scores and final grades." />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load your grades: {error.message}</p>}

      {blocks.length === 0 && (
        <EmptyState title="No grades yet" text="Your grades appear here once you are enrolled in a course and your tutor starts marking your work."
          href="/courses" cta="Explore courses" />
      )}

      {blocks.map(({ e, input, result }) => {
        const g = published.get(e.id);
        const rows = input.work.filter((w) => w.counts && w.weight > 0);
        return (
          <Panel key={e.id} title={e.courses!.title}
            action={<Link href={`/my-courses/${e.courses!.slug}`} className="text-sm font-medium text-[#101B2D] underline">Open course</Link>}>
            <div className="space-y-5">
              {g ? (
                <Link href={`/my-courses/${e.courses!.slug}/report`}
                  className="flex flex-wrap items-center gap-5 rounded-xl border border-[#D8BC7E] bg-[#101B2D] p-4 text-white hover:opacity-95">
                  <span className="font-display text-5xl font-semibold">{g.grade ?? "-"}</span>
                  <span>
                    <span className="block text-xl font-semibold">{g.final_score !== null ? `${Number(g.final_score).toFixed(1)}%` : ""}</span>
                    <span className="block text-sm text-[#D8BC7E]">Final grade{g.passed === null ? "" : g.passed ? " · Passed" : ""} · See your report</span>
                  </span>
                </Link>
              ) : (
                <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#647084]">
                  Your final grade for this course has not been published yet. Your tutor publishes it at the end of the course, and you will get a notification.
                </p>
              )}

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <dt className="text-[#647084]">Attendance</dt>
                  <dd className="font-medium text-[#17253B]">
                    {result.attendance.held === 0 ? "No classes held yet"
                      : `${result.attendance.present} of ${result.attendance.held - result.attendance.excused} classes · ${pct(result.attendance.pct)}`}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <dt className="text-[#647084]">Assignment average so far</dt>
                  <dd className="font-medium text-[#17253B]">
                    {result.assignments.graded === 0 ? "No graded work yet" : `${pct(result.assignments.pct)} from ${result.assignments.graded} graded`}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#17253B]">Assignments</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-[#647084]">No assignments count toward this course yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {rows.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <Link href={`/assignments/${w.id}`} className="min-w-0 truncate text-[#17253B] underline-offset-2 hover:underline">{w.title}</Link>
                        <span className="shrink-0 font-medium text-[#17253B]">
                          {w.state === "graded" && w.score !== null ? `${w.score} / 100` : <span className="font-normal text-[#647084]">{stateLabel[w.state]}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        );
      })}
    </main>
  );
}
