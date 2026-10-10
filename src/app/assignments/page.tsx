import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { submissionStatus } from "@/lib/assignments";
import AssignmentStatus from "@/components/AssignmentStatus";

type A = {
  id: string; title: string; course_id: string;
  courses: { title: string } | null;
  course_sessions: { day_number: number | null } | null;
};
type S = { id: string; assignment_id: string; student_id: string; updated_at: string };
type F = { submission_id: string; updated_at: string; needs_revision: boolean };

export default async function AssignmentsPage() {
  const { supabase, user, profile } = await requireAccess();
  const isStaff = profile.role !== "student";

  const { data: aData } = await supabase
    .from("assignments")
    .select("id, title, course_id, courses(title), course_sessions(day_number)")
    .order("created_at", { ascending: false });
  const assignments = (aData ?? []) as unknown as A[];

  const { data: sData } = await supabase.from("submissions").select("id, assignment_id, student_id, updated_at");
  const subs = (sData ?? []) as S[];
  const { data: fData } = subs.length
    ? await supabase.from("feedback").select("submission_id, updated_at, needs_revision").in("submission_id", subs.map((s) => s.id))
    : { data: [] };
  const fbBySub = new Map(((fData ?? []) as F[]).map((f) => [f.submission_id, f]));

  let canCreate = profile.role === "admin";
  if (!canCreate && isStaff) {
    const { data } = await supabase.from("courses").select("id").eq("instructor_id", user.id).limit(1);
    canCreate = (data ?? []).length > 0;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Assignments</h1>
          <div className="flex items-center gap-3">
            {canCreate && (
              <Link href="/assignments/new" className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
                New assignment
              </Link>
            )}
            <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
          </div>
        </div>

        {assignments.length === 0 && (
          <p className="text-sm text-gray-500">
            {isStaff ? "No assignments yet." : "No assignments yet. They appear here once you are enrolled in a course."}
          </p>
        )}

        <ul className="space-y-2">
          {assignments.map((a) => {
            const mine = subs.filter((s) => s.assignment_id === a.id);
            const day = a.course_sessions?.day_number;
            let right: React.ReactNode;
            if (isStaff) {
              const waiting = mine.filter((s) => {
                const st = submissionStatus(s, fbBySub.get(s.id));
                return st === "submitted" || st === "resubmitted";
              }).length;
              right = (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${waiting ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                  {waiting ? `${waiting} to review` : `${mine.length} submitted`}
                </span>
              );
            } else {
              const sub = mine.find((s) => s.student_id === user.id);
              right = <AssignmentStatus status={submissionStatus(sub, sub ? fbBySub.get(sub.id) : null)} />;
            }
            return (
              <li key={a.id}>
                <Link href={`/assignments/${a.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-gray-600">
                      {a.courses?.title}{day ? ` · Day ${day}` : ""}
                    </p>
                  </div>
                  {right}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
