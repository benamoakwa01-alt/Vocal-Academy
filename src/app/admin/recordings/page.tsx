import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { syncClassRecordings } from "@/lib/recordings";

type Cls = { id: string; title: string; starts_at: string; ends_at: string };
type Rec = { class_id: string; status: string; duration_seconds: number | null };

function summarise(c: Cls, recs: Rec[], now: number) {
  const mine = recs.filter((r) => r.class_id === c.id);
  const has = (s: string) => mine.find((r) => r.status === s);
  if (has("ready")) return { text: "Ready", cls: "bg-green-100 text-green-800" };
  if (has("review")) return { text: "Needs review", cls: "bg-amber-100 text-amber-800" };
  if (has("processing")) return { text: "Processing", cls: "bg-blue-100 text-blue-800" };
  if (has("failed")) return { text: "Failed", cls: "bg-red-100 text-red-700" };
  if (now > new Date(c.ends_at).getTime() + 15 * 60000) return { text: "No recording found", cls: "bg-red-100 text-red-700" };
  return { text: "Waiting", cls: "bg-gray-100 text-gray-700" };
}

export default async function AdminRecordingsPage() {
  const { supabase } = await requireAdmin();
  const now = getNow();
  const since = new Date(now - 30 * 86400000).toISOString();

  const { data: clsData } = await supabase
    .from("classes").select("id, title, starts_at, ends_at")
    .eq("status", "completed").gte("ends_at", since)
    .order("starts_at", { ascending: false }).limit(40);
  const all = (clsData ?? []) as Cls[];
  const ids = all.map((c) => c.id);

  // Only classes that actually opened a classroom can have a recording.
  const { data: sessions } = ids.length
    ? await supabase.from("live_sessions").select("class_id").in("class_id", ids).not("room_name", "is", null)
    : { data: [] };
  const held = new Set((sessions ?? []).map((s: { class_id: string }) => s.class_id));
  const classes = all.filter((c) => held.has(c.id));

  async function loadRecs() {
    if (!classes.length) return [] as Rec[];
    const { data } = await supabase
      .from("recordings").select("class_id, status, duration_seconds")
      .in("class_id", classes.map((c) => c.id));
    return (data ?? []) as Rec[];
  }

  let recs = await loadRecs();
  const needsSync = classes
    .filter((c) => !recs.some((r) => r.class_id === c.id && (r.status === "ready" || r.status === "review")))
    .slice(0, 10);
  if (needsSync.length) {
    await Promise.all(needsSync.map((c) => syncClassRecordings(supabase, c.id)));
    recs = await loadRecs();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Recordings</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>
        <p className="text-sm text-gray-600">Lessons held in the last 30 days. Anything red or amber needs your attention.</p>

        {classes.length === 0 && <p className="text-sm text-gray-500">No completed lessons yet.</p>}
        <ul className="space-y-2">
          {classes.map((c) => {
            const s = summarise(c, recs, now);
            return (
              <li key={c.id}>
                <Link href={`/classes/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-gray-600">{new Date(c.starts_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
