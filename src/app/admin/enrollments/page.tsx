import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { enrollmentLabel } from "@/lib/enrollment";
import { money } from "@/lib/pricing";
import { PageHeader, btnPrimary, btnSecondary } from "@/components/ui";
import { enrollStudent, setEnrollmentStatus } from "./actions";

type Row = {
  id: string;
  student_id: string;
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
  courses: { id: string; title: string } | null;
};

type Action = { label: string; status: string; primary?: boolean };
const STATUSES = ["pending", "active", "paused", "completed", "expired", "withdrawn", "cancelled"];
const input = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";

function Buttons({ id, actions }: { id: string; actions: Action[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <form key={a.status} action={setEnrollmentStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={a.status} />
          <button className={a.primary
            ? "inline-flex h-9 items-center rounded-lg bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
            : "inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"}>
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
    <div className="min-w-0">
      <Link href={`/admin/students/${e.student_id}`} className="font-medium text-[#101B2D] underline-offset-2 hover:underline">
        {e.profiles?.full_name ?? "No name"}
      </Link>
      <p className="truncate text-sm text-[#647084]">{e.profiles?.email} · {e.courses?.title}</p>
      {e.expires_at && (
        <p className={`text-xs ${lapsed ? "text-red-600" : "text-[#647084]"}`}>
          {lapsed ? "Access ended " : "Access until "}{new Date(e.expires_at).toLocaleDateString("en-GB")}
        </p>
      )}
    </div>
  );
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; course?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const { supabase } = await requireAdmin();
  const now = getNow();

  // "profiles!student_id" says which link to follow, because an enrollment is connected to
  // two people: the student, and the admin who confirmed the payment.
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, status, expires_at, cohort_id, created_at, list_price, discount, amount_due, promo_label, payment_reference, payment_reported_at, profiles!student_id(full_name, email), courses(id, title)")
    .order("created_at", { ascending: false });
  const all = (data ?? []) as unknown as Row[];

  const rows = all.filter((e) =>
    (!sp.course || e.courses?.id === sp.course) &&
    (!sp.status || e.status === sp.status) &&
    (!q || `${e.profiles?.full_name ?? ""} ${e.profiles?.email ?? ""} ${e.courses?.title ?? ""}`.toLowerCase().includes(q))
  );

  const { data: students } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "student").order("full_name").limit(500);
  const { data: courses } = await supabase.from("courses").select("id, title").order("title");

  const pending = rows.filter((r) => r.status === "pending");
  const noCohort = rows.filter((r) => r.status === "active" && !r.cohort_id);
  const active = rows.filter((r) => r.status === "active");
  const paused = rows.filter((r) => r.status === "paused");
  const closed = rows.filter((r) => ["completed", "expired", "withdrawn", "cancelled"].includes(r.status));
  const filtered = !!(q || sp.course || sp.status);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <PageHeader title="Enrollments" description="Confirm payments and manage who is enrolled in what."
        actions={<Link href="/admin/students" className={btnSecondary}>All students</Link>} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Could not load enrollments: {error.message}
        </p>
      )}

      <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block text-sm sm:col-span-2">Search
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Student name, email or course" className={`${input} mt-1`} />
        </label>
        <label className="block text-sm">Course
          <select name="course" defaultValue={sp.course ?? ""} className={`${input} mt-1`}>
            <option value="">All courses</option>
            {(courses ?? []).map((c: { id: string; title: string }) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="block text-sm">Status
          <select name="status" defaultValue={sp.status ?? ""} className={`${input} mt-1`}>
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{enrollmentLabel(s)}</option>)}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-4">
          <button className={btnPrimary}>Apply filters</button>
          {filtered && <Link href="/admin/enrollments" className={btnSecondary}>Clear</Link>}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#101B2D]">Waiting for payment confirmation ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-[#647084]">No one is waiting{filtered ? " with these filters" : ""}.</p>}
        <ul className="space-y-3">
          {pending.map((e) => (
            <li key={e.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <Who e={e} now={now} />
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p>
                  <strong>Expected: {money(Number(e.amount_due ?? 0))}</strong>
                  {Number(e.discount) > 0 && (
                    <span className="text-[#647084]"> (fee {money(Number(e.list_price ?? 0))}, {e.promo_label ?? "discount"} -{money(Number(e.discount))})</span>
                  )}
                </p>
                <p className="text-[#647084]">Reference: PNEUMA-{e.id.slice(0, 6).toUpperCase()}</p>
                {e.payment_reported_at ? (
                  <p className="text-green-700">Student says they paid: {e.payment_reference}</p>
                ) : (
                  <p className="text-[#647084]">The student has not said they have paid yet.</p>
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
          <h2 className="text-lg font-semibold text-[#101B2D]">Active, not in a cohort yet ({noCohort.length})</h2>
          <p className="text-sm text-[#647084]">
            These students have paid but will not see a schedule until you add them to a <Link href="/admin/cohorts" className="underline">cohort</Link>.
          </p>
          <ul className="space-y-2">
            {noCohort.map((e) => (
              <li key={e.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><Who e={e} now={now} /></li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#101B2D]">Enroll or re-enroll a student</h2>
        <form action={enrollStudent} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <select name="student_id" required defaultValue="" aria-label="Student" className={input}>
            <option value="" disabled>Student...</option>
            {(students ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => (
              <option key={s.id} value={s.id}>{s.full_name ?? s.email}{s.full_name && s.email ? ` (${s.email})` : ""}</option>
            ))}
          </select>
          <select name="course_id" required defaultValue="" aria-label="Course" className={input}>
            <option value="" disabled>Course...</option>
            {(courses ?? []).map((c: { id: string; title: string }) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <label className="text-sm sm:col-span-2">Access ends on (optional)
            <input type="date" name="expires_on" className={`${input} mt-1`} />
          </label>
          <button className={`${btnPrimary} sm:col-span-2`}>Enroll</button>
        </form>
        <p className="text-xs text-[#647084]">Use this for scholarships, cash payments and corrections. It skips the waiting list.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#101B2D]">Active ({active.length})</h2>
        {active.length === 0 && <p className="text-sm text-[#647084]">No active enrollments{filtered ? " with these filters" : ""}.</p>}
        <ul className="space-y-2">
          {active.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
          <h2 className="text-lg font-semibold text-[#101B2D]">Paused ({paused.length})</h2>
          <ul className="space-y-2">
            {paused.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#101B2D]">Closed ({closed.length})</summary>
          <ul className="mt-3 space-y-2">
            {closed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/admin/students/${e.student_id}`} className="underline-offset-2 hover:underline">
                  {e.profiles?.full_name ?? e.profiles?.email} · {e.courses?.title}
                </Link>
                <span className="text-[#647084]">{enrollmentLabel(e.status)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
