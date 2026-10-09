import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { enrollmentLabel } from "@/lib/enrollment";
import { enrollStudent, setEnrollmentStatus } from "./actions";

type Row = {
  id: string;
  status: string;
  expires_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  courses: { title: string } | null;
};

type Action = { label: string; status: string; primary?: boolean };

function EnrollmentRow({ e, actions, now }: { e: Row; actions: Action[]; now: number }) {
  const lapsed = e.status === "active" && e.expires_at && new Date(e.expires_at).getTime() < now;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <p className="font-medium">{e.profiles?.full_name ?? "No name"}</p>
        <p className="text-sm text-gray-600">{e.profiles?.email} · {e.courses?.title}</p>
        {e.expires_at && (
          <p className={`text-xs ${lapsed ? "text-red-600" : "text-gray-500"}`}>
            {lapsed ? "Access ended " : "Access until "}{new Date(e.expires_at).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <form key={a.status} action={setEnrollmentStatus}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="status" value={a.status} />
            <button className={a.primary
              ? "rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
              : "rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"}>
              {a.label}
            </button>
          </form>
        ))}
      </div>
    </li>
  );
}

export default async function AdminEnrollmentsPage() {
  const { supabase } = await requireAdmin();
  const now = getNow();

  const { data } = await supabase
    .from("enrollments")
    .select("id, status, expires_at, created_at, profiles(full_name, email), courses(title)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  const { data: students } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "student").eq("approved", true).order("full_name");
  const { data: courses } = await supabase.from("courses").select("id, title").order("title");

  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status === "active");
  const paused = rows.filter((r) => r.status === "paused");
  const closed = rows.filter((r) => ["completed", "expired", "withdrawn", "cancelled"].includes(r.status));
  const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Enrollments</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pending requests ({pending.length})</h2>
          {pending.length === 0 && <p className="text-sm text-gray-500">No requests waiting.</p>}
          <ul className="space-y-2">
            {pending.map((e) => (
              <EnrollmentRow key={e.id} e={e} now={now} actions={[
                { label: "Activate", status: "active", primary: true },
                { label: "Decline", status: "cancelled" },
              ]} />
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Enroll or re-enroll a student</h2>
          <form action={enrollStudent} className="grid gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-2">
            <select name="student_id" required defaultValue="" className={input}>
              <option value="" disabled>Student…</option>
              {(students ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => (
                <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
              ))}
            </select>
            <select name="course_id" required defaultValue="" className={input}>
              <option value="" disabled>Course…</option>
              {(courses ?? []).map((c: { id: string; title: string }) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <label className="text-sm sm:col-span-2">Access ends on (optional)
              <input type="date" name="expires_on" className={`${input} mt-1`} />
            </label>
            <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800 sm:col-span-2">Enroll</button>
          </form>
          <p className="text-xs text-gray-500">Re-enrolling an existing student resets their access with the new end date.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active ({active.length})</h2>
          {active.length === 0 && <p className="text-sm text-gray-500">No active enrollments.</p>}
          <ul className="space-y-2">
            {active.map((e) => (
              <EnrollmentRow key={e.id} e={e} now={now} actions={[
                { label: "Pause", status: "paused" },
                { label: "Mark completed", status: "completed" },
                { label: "Withdraw", status: "withdrawn" },
              ]} />
            ))}
          </ul>
        </section>

        {paused.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Paused ({paused.length})</h2>
            <ul className="space-y-2">
              {paused.map((e) => (
                <EnrollmentRow key={e.id} e={e} now={now} actions={[
                  { label: "Resume", status: "active", primary: true },
                  { label: "Withdraw", status: "withdrawn" },
                ]} />
              ))}
            </ul>
          </section>
        )}

        {closed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Closed ({closed.length})</h2>
            <ul className="space-y-2">
              {closed.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
                  <span>{e.profiles?.full_name ?? e.profiles?.email} · {e.courses?.title}</span>
                  <span className="text-gray-600">{enrollmentLabel(e.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
