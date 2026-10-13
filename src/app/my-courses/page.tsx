import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { enrollmentLabel } from "@/lib/enrollment";
import LocalTime from "@/components/LocalTime";
import { EmptyState, PageHeader } from "@/components/ui";

type Enr = {
  id: string;
  status: string;
  courses: { id: string; title: string; slug: string; summary: string | null; duration: string | null } | null;
  cohorts: { name: string } | null;
};

const pill: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-gray-100 text-gray-700",
};

export default async function MyCoursesPage() {
  const { supabase, user } = await requireAccess();
  const now = getNow();

  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, courses(id, title, slug, summary, duration), cohorts(name)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  const all = ((data ?? []) as unknown as Enr[]).filter((e) => e.courses);
  const current = all.filter((e) => ["active", "paused", "pending", "completed"].includes(e.status));
  const closed = all.filter((e) => !["active", "paused", "pending", "completed"].includes(e.status));

  const { data: cData } = await supabase
    .from("classes").select(CLASS_COLUMNS)
    .or(`status.eq.live,and(status.eq.scheduled,ends_at.gte.${new Date(now).toISOString()})`)
    .order("starts_at", { ascending: true });
  const nextByCourse = new Map<string, ClassRow>();
  for (const c of (cData ?? []) as ClassRow[]) {
    if (c.course_id && !nextByCourse.has(c.course_id)) nextByCourse.set(c.course_id, c);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="My courses" description="Everything you are enrolled in, in one place." />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load your courses: {error.message}</p>}

      {current.length === 0 ? (
        <EmptyState title="You are not enrolled in a course yet"
          text="Browse the academy courses and enroll. Your course appears here once you start."
          href="/courses" cta="Explore courses" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {current.map((e) => {
            const c = e.courses!;
            const next = nextByCourse.get(c.id);
            return (
              <li key={e.id}>
                <Link href={e.status === "pending" ? `/courses/${c.slug}/enroll` : `/my-courses/${c.slug}`}
                  className="flex h-full flex-col justify-between gap-4 rounded-xl border border-gray-200 border-t-[3px] border-t-[#D8BC7E] bg-white p-5 shadow-sm hover:shadow-md">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-xl font-semibold leading-snug text-[#101B2D]">{c.title}</h2>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${pill[e.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {e.status === "pending" ? "Awaiting payment" : enrollmentLabel(e.status)}
                      </span>
                    </div>
                    {c.summary && <p className="text-sm text-[#647084]">{c.summary}</p>}
                  </div>
                  <div className="space-y-1 text-sm">
                    {e.cohorts?.name && <p className="text-[#647084]">Cohort: <span className="text-[#17253B]">{e.cohorts.name}</span></p>}
                    {e.status === "pending" ? (
                      <p className="font-medium text-[#8a6d2f]">Finish your payment to unlock this course.</p>
                    ) : next ? (
                      <p className="text-[#17253B]">Next class: <LocalTime iso={next.starts_at} /></p>
                    ) : (
                      <p className="text-[#647084]">No upcoming class scheduled yet.</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-[#17253B]">Past enrollments ({closed.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {closed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span>{e.courses!.title}</span>
                <span className="text-[#647084]">{enrollmentLabel(e.status)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
