import Link from "next/link";
import { requireUser } from "@/lib/session";
import { tutorNames } from "@/lib/people";

const badge: Record<string, { label: string; cls: string }> = {
  active: { label: "Enrolled", cls: "bg-green-100 text-green-800" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-700" },
  pending: { label: "Request pending", cls: "bg-amber-100 text-amber-800" },
  paused: { label: "Paused", cls: "bg-amber-100 text-amber-800" },
  expired: { label: "Expired", cls: "bg-gray-100 text-gray-700" },
  withdrawn: { label: "Withdrawn", cls: "bg-gray-100 text-gray-700" },
};

export default async function CoursesPage() {
  const { supabase, user } = await requireUser();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, slug, title, summary, duration, format, instructor_id")
    .eq("published", true)
    .order("created_at", { ascending: true });

  const { data: enrollments } = await supabase
    .from("enrollments").select("course_id, status").eq("student_id", user.id);

  const statusByCourse = new Map<string, string>(
    (enrollments ?? []).map((e: { course_id: string; status: string }) => [e.course_id, e.status])
  );
  const names = await tutorNames(supabase, (courses ?? []).map((c: { instructor_id: string | null }) => c.instructor_id));

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Explore Courses</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        {(courses ?? []).length === 0 && <p className="text-sm text-gray-500">No courses available yet.</p>}

        <ul className="grid gap-4 sm:grid-cols-2">
          {(courses ?? []).map((c: {
            id: string; slug: string; title: string; summary: string | null;
            duration: string | null; format: string | null; instructor_id: string | null;
          }) => {
            const b = badge[statusByCourse.get(c.id) ?? ""];
            return (
              <li key={c.id}>
                <Link href={`/courses/${c.slug}`}
                  className="flex h-full flex-col justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold">{c.title}</h2>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${b ? b.cls : "bg-blue-100 text-blue-800"}`}>
                        {b ? b.label : "Explore"}
                      </span>
                    </div>
                    {c.summary && <p className="text-sm text-gray-600">{c.summary}</p>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {[c.instructor_id ? names[c.instructor_id] : null, c.duration, c.format].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
