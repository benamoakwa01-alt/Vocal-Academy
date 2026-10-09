import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClassRecordings } from "@/lib/recordings";
import { approveRecording, refreshRecordings } from "@/app/classes/recording-actions";

type Row = { id: string; status: string; duration_seconds: number | null; expected_seconds: number | null };

const mins = (s: number | null) => (s === null ? "?" : `${Math.round(s / 60)} min`);

const label: Record<string, string> = {
  ready: "Ready",
  review: "Needs review",
  processing: "Processing",
  failed: "Failed",
};

export default async function RecordingsPanel({
  supabase, classId, classStatus, endsAt, now, canManage, isAdmin,
}: {
  supabase: SupabaseClient;
  classId: string;
  classStatus: string;
  endsAt: string;
  now: number;
  canManage: boolean;
  isAdmin: boolean;
}) {
  if (classStatus !== "completed") return null;

  async function load() {
    const { data } = await supabase
      .from("recordings")
      .select("id, status, duration_seconds, expected_seconds")
      .eq("class_id", classId)
      .order("started_at", { ascending: true });
    return (data ?? []) as Row[];
  }

  let rows = await load();
  if (canManage && (rows.length === 0 || rows.some((r) => r.status === "processing"))) {
    await syncClassRecordings(supabase, classId);
    rows = await load();
  }

  const missing = canManage && rows.length === 0 && now > new Date(endsAt).getTime() + 15 * 60000;

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold">Recording</h2>

      {rows.length === 0 && !canManage && (
        <p className="text-sm text-gray-600">The recording isn&apos;t available yet. Please check back soon.</p>
      )}

      {missing && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          No recording was found for this lesson. If the tutor didn&apos;t press Record, it can&apos;t be recovered.
        </p>
      )}
      {canManage && rows.length === 0 && !missing && (
        <p className="text-sm text-gray-600">No recording yet. It can take a few minutes after the lesson ends.</p>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium">
                Lesson recording · {mins(r.duration_seconds)}
                {canManage && <span className="ml-2 text-xs text-gray-500">{label[r.status] ?? r.status}</span>}
              </p>
              {canManage && r.status === "review" && (
                <p className="text-xs text-amber-700">
                  Recorded {mins(r.duration_seconds)} of a scheduled {mins(r.expected_seconds)}. Watch it before approving.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(r.status === "ready" || (canManage && r.status === "review")) && (
                <Link href={`/classes/${classId}/recordings/${r.id}`}
                  className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800">
                  Watch
                </Link>
              )}
              {isAdmin && r.status === "review" && (
                <form action={approveRecording}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="class_id" value={classId} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Approve</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage && (
        <form action={refreshRecordings}>
          <input type="hidden" name="class_id" value={classId} />
          <button className="text-sm underline">Check for recording</button>
        </form>
      )}
    </section>
  );
}
