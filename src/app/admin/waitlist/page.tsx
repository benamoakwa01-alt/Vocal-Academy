import { requireAdmin } from "@/lib/session";
import ConfirmButton from "@/components/ConfirmButton";
import LocalTime from "@/components/LocalTime";
import { PageHeader, Panel, StatCard, btnSecondary } from "@/components/ui";
import { INSTRUMENTS } from "@/lib/waitlist";
import { removeEntry } from "./actions";

type Row = { id: string; email: string; name: string | null; interests: string[]; other: string | null; created_at: string };

export default async function WaitlistPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("waitlist").select("id, email, name, interests, other, created_at").order("created_at", { ascending: false }).limit(1000);
  const rows = (data ?? []) as Row[];
  const count = (i: string) => rows.filter((r) => r.interests.includes(i)).length;
  const others = rows.filter((r) => r.other).length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Instrument waitlist" description="People who want to hear when instrument lessons open."
        actions={<a href="/admin/waitlist/export" className={btnSecondary}>Download CSV</a>} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load the waitlist: {error.message}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="On the waitlist" value={rows.length} href="/admin/waitlist" />
        {INSTRUMENTS.map((i) => <StatCard key={i} label={i} value={count(i)} href="/admin/waitlist" />)}
        <StatCard label="Something else" value={others} href="/admin/waitlist" />
      </div>

      <Panel title="Sign-ups">
        {rows.length === 0 ? (
          <p className="text-sm text-[#647084]">No one has joined yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#17253B]">{r.name ?? r.email}</p>
                  {r.name && <p className="truncate text-[#647084]">{r.email}</p>}
                  <p className="text-xs text-[#647084]">
                    {[...r.interests, r.other ? `Other: ${r.other}` : ""].filter(Boolean).join(", ") || "No instrument chosen"} · <LocalTime iso={r.created_at} />
                  </p>
                </div>
                <form action={removeEntry}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton label="Remove" message="Remove this person from the waitlist?" className="text-sm text-red-600 underline" />
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
