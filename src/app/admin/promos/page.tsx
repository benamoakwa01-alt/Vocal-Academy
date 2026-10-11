import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { money } from "@/lib/pricing";
import ConfirmButton from "@/components/ConfirmButton";
import { createPromo, deletePromo, togglePromo } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

type P = {
  id: string; code: string; description: string | null; discount_type: string; amount: number;
  course_id: string | null; auto_apply: boolean; active: boolean;
  starts_at: string | null; expires_at: string | null; max_uses: number | null;
};

export default async function PromosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: pData } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
  const promos = (pData ?? []) as P[];
  const { data: cData } = await supabase.from("courses").select("id, title").order("title");
  const courses = (cData ?? []) as { id: string; title: string }[];
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));

  const { data: uData } = await supabase
    .from("enrollments").select("promo_code_id, status").not("promo_code_id", "is", null);
  const uses = new Map<string, number>();
  for (const u of (uData ?? []) as { promo_code_id: string; status: string }[]) {
    if (["pending", "active", "paused", "completed"].includes(u.status)) {
      uses.set(u.promo_code_id, (uses.get(u.promo_code_id) ?? 0) + 1);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Promos and discounts</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <ul className="space-y-2">
          {promos.length === 0 && <p className="text-sm text-gray-500">No promos yet.</p>}
          {promos.map((p) => (
            <li key={p.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {p.code}{" "}
                    <span className="text-sm font-normal text-gray-600">
                      {p.discount_type === "percent" ? `${p.amount}% off` : `${money(Number(p.amount))} off`}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {p.course_id ? titleOf.get(p.course_id) : "All courses"}
                    {p.auto_apply ? " · applies automatically" : " · needs the code"}
                    {p.description ? ` · ${p.description}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.starts_at ? `From ${new Date(p.starts_at).toLocaleDateString()}` : "No start date"}
                    {p.expires_at ? ` until ${new Date(p.expires_at).toLocaleDateString()}` : ", no end date"}
                    {" · "}Used {uses.get(p.id) ?? 0}{p.max_uses ? ` of ${p.max_uses}` : ""} times
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                  {p.active ? "Active" : "Off"}
                </span>
              </div>
              <div className="flex gap-3">
                <form action={togglePromo}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                    {p.active ? "Turn off" : "Turn on"}
                  </button>
                </form>
                <form action={deletePromo}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton label="Delete" message="Delete this promo? Students who already used it keep their discount."
                    className="text-sm text-red-600 underline" />
                </form>
              </div>
            </li>
          ))}
        </ul>

        <form action={createPromo} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Create a promo or discount</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Code
              <input name="code" required placeholder="EARLYBIRD" className={`${input} mt-1 uppercase`} />
            </label>
            <label className="block text-sm">Label shown to students
              <input name="description" placeholder="Early bird offer" className={`${input} mt-1`} />
            </label>
            <label className="block text-sm">Type
              <select name="discount_type" defaultValue="percent" className={`${input} mt-1`}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off (GHS)</option>
              </select>
            </label>
            <label className="block text-sm">Amount
              <input name="amount" type="number" step="0.01" min="0.01" required placeholder="20" className={`${input} mt-1`} />
            </label>
            <label className="block text-sm sm:col-span-2">Applies to
              <select name="course_id" defaultValue="" className={`${input} mt-1`}>
                <option value="">All courses</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block text-sm">Starts on (optional)
              <input name="starts_on" type="date" className={`${input} mt-1`} />
            </label>
            <label className="block text-sm">Ends on (optional)
              <input name="expires_on" type="date" className={`${input} mt-1`} />
            </label>
            <label className="block text-sm">Maximum uses (optional)
              <input name="max_uses" type="number" min="1" className={`${input} mt-1`} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="auto_apply" />
            Apply automatically to everyone (a sale), with no code needed
          </label>
          {error && (
            <p className="text-sm text-red-600">
              {error === "exists" ? "That code already exists." : "Please check the values. A percentage cannot be over 100."}
            </p>
          )}
          <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Create promo</button>
        </form>
      </div>
    </main>
  );
}
