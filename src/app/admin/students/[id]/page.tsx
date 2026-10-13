import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { enrollmentLabel } from "@/lib/enrollment";
import { money } from "@/lib/pricing";
import { PageHeader, Panel, btnSecondary } from "@/components/ui";

type Enr = {
  id: string; status: string; starts_at: string | null; expires_at: string | null; created_at: string;
  list_price: number | null; discount: number | null; amount_due: number | null; promo_label: string | null;
  payment_reference: string | null; payment_reported_at: string | null; payment_confirmed_at: string | null;
  courses: { title: string; slug: string } | null;
  cohorts: { name: string } | null;
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: p } = await supabase
    .from("profiles").select("id, full_name, email, role, approved, created_at, recording_consent_at")
    .eq("id", id).maybeSingle();
  if (!p) notFound();

  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, starts_at, expires_at, created_at, list_price, discount, amount_due, promo_label, payment_reference, payment_reported_at, payment_confirmed_at, courses(title, slug), cohorts(name)")
    .eq("student_id", id).order("created_at", { ascending: false });
  const enrollments = (data ?? []) as unknown as Enr[];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Link href="/admin/students" className="text-sm font-medium text-[#101B2D] underline">All students</Link>
      <PageHeader title={p.full_name ?? "No name"} description={p.email ?? undefined}
        actions={<Link href={`/admin/enrollments?q=${encodeURIComponent(p.email ?? "")}`} className={btnSecondary}>Manage enrollments</Link>} />

      <Panel title="Account">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[#647084]">Role</dt><dd className="font-medium capitalize text-[#17253B]">{p.role}</dd></div>
          <div><dt className="text-[#647084]">Account status</dt><dd className="font-medium text-[#17253B]">{p.approved ? "Active" : "On hold"}</dd></div>
          <div><dt className="text-[#647084]">Joined</dt><dd className="font-medium text-[#17253B]">{date(p.created_at)}</dd></div>
          <div><dt className="text-[#647084]">Accepted the recording notice</dt><dd className="font-medium text-[#17253B]">{p.recording_consent_at ? date(p.recording_consent_at) : "Not recorded"}</dd></div>
        </dl>
      </Panel>

      <Panel title={`Enrollments (${enrollments.length})`}>
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load enrollments: {error.message}</p>}
        {enrollments.length === 0 ? (
          <p className="text-sm text-[#647084]">Not enrolled in any course.</p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((e) => (
              <li key={e.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#101B2D]">{e.courses?.title ?? "Course"}</p>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-[#17253B]">{enrollmentLabel(e.status)}</span>
                </div>
                <dl className="mt-2 grid gap-1 text-[#647084] sm:grid-cols-2">
                  <div>Cohort: <span className="text-[#17253B]">{e.cohorts?.name ?? "None yet"}</span></div>
                  <div>Requested: <span className="text-[#17253B]">{date(e.created_at)}</span></div>
                  <div>Fee: <span className="text-[#17253B]">{e.list_price !== null ? money(Number(e.list_price)) : "-"}</span>
                    {Number(e.discount) > 0 && <> (discount {money(Number(e.discount))}{e.promo_label ? `, ${e.promo_label}` : ""})</>}</div>
                  <div>Amount due: <span className="text-[#17253B]">{e.amount_due !== null ? money(Number(e.amount_due)) : "-"}</span></div>
                  <div>Payment reported: <span className="text-[#17253B]">{e.payment_reported_at ? `${date(e.payment_reported_at)} (${e.payment_reference ?? ""})` : "-"}</span></div>
                  <div>Payment confirmed: <span className="text-[#17253B]">{date(e.payment_confirmed_at)}</span></div>
                  <div>Access: <span className="text-[#17253B]">{date(e.starts_at)} to {e.expires_at ? date(e.expires_at) : "no end date"}</span></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
