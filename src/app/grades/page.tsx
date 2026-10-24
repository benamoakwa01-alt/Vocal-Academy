import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { computeGrade, toInput } from "@/lib/grading";
import { loadCourseData } from "@/lib/grading-data";
import { EmptyState, PageHeader, Panel, btnSecondary } from "@/components/ui";

type Enr = {
  id: string; student_id: string; course_id: string; cohort_id: string | null;
  profiles: { full_name: string | null } | null;
  cohorts: { name: string } | null;
};
type Saved = { enrollment_id: string; status: string; assessment_score: number | null; missing_as_zero: boolean };

const pct = (n: number | null) => (n === null ? "-" : `${n.toFixed(1)}%`);

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; cohort?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  // Only the enrollments this person is allowed to see
  const { data: eData, error } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, cohort_id, profiles!student_id(full_name), cohorts(name)")
    .in("status", ["active", "completed", "paused"]);
  const all = (eData ?? []) as unknown as Enr[];

  const courseIds = [...new Set(all.map((e) => e.course_id))];
  const { data: cData } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds).order("title")
    : { data: [] };
  const courses = (cData ?? []) as { id: string; title: string }[];
  const course = courses.find((c) => c.id === sp.course) ?? courses[0];

  if (!course) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <PageHeader title="Grades" description="Attendance, assignments and final grades for each student." />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load students: {error.message}</p>}
        <EmptyState title="No students to grade yet"
          text="Students appear here once they are enrolled in a course you teach." />
      </main>
    );
  }

  const inCourse = all.filter((e) => e.course_id === course.id);
  const cohorts = [...new Map(inCourse.filter((e) => e.cohort_id).map((e) => [e.cohort_id as string, e.cohorts?.name ?? "Cohort"])).entries()];
  const list = (sp.cohort ? inCourse.filter((e) => e.cohort_id === sp.cohort) : inCourse)
    .sort((a, b) => (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? ""));

  const data = await loadCourseData(supabase, course.id);
  const { data: sData } = await supabase
    .from("course_grades").select("enrollment_id, status, assessment_score, missing_as_zero").limit(2000);
  const saved = new Map(((sData ?? []) as Saved[]).map((s) => [s.enrollment_id, s]));

  const rows = list.map((e) => {
    const s = saved.get(e.id);
    const result = computeGrade(toInput(data, e, {
      assessment: s?.assessment_score !== null && s?.assessment_score !== undefined ? Number(s.assessment_score) : null,
      missingAsZero: s?.missing_as_zero ?? true,
    }));
    return { e, s, result };
  });
  const published = rows.filter((r) => r.s?.status === "published").length;
  const finals = rows.map((r) => r.result.final).filter((n): n is number => n !== null);
  const average = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null;

  const pill = "rounded-full border px-3 py-1.5 text-sm";
  const on = "border-[#101B2D] bg-[#101B2D] text-white";
  const off = "border-gray-300 bg-white text-[#17253B]";

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Grades" description="Attendance, assignments and final grades for each student."
        actions={<Link href={`/grades/settings/${course.id}`} className={btnSecondary}>Grading settings</Link>} />

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load students: {error.message}</p>}

      <nav aria-label="Course" className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <Link key={c.id} href={`/grades?course=${c.id}`} className={`${pill} ${c.id === course.id ? on : off}`}>{c.title}</Link>
        ))}
      </nav>
      {cohorts.length > 1 && (
        <nav aria-label="Cohort" className="flex flex-wrap gap-2">
          <Link href={`/grades?course=${course.id}`} className={`${pill} ${!sp.cohort ? on : off}`}>All cohorts</Link>
          {cohorts.map(([id, name]) => (
            <Link key={id} href={`/grades?course=${course.id}&cohort=${id}`} className={`${pill} ${sp.cohort === id ? on : off}`}>{name}</Link>
          ))}
        </nav>
      )}

      <p className="text-sm text-[#647084]">
        <strong className="text-[#17253B]">{rows.length}</strong> {rows.length === 1 ? "student" : "students"} ·
        {" "}{published} published · average projected grade {average === null ? "none yet" : `${average.toFixed(1)}%`}
      </p>

      <Panel>
        <div className="-m-5 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-gray-200 text-[#647084]">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Attendance</th>
                <th className="px-4 py-3 font-medium">Assignments</th>
                <th className="px-4 py-3 font-medium">Assessment</th>
                <th className="px-4 py-3 font-medium">Projected</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, s, result }) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/grades/${e.id}`} className="font-medium text-[#101B2D] underline-offset-2 hover:underline">{e.profiles?.full_name ?? "No name"}</Link>
                    {e.cohorts?.name && <span className="block text-xs text-[#647084]">{e.cohorts.name}</span>}
                  </td>
                  <td className="px-4 py-3">{result.attendance.held === 0 ? "-" : `${result.attendance.present}/${result.attendance.held - result.attendance.excused} · ${pct(result.attendance.pct)}`}</td>
                  <td className="px-4 py-3">{pct(result.assignments.pct)}{result.assignments.pending > 0 && <span className="block text-xs text-amber-700">{result.assignments.pending} to review</span>}</td>
                  <td className="px-4 py-3">{result.assessment === null ? "-" : pct(result.assessment)}</td>
                  <td className="px-4 py-3 font-medium">{pct(result.final)}</td>
                  <td className="px-4 py-3 font-semibold text-[#101B2D]">{result.grade ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s?.status === "published" ? "bg-green-100 text-green-800" : s ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                      {s?.status === "published" ? "Published" : s ? "Draft" : "Not started"}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[#647084]">No students in this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-xs text-[#647084]">
        Projected grades use what has been recorded so far. Work that was never submitted counts as zero here, as it will in the final grade unless you switch that off on a student record.
      </p>
    </main>
  );
}
