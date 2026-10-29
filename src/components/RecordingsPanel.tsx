import Link from "next/link";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClassRecordings } from "@/lib/recordings";
import { purgeDate } from "@/lib/retention";
import {
  approveRecording, hideRecording, keepRecording, refreshRecordings, restoreRecording, trashRecording,
} from "@/app/classes/recording-actions";
import ConfirmButton from "@/components/ConfirmButton";
import { Panel, btnPrimary, btnSecondary } from "@/components/ui";

type Row = {
  id: string; status: string; duration_seconds: number | null; expected_seconds: number | null;
  expires_at: string | null; deleted_at: string | null; purged_at: string | null; keep: boolean;
};

const len = (s: number | null) => {
  if (s === null) return "unknown length";
  return s < 120 ? `${s} sec` : `${Math.round(s / 60)} min`;
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const label: Record<string, string> = {
  ready: "Published to students", review: "Waiting for approval", processing: "Processing", failed: "Failed",
};
const mini = "inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50";

function Act({ action, id, classId, children, extra }: { action: (f: FormData) => Promise<void>; id: string; classId: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="class_id" value={classId} />
      {extra}
      {children}
    </form>
  );
}

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
      .select("id, status, duration_seconds, expected_seconds, expires_at, deleted_at, purged_at, keep")
      .eq("class_id", classId)
      .order("started_at", { ascending: true });
    return (data ?? []) as Row[];
  }

  let rows = await load();
  let failure: string | null = null;
  if (canManage && (rows.length === 0 || rows.some((r) => r.status === "processing"))) {
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
        {failure && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not check for the recording: {failure}</p>}
        {missing && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            No recording was found for this lesson. If the tutor did not press Record, it cannot be recovered.
          </p>
        )}
        {canManage && rows.length === 0 && !missing && !failure && (
          <p className="text-sm text-[#647084]">No recording yet. It can take a few minutes after the lesson ends.</p>
        )}

        <ul className="space-y-2">
          {rows.map((r) => {
            const trashed = !!r.deleted_at && !r.purged_at;
            const gone = !!r.purged_at;
            return (
              <li key={r.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#17253B]">
                    Lesson recording · {len(r.duration_seconds)}
                    {canManage && <span className="ml-2 text-xs font-normal text-[#647084]">{gone ? "Deleted" : trashed ? "In the trash" : label[r.status] ?? r.status}</span>}
                  </p>
                  {!gone && (
                    <div className="flex flex-wrap items-center gap-2">
                      {(r.status === "ready" || (canManage && (r.status === "review" || trashed))) && (
                        <Link href={`/classes/${classId}/recordings/${r.id}`} className={`${btnPrimary} h-9`}>Watch</Link>
                      )}
                      {canManage && !trashed && r.status === "review" && (
                        <Act action={approveRecording} id={r.id} classId={classId}>
                          <button className="inline-flex h-9 items-center rounded-lg bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700">Approve for students</button>
                        </Act>
                      )}
                      {canManage && !trashed && r.status === "ready" && (
                        <Act action={hideRecording} id={r.id} classId={classId}><button className={`${btnSecondary} h-9`}>Hide from students</button></Act>
                      )}
                    </div>
                  )}
                </div>

                {!canManage && r.expires_at && !trashed && !gone && (
                  <p className="text-xs text-[#647084]">Available until {day(r.expires_at)}.</p>
                )}
                {canManage && r.status === "review" && !trashed && !gone && (
                  <p className="text-xs text-amber-700">
                    Students cannot see this until you approve it.
                    {r.expected_seconds !== null && ` The class was scheduled for ${len(r.expected_seconds)}.`}
                  </p>
                )}

                {canManage && gone && <p className="text-xs text-[#647084]">Deleted on {day(r.purged_at as string)}. It cannot be recovered.</p>}
                {canManage && trashed && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-amber-700">In the trash. It will be deleted for good on {day(purgeDate(r.deleted_at as string))}.</p>
                    <Act action={restoreRecording} id={r.id} classId={classId}><button className={mini}>Restore and keep</button></Act>
                  </div>
                )}
                {canManage && !trashed && !gone && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#647084]">
                      {r.keep ? "On hold: this recording is never deleted automatically."
                        : r.expires_at ? `Students can watch until ${day(r.expires_at)}, then it moves to the trash.`
                        : "No deletion date yet. The clock starts when the cohort finishes, if the course has a retention period."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Act action={keepRecording} id={r.id} classId={classId} extra={<input type="hidden" name="on" value={r.keep ? "false" : "true"} />}>
                        <button className={mini}>{r.keep ? "Remove hold" : "Keep"}</button>
                      </Act>
                      <Act action={trashRecording} id={r.id} classId={classId}>
                        <ConfirmButton label="Move to trash" message="Move this recording to the trash? Students lose access now. You can restore it for 14 days."
                          className="text-sm text-red-600 underline" />
                      </Act>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
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
