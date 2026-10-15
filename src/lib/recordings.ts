import type { SupabaseClient } from "@supabase/supabase-js";
import { listRoomRecordings } from "@/lib/daily";

export type RecordingStatus = "processing" | "ready" | "review" | "failed";

// Every finished recording waits for approval ("review"). Only "ready" is visible to students.
export function classify(status: "finished" | "in-progress" | "canceled"): RecordingStatus {
  if (status === "in-progress") return "processing";
  if (status === "canceled") return "failed";
  return "review";
}

export type SyncResult =
  | { ok: true; found: number }
  | { ok: false; reason: "no-room" | "provider" | "db"; detail: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Asks Daily for this class's recordings and saves them. Safe to run repeatedly.
export async function syncClassRecordings(supabase: SupabaseClient, classId: string): Promise<SyncResult> {
  try {
    const { data: cls } = await supabase
      .from("classes").select("starts_at, ends_at").eq("id", classId).maybeSingle();
    const { data: session } = await supabase
      .from("live_sessions").select("room_name").eq("class_id", classId).maybeSingle();
    if (!cls || !session?.room_name) {
      return { ok: false, reason: "no-room", detail: "This class has no classroom on record." };
    }

    const expected = Math.max(
      1,
      Math.round((new Date(cls.ends_at).getTime() - new Date(cls.starts_at).getTime()) / 1000)
    );

    let recs;
    try {
      recs = await listRoomRecordings(session.room_name);
    } catch (e) {
      console.error("listRoomRecordings failed:", e);
      return { ok: false, reason: "provider", detail: message(e) };
    }

    const { data: existing } = await supabase
      .from("recordings").select("provider_recording_id, status").eq("class_id", classId);
    const have = new Map(
      (existing ?? []).map((r: { provider_recording_id: string; status: string }) => [r.provider_recording_id, r.status])
    );

    // A recording that has already been approved is never changed by a check.
    const now = new Date().toISOString();
    const rows = recs
      .filter((r) => have.get(r.id) !== "ready")
      .map((r) => ({
        class_id: classId,
        provider: "daily",
        provider_recording_id: r.id,
        status: classify(r.status),
        started_at: Number.isFinite(r.start_ts) ? new Date(r.start_ts * 1000).toISOString() : null,
        duration_seconds: typeof r.duration === "number" ? Math.round(r.duration) : null,
        expected_seconds: expected,
        updated_at: now,
      }));

    if (rows.length) {
      let { error } = await supabase.from("recordings").upsert(rows, { onConflict: "provider_recording_id" });
      if (error) {
        console.error("recordings upsert failed, retrying with essential fields:", error);
        const slim = rows.map((r) => ({
          class_id: r.class_id, provider: r.provider, provider_recording_id: r.provider_recording_id, status: r.status,
        }));
        ({ error } = await supabase.from("recordings").upsert(slim, { onConflict: "provider_recording_id" }));
      }
      if (error) return { ok: false, reason: "db", detail: error.message };
    }
    return { ok: true, found: recs.length };
  } catch (e) {
    console.error("syncClassRecordings failed:", e);
    return { ok: false, reason: "provider", detail: message(e) };
  }
}
