import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { enrollmentLabel } from "@/lib/enrollment";
import { PageHeader, btnPrimary, btnSecondary } from "@/components/ui";

type Student = { id: string; full_name: string | null; email: string | null; created_at: string; approved: boolean };
type Enr = {
  id: string; student_id: string; status: string; cohort_id: string | null;
  courses: { id: string; title: string } | null;
  cohorts: { name: string } | null;
};

const STATUSES = ["pending", "active", "paused", "completed", "expired", "withdrawn", "cancelled"];
const pill: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  paused: "bg-amber-100 text-amber-800",
};
const select = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; course?: string; status?: string; cohort?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const { supabase } = await requireAdmin();

  const { data: sData, error: sErr } = await supabase
    .from("profiles").select("id, full_name, email, created_at, approved")
    .eq("role", "student").order("created_at", { ascending: false }).limit(500);
  const { data: eData, error: eErr } = await supabase
    .from("enrollments").select("id, student_id, status, cohort_id, courses(id, title), cohorts(name)").limit(3000);
  const { data: cData } = await supabase.from("courses").select("id, title").order("title");
  const { data: kData } = await supabase.from("cohorts").select("id, name").order("starts_on", { ascending: false });

  const students = (sData ?? []) as Student[];
  const enrollments = (eData ?? []) as unknown as Enr[];
  const courses = (cData ?? []) as { id: string; title: string }[];
  const cohorts = (kData ?? []) as { id: string; name: string }[];

  const byStudent = new Map<string, Enr[]>();
  for (const e of enrollments) {
    const list = byStudent.get(e.student_id) ?? [];
    list.push(e);
    byStudent.set(e.student_id, list);
  }

  const visible = students.filter((s) => {
    if (q && !`${s.full_name ?? ""} ${s.email ?? ""}`.toLowerCase().includes(q)) return false;
    const mine = byStudent.get(s.id) ?? [];
    const scoped = sp.course ? mine.filter((e) => e.courses?.id === sp.course) : mine;
    if (sp.status === "none") return scoped.length === 0;
    if (sp.cohort === "nocohort") return scoped.some((e) => e.status === "active" && !e.cohort_id);
    if (sp.cohort && !scoped.some((e) => e.cohort_id === sp.cohort)) return false;
    if (sp.status && STATUSES.includes(sp.status)) return scoped.some((e) => e.status === sp.status);
    if (sp.course) return scoped.length > 0;
    return true;
  });

  const withActive = visible.filter((s) => (byStudent.get(s.id) ?? []).some((e) => e.status === "active")).length;
  const notEnrolled = visible.filter((s) => (byStudent.get(s.id) ?? []).length === 0).length;
  const filtered = !!(q || sp.course || sp.status || sp.cohort);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Students" description="Everyone who has signed up, and what they are enrolled in."
        actions={<><Link href="/admin/enrollments" className={btnSecondary}>Enrollments</Link><Link href="/admin/cohorts" className={btnSecondary}>Cohorts</Link></>} />

      {(sErr || eErr) && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Could not load all the data: {sErr?.message ?? eErr?.message}
        </p>
      )}

      <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-sm lg:col-span-2">Search
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or email"
            className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]" />
        </label>
        <label className="block text-sm">Course
          <select name="course" defaultValue={sp.course ?? ""} className={`${select} mt-1`}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="block text-sm">Enrollment
          <select name="status" defaultValue={sp.status ?? ""} className={`${select} mt-1`}>
            <option value="">Any</option>
            <option value="none">Not enrolled</option>
            {STATUSES.map((s) => <option key={s} value={s}>{enrollmentLabel(s)}</option>)}
          </select>
        </label>
        <label className="block text-sm">Cohort
          <select name="cohort" defaultValue={sp.cohort ?? ""} className={`${select} mt-1`}>
            <option value="">Any</option>
            <option value="nocohort">Paid, not in a cohort</option>
            {cohorts.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button className={btnPrimary}>Apply filters</button>
          {filtered && <Link href="/admin/students" className={btnSecondary}>Clear</Link>}
        </div>
      </form>

      <p className="text-sm text-[#647084]">
        <strong className="text-[#17253B]">{visible.length}</strong> {visible.length === 1 ? "student" : "students"}
        {filtered ? " match your filters" : ""} · {withActive} with an active enrollment · {notEnrolled} not enrolled in anything
        {students.length >= 500 ? " · showing the 500 most recent" : ""}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-[#647084]">
          {students.length === 0 ? "No one has signed up yet." : "No students match these filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => {
            const mine = byStudent.get(s.id) ?? [];
            return (
              <li key={s.id}>
                <Link href={`/admin/students/${s.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[#101B2D]">
                        {s.full_name ?? "No name"}
                        {!s.approved && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">On hold</span>}
                      </p>
                      <p className="truncate text-sm text-[#647084]">{s.email}</p>
                    </div>
                    <p className="text-xs text-[#647084]">
                      Joined {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {mine.length === 0 ? (
                    <p className="mt-3 text-sm text-[#647084]">Not enrolled in any course.</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {mine.map((e) => (
                        <li key={e.id} className={`rounded-full px-3 py-1 text-xs font-medium ${pill[e.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {e.courses?.title ?? "Course"} · {enrollmentLabel(e.status)}{e.cohorts?.name ? ` · ${e.cohorts.name}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
