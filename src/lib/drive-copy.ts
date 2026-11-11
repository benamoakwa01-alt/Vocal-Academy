import type { SupabaseClient } from "@supabase/supabase-js";
import { recordingAccessLink } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDriveFile, driveConfigured } from "@/lib/drive";
import { advance, type DriveStore, type JobRow, type RecRow } from "@/lib/drive-advance";

const COLUMNS = "id, class_id, provider, provider_recording_id, status, deleted_at, purged_at, drive_file_id, drive_state, drive_error, drive_updated_at";

// Keeps the copying progress in the database (server key only)
export function supabaseStore(admin: SupabaseClient): DriveStore {
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    async getRecording(id) {
      const { data } = await admin.from("recordings").select(COLUMNS).eq("id", id).maybeSingle();
      return (data ?? null) as RecRow | null;
    },
    async classTitle(classId) {
      const { data } = await admin.from("classes").select("title").eq("id", classId).maybeSingle();
      return data?.title ?? "Lesson";
    },
    async getJob(id) {
      const { data } = await admin.from("recording_drive_jobs").select("*").eq("recording_id", id).maybeSingle();
      return (data ?? null) as JobRow | null;
    },
    // Only one caller can win this, so two people opening the page at once do not start two uploads
    async claimStart(id, nowMs, rules) {
      const stale = iso(nowMs - rules.staleMs);
      const cooldown = iso(nowMs - rules.cooldownMs);
      const { data } = await admin
        .from("recordings")
        .update({ drive_state: "starting", drive_updated_at: iso(nowMs) })
        .eq("id", id)
        .or(
          `drive_state.is.null,and(drive_state.eq.error,drive_updated_at.lt.${cooldown}),` +
          `and(drive_state.in.(starting,uploading),drive_updated_at.lt.${stale})`
        )
        .select("id");
      return !!data && data.length > 0;
    },
    async createJob(job) {
      const { error } = await admin.from("recording_drive_jobs").upsert(job, { onConflict: "recording_id" });
      if (error) throw new Error(`Could not save the upload: ${error.message}`);
    },
    async lockJob(id, nowMs, ttlMs) {
      const { data } = await admin
        .from("recording_drive_jobs")
        .update({ lock_until: iso(nowMs + ttlMs), updated_at: iso(nowMs) })
        .eq("recording_id", id)
        .or(`lock_until.is.null,lock_until.lt.${iso(nowMs)}`)
        .select("*");
      return data && data.length > 0 ? (data[0] as JobRow) : null;
    },
    async saveProgress(id, sent) {
      await admin.from("recording_drive_jobs").update({ bytes_sent: sent, updated_at: new Date().toISOString() }).eq("recording_id", id);
    },
    async unlock(id) {
      await admin.from("recording_drive_jobs").update({ lock_until: null }).eq("recording_id", id);
    },
    async deleteJob(id) {
      await admin.from("recording_drive_jobs").delete().eq("recording_id", id);
    },
    async setState(id, patch, nowMs) {
      await admin.from("recordings").update({ ...patch, drive_updated_at: iso(nowMs) }).eq("id", id);
    },
  };
}

// Used right after a recording is approved, so the fast copy starts at once. Failures are only logged.
export async function startDriveCopy(recordingId: string) {
  try {
    await advance(supabaseStore(createAdminClient()), recordingId, { budgetMs: 25000, link: recordingAccessLink });
  } catch (e) {
    console.error("Drive copy not started:", e instanceof Error ? e.message : e);
  }
}

export type DrivePass = { configured: boolean; advanced: number; ready: number; failed: number; errors: string[] };

// The automatic safety net: moves along every recording that has no fast copy yet
export async function runDrivePass(admin: SupabaseClient, budgetMs = 40000): Promise<DrivePass> {
  const out: DrivePass = { configured: driveConfigured(), advanced: 0, ready: 0, failed: 0, errors: [] };
  if (!out.configured) return out;

  const { data } = await admin
    .from("recordings").select("id")
    .in("status", ["review", "ready"]).is("deleted_at", null).is("purged_at", null)
    .neq("provider", "link")
    .or("drive_state.is.null,drive_state.neq.ready")
    .limit(5);

  const store = supabaseStore(admin);
  const deadline = Date.now() + budgetMs;
  for (const r of (data ?? []) as { id: string }[]) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    try {
      const st = await advance(store, r.id, { budgetMs: left - 3000, link: recordingAccessLink });
      if (st.state === "ready") out.ready += 1;
      else if (st.state === "error") { out.failed += 1; if (out.errors.length < 3 && st.error) out.errors.push(st.error); }
      else out.advanced += 1;
    } catch (e) {
      out.failed += 1;
      if (out.errors.length < 3) out.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

// Called when a recording is deleted for good, so no copy is left behind on Drive
export async function deleteDriveCopy(admin: SupabaseClient, recordingId: string) {
  if (!driveConfigured()) return;
  const { data } = await admin.from("recordings").select("drive_file_id").eq("id", recordingId).maybeSingle();
  if (data?.drive_file_id) await deleteDriveFile(data.drive_file_id);
  await admin.from("recording_drive_jobs").delete().eq("recording_id", recordingId);
  await admin.from("recordings").update({ drive_file_id: null, drive_state: null }).eq("id", recordingId);
}
