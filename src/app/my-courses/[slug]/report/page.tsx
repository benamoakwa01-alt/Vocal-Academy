import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import PrintButton from "@/components/PrintButton";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

type Detail = {
  scheme: { pass_mark: number };
  parts: { key: string; label: string; weight: number; value: number | null }[];
  attendance: { held: number; present: number; excused: number; absent: number; rows: { title: string; date: string; status: string }[] };
  assignments: { rows: { title: string; weight: number; state: string; score: number | null }[] };
};
const workLabel: Record<string, string> = {
  graded: "Graded", pending: "Not finished", missing: "Not submitted", ungraded: "Reviewed", notdue: "Not due yet",
};
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user, profile } = await requireAccess();

  const { data: course } = await supabase.from("courses").select("id, title").eq("slug", slug).maybeSingle();
  if (!course) notFound();
  const { data: enr } = await supabase
    .from("enrollments").select("id, cohorts(name)").eq("course_id", course.id).eq("student_id", user.id).maybeSingle();
  if (!enr) notFound();
  const cohort = enr.cohorts as unknown as { name: string } | null;

  // The database only returns this once the tutor has published it
  const { data: g } = await supabase.from("course_grades").select("*").eq("enrollment_id", enr.id).maybeSingle();

  if (!g || g.status !== "published") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <Link href={`/my-courses/${slug}`} className="text-sm font-medium text-[#101B2D] underline">Back to {course.title}</Link>
        <EmptyState title="Your final report is not ready yet"
          text="Your tutor publishes it at the end of the course. You will get a notification when it is ready." />
      </main>
    );
  }

  const d = (g.detail ?? null) as Detail | null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link href={`/my-courses/${slug}`} className="no-print text-sm font-medium text-[#101B2D] underline">Back to {course.title}</Link>
      <PageHeader title="Final report" description={`${profile.full_name ?? "Student"} · ${course.title}${cohort ? ` · ${cohort.name}` : ""}`}
        actions={<PrintButton />} />

      <Panel>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="font-display text-6xl font-semibold text-[#101B2D]">{g.grade ?? "-"}</p>
            <p className="text-sm text-[#647084]">Grade</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-[#17253B]">{g.final_score !== null ? `${Number(g.final_score).toFixed(1)}%` : "-"}</p>
            <p className="text-sm text-[#647084]">
              {g.passed === null ? "" : g.passed ? "Passed" : "Did not reach the pass mark"}
              {d ? ` (pass mark ${d.scheme.pass_mark}%)` : ""}
            </p>
            {g.published_at && <p className="mt-1 text-xs text-[#647084]">Issued {dateOf(g.published_at)}</p>}
          </div>
        </div>
      </Panel>

      {d && (
        <Panel title="How your grade was made up">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-[#647084]">
              <tr><th className="py-2 font-medium">Part</th><th className="py-2 font-medium">Weight</th><th className="py-2 font-medium">Your score</th></tr>
            </thead>
            <tbody>
              {d.parts.filter((p) => p.weight > 0).map((p) => (
                <tr key={p.key} className="border-b border-gray-100 last:border-0">
                  <td className="py-2">{p.label}</td>
                  <td className="py-2">{p.weight}%</td>
                  <td className="py-2">{p.value === null ? "Not used" : `${p.value.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {g.tutor_comment && (
        <Panel title="Your tutor says"><p className="whitespace-pre-line text-sm text-[#17253B]">{g.tutor_comment}</p></Panel>
      )}

      {d && (
        <Panel title={`Attendance: ${d.attendance.present} present, ${d.attendance.excused} excused, ${d.attendance.absent} absent`}>
          <ul className="divide-y divide-gray-100">
            {d.attendance.rows.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{c.title} · {dateOf(c.date)}</span>
                <span className="shrink-0 text-[#647084]">{c.status === "present" ? "Present" : c.status === "excused" ? "Excused" : "Absent"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {d && d.assignments.rows.length > 0 && (
        <Panel title="Assignments">
          <ul className="divide-y divide-gray-100">
            {d.assignments.rows.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{a.title}{a.weight !== 1 ? ` (weight ${a.weight})` : ""}</span>
                <span className="shrink-0 text-[#647084]">{a.state === "graded" && a.score !== null ? `${a.score}` : workLabel[a.state] ?? a.state}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </main>
  );
}
