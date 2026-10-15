import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClassRecordings } from "@/lib/recordings";
import { approveRecording, hideRecording, refreshRecordings } from "@/app/classes/recording-actions";
import { Panel, btnPrimary, btnSecondary } from "@/components/ui";

type Row = { id: string; status: string; duration_seconds: number | null; expected_seconds: number | null };

const len = (s: number | null) => {
  if (s === null) return "unknown length";
  return s < 120 ? `${s} sec` : `${Math.round(s / 60)} min`;
};

const label: Record<string, string> = {
  ready: "Published to students",
  review: "Waiting for approval",
  processing: "Processing",
  failed: "Failed",
};

export default async function RecordingsPanel({
  supabase, classId, classStatus, endsAt, now, canManage,
}: {
  supabase: SupabaseClient;
  classId: string;
  classStatus: string;
  endsAt: string;
  now: number;
  canManage: boolean;
  isAdmin?: boolean;
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
  let failure: string | null = null;
  if (canManage && (rows.length === 0 || rows.some((r) => r.status !== "ready"))) {
    const res = await syncClassRecordings(supabase, classId);
    if (!res.ok) failure = res.detail;
    rows = await load();
  }

  const missing = canManage && rows.length === 0 && !failure && now > new Date(endsAt).getTime() + 15 * 60000;

  return (
    <Panel title="Recording">
      <div className="space-y-3">
        {rows.length === 0 && !canManage && (
          <p className="text-sm text-[#647084]">The recording is not available yet. Please check back soon.</p>
        )}

        {failure && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Could not check for the recording: {failure}
          </p>
        )}
        {missing && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            No recording was found for this lesson. If the tutor did not press Record, it cannot be recovered.
          </p>
        )}
        {canManage && rows.length === 0 && !missing && !failure && (
          <p className="text-sm text-[#647084]">No recording yet. It can take a few minutes after the lesson ends.</p>
        )}

        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#17253B]">
                  Lesson recording · {len(r.duration_seconds)}
                  {canManage && <span className="ml-2 text-xs font-normal text-[#647084]">{label[r.status] ?? r.status}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(r.status === "ready" || (canManage && r.status === "review")) && (
                    <Link href={`/classes/${classId}/recordings/${r.id}`} className={`${btnPrimary} h-9`}>Watch</Link>
                  )}
                  {canManage && r.status === "review" && (
                    <form action={approveRecording}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="class_id" value={classId} />
                      <button className="inline-flex h-9 items-center rounded-lg bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700">
                        Approve for students
                      </button>
                    </form>
                  )}
                  {canManage && r.status === "ready" && (
                    <form action={hideRecording}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="class_id" value={classId} />
                      <button className={`${btnSecondary} h-9`}>Hide from students</button>
                    </form>
                  )}
                </div>
              </div>
              {canManage && r.status === "review" && (
                <p className="text-xs text-amber-700">
                  Students cannot see this until you approve it.
                  {r.expected_seconds !== null && ` The class was scheduled for ${len(r.expected_seconds)}.`}
                </p>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <form action={refreshRecordings}>
            <input type="hidden" name="class_id" value={classId} />
            <button className="text-sm font-medium text-[#101B2D] underline">Check for recording</button>
          </form>
        )}
      </div>
    </Panel>
  );
}
