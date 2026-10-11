import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { enrollmentLabel } from "@/lib/enrollment";
import { money } from "@/lib/pricing";
import { enrollStudent, setEnrollmentStatus } from "./actions";

type Row = {
  id: string;
  status: string;
  expires_at: string | null;
  cohort_id: string | null;
  created_at: string;
  list_price: number | null;
  discount: number | null;
  amount_due: number | null;
  promo_label: string | null;
  payment_reference: string | null;
  payment_reported_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  courses: { title: string } | null;
};

type Action = { label: string; status: string; primary?: boolean };

function Buttons({ id, actions }: { id: string; actions: Action[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <form key={a.status} action={setEnrollmentStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={a.status} />
          <button className={a.primary
            ? "rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            : "rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"}>
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}

function Who({ e, now }: { e: Row; now: number }) {
  const lapsed = e.status === "active" && e.expires_at && new Date(e.expires_at).getTime() < now;
  return (
    <div>
      <p className="font-medium">{e.profiles?.full_name ?? "No name"}</p>
      <p className="text-sm text-gray-600">{e.profiles?.email} · {e.courses?.title}</p>
      {e.expires_at && (
        <p className={`text-xs ${lapsed ? "text-red-600" : "text-gray-500"}`}>
          {lapsed ? "Access ended " : "Access until "}{new Date(e.expires_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default async function AdminEnrollmentsPage() {
  const { supabase } = await requireAdmin();
  const now = getNow();

  const { data } = await supabase
    .from("enrollments")
    .select("id, status, expires_at, cohort_id, created_at, list_price, discount, amount_due, promo_label, payment_reference, payment_reported_at, profiles(full_name, email), courses(title)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  const { data: students } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "student").order("full_name");
  const { data: courses } = await supabase.from("courses").select("id, title").order("title");

  const pending = rows.filter((r) => r.status === "pending");
  const noCohort = rows.filter((r) => r.status === "active" && !r.cohort_id);
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
          <h2 className="text-lg font-semibold">Waiting for payment confirmation ({pending.length})</h2>
          {pending.length === 0 && <p className="text-sm text-gray-500">No one is waiting.</p>}
          <ul className="space-y-2">
            {pending.map((e) => (
              <li key={e.id} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <Who e={e} now={now} />
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <p>
                    <strong>Expected: {money(Number(e.amount_due ?? 0))}</strong>
                    {Number(e.discount) > 0 && (
                      <span className="text-gray-600"> (fee {money(Number(e.list_price ?? 0))}, {e.promo_label ?? "discount"} -{money(Number(e.discount))})</span>
                    )}
                  </p>
                  <p className="text-gray-600">Reference: PNEUMA-{e.id.slice(0, 6).toUpperCase()}</p>
                  {e.payment_reported_at ? (
                    <p className="text-green-700">Student says they paid: {e.payment_reference}</p>
                  ) : (
                    <p className="text-gray-500">The student has not said they have paid yet.</p>
                  )}
                </div>
                <Buttons id={e.id} actions={[
                  { label: "Confirm payment", status: "active", primary: true },
                  { label: "Decline", status: "cancelled" },
                ]} />
              </li>
            ))}
          </ul>
        </section>

        {noCohort.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Active, not in a cohort yet ({noCohort.length})</h2>
            <p className="text-sm text-gray-600">
              These students have paid but will not see a schedule until you add them to a <Link href="/admin/cohorts" className="underline">cohort</Link>.
            </p>
            <ul className="space-y-2">
              {noCohort.map((e) => (
                <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-3"><Who e={e} now={now} /></li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Enroll or re-enroll a student</h2>
          <form action={enrollStudent} className="grid gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-2">
            <select name="student_id" required defaultValue="" className={input}>
              <option value="" disabled>Student...</option>
              {(students ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => (
                <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
              ))}
            </select>
            <select name="course_id" required defaultValue="" className={input}>
              <option value="" disabled>Course...</option>
              {(courses ?? []).map((c: { id: string; title: string }) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <label className="text-sm sm:col-span-2">Access ends on (optional)
              <input type="date" name="expires_on" className={`${input} mt-1`} />
            </label>
            <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800 sm:col-span-2">Enroll</button>
          </form>
          <p className="text-xs text-gray-500">Use this for scholarships, cash payments and corrections. It skips the waiting list.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active ({active.length})</h2>
          {active.length === 0 && <p className="text-sm text-gray-500">No active enrollments.</p>}
          <ul className="space-y-2">
            {active.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <Who e={e} now={now} />
                <Buttons id={e.id} actions={[
                  { label: "Pause", status: "paused" },
                  { label: "Mark completed", status: "completed" },
                  { label: "Withdraw", status: "withdrawn" },
                ]} />
              </li>
            ))}
          </ul>
        </section>

        {paused.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Paused ({paused.length})</h2>
            <ul className="space-y-2">
              {paused.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <Who e={e} now={now} />
                  <Buttons id={e.id} actions={[
                    { label: "Resume", status: "active", primary: true },
                    { label: "Withdraw", status: "withdrawn" },
                  ]} />
                </li>
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
