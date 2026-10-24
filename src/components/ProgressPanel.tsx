import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGrade, toInput } from "@/lib/grading";
import { loadCourseData } from "@/lib/grading-data";
import { Panel } from "@/components/ui";

const pct = (n: number | null) => (n === null ? "None yet" : `${n.toFixed(1)}%`);

// Live progress for the signed-in student, and the final grade once the tutor has published it.
export default async function ProgressPanel({
  supabase, courseId, slug, enrollmentId, studentId, cohortId,
}: {
  supabase: SupabaseClient;
  courseId: string;
  slug: string;
  enrollmentId: string;
  studentId: string;
  cohortId: string | null;
}) {
  const data = await loadCourseData(supabase, courseId);
  // While the course is running, work not yet handed in is not held against the student
  const r = computeGrade(toInput(data, { student_id: studentId, cohort_id: cohortId }, { assessment: null, missingAsZero: false }));
  const { data: g } = await supabase
    .from("course_grades").select("status, final_score, grade, passed").eq("enrollment_id", enrollmentId).maybeSingle();
  const published = g?.status === "published";

  return (
    <Panel title="Your progress">
      <div className="space-y-4">
        {published && (
          <Link href={`/my-courses/${slug}/report`}
            className="block rounded-xl border border-[#D8BC7E] bg-[#101B2D] p-4 text-white hover:opacity-95">
            <span className="block text-xs text-[#D8BC7E]">Final grade</span>
            <span className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-4xl font-semibold">{g?.grade ?? "-"}</span>
              <span className="text-lg">{g?.final_score !== null && g?.final_score !== undefined ? `${Number(g.final_score).toFixed(1)}%` : ""}</span>
            </span>
            <span className="mt-1 block text-sm text-[#D8BC7E] underline">See your report</span>
          </Link>
        )}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[#647084]">Attendance</dt>
            <dd className="font-medium text-[#17253B]">
              {r.attendance.held === 0
                ? "No classes held yet"
                : `${r.attendance.present} of ${r.attendance.held - r.attendance.excused} classes · ${pct(r.attendance.pct)}`}
            </dd>
          </div>
          <div>
            <dt className="text-[#647084]">Assignments</dt>
            <dd className="font-medium text-[#17253B]">
              {r.assignments.counted === 0 ? "No assignments yet" : `${r.assignments.graded} graded of ${r.assignments.counted} · average ${pct(r.assignments.pct)}`}
            </dd>
          </div>
        </dl>
        {!published && (
          <p className="text-xs text-[#647084]">Your final grade appears here when your tutor publishes it at the end of the course.</p>
        )}
      </div>
    </Panel>
  );
}
