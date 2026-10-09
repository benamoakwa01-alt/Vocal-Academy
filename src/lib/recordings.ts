import type { SupabaseClient } from "@supabase/supabase-js";
import { listRoomRecordings } from "@/lib/daily";

// A recording outside this range of the scheduled length is flagged for a human to review.
const MIN_RATIO = 0.85;
const MAX_RATIO = 1.6;

export type RecordingStatus = "processing" | "ready" | "review" | "failed";

export function classify(
  status: "finished" | "in-progress" | "canceled",
  duration: number | null,
  expected: number
): RecordingStatus {
  if (status === "in-progress") return "processing";
  if (status === "canceled") return "failed";
  if (duration === null || duration <= 0) return "review";
  const ratio = duration / expected;
  return ratio >= MIN_RATIO && ratio <= MAX_RATIO ? "ready" : "review";
}

// Asks Daily for this class's recordings and saves them. Safe to run repeatedly.
export async function syncClassRecordings(supabase: SupabaseClient, classId: string) {
  try {
    const { data: cls } = await supabase
      .from("classes").select("starts_at, ends_at").eq("id", classId).maybeSingle();
    const { data: session } = await supabase
      .from("live_sessions").select("room_name").eq("class_id", classId).maybeSingle();
    if (!cls || !session?.room_name) return { ok: false as const, reason: "no-room" };

    const expected = Math.max(
      1,
      Math.round((new Date(cls.ends_at).getTime() - new Date(cls.starts_at).getTime()) / 1000)
    );

    const recs = await listRoomRecordings(session.room_name);

    const { data: existing } = await supabase
      .from("recordings").select("provider_recording_id, status").eq("class_id", classId);
    const have = new Map(
      (existing ?? []).map((r: { provider_recording_id: string; status: string }) => [r.provider_recording_id, r.status])
    );

    // Never overwrite a recording that has already been approved as ready.
    const rows = recs
      .filter((r) => have.get(r.id) !== "ready")
      .map((r) => ({
        class_id: classId,
        provider: "daily",
        provider_recording_id: r.id,
        status: classify(r.status, r.duration ?? null, expected),
        started_at: new Date(r.start_ts * 1000).toISOString(),
        duration_seconds: r.duration ?? null,
        expected_seconds: expected,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length) {
      const { error } = await supabase.from("recordings").upsert(rows, { onConflict: "provider_recording_id" });
      if (error) {
        console.error("recordings upsert failed:", error);
        return { ok: false as const, reason: "db" };
      }
    }
    return { ok: true as const, found: recs.length };
  } catch (e) {
    console.error("syncClassRecordings failed:", e);
    return { ok: false as const, reason: "provider" };
  }
}
