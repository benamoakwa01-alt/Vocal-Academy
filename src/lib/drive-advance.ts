import { CHUNK, DriveError, driveConfigured, ensureFolder, getFileInfo, makeViewable, putChunk, queryStatus, startResumable } from "./drive";
import { copyChunks, readRange, sizeOf } from "./drive-copy-core";

// Moves one recording's copy to Google Drive a step forward. Safe to call again and again, from several places at once.

export type RecRow = {
  id: string; class_id: string; provider: string | null; provider_recording_id: string; status: string;
  deleted_at: string | null; purged_at: string | null;
  drive_file_id: string | null; drive_state: string | null; drive_error: string | null; drive_updated_at: string | null;
};
export type JobRow = { recording_id: string; session_uri: string; total_bytes: number; bytes_sent: number; lock_until: string | null };

// Where progress is kept. The real one uses the database. Tests use memory.
export interface DriveStore {
  getRecording(id: string): Promise<RecRow | null>;
  classTitle(classId: string): Promise<string>;
  getJob(id: string): Promise<JobRow | null>;
  claimStart(id: string, nowMs: number, rules: { staleMs: number; cooldownMs: number }): Promise<boolean>;
  createJob(job: JobRow): Promise<void>;
  lockJob(id: string, nowMs: number, ttlMs: number): Promise<JobRow | null>;
  saveProgress(id: string, sent: number): Promise<void>;
  unlock(id: string): Promise<void>;
  deleteJob(id: string): Promise<void>;
  setState(id: string, patch: { drive_state?: string | null; drive_file_id?: string | null; drive_error?: string | null }, nowMs: number): Promise<void>;
}

export type DriveState = "off" | "skipped" | "starting" | "uploading" | "processing" | "ready" | "error";
export type DriveStatus = { state: DriveState; percent: number; error?: string };

const LOCK_MS = 90_000;                 // one worker at a time; the lock frees itself if the worker dies
const START_STALE_MS = 5 * 60_000;
const ERROR_COOLDOWN_MS = 2 * 60_000;
const PROCESSING_GIVE_UP_MS = 30 * 60_000;

const pct = (job: JobRow) => (job.total_bytes > 0 ? Math.min(99, Math.floor((job.bytes_sent / job.total_bytes) * 100)) : 0);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function advance(
  store: DriveStore, id: string,
  opts: { budgetMs: number; link: (providerRecordingId: string) => Promise<string>; now?: () => number; chunk?: number }
): Promise<DriveStatus> {
  const now = opts.now ?? Date.now;
  if (!driveConfigured()) return { state: "off", percent: 0 };

  const rec = await store.getRecording(id);
  if (!rec || rec.purged_at || rec.deleted_at || rec.provider === "link" || (rec.status !== "review" && rec.status !== "ready")) {
    return { state: "skipped", percent: 0 };
  }
  if (rec.drive_state === "ready") return { state: "ready", percent: 100 };

  try {
    // The video is on Drive. Wait for Drive to finish preparing it for streaming.
    if (rec.drive_file_id && rec.drive_state === "processing") {
      const info = await getFileInfo(rec.drive_file_id);
      if (!info.exists) {
        await store.setState(id, { drive_state: null, drive_file_id: null, drive_error: "The Drive copy was removed, so it will be made again." }, now());
        return { state: "starting", percent: 0 };
      }
      if (info.ready) {
        await store.setState(id, { drive_state: "ready", drive_error: null }, now());
        await store.deleteJob(id);
        return { state: "ready", percent: 100 };
      }
      const since = rec.drive_updated_at ? now() - Date.parse(rec.drive_updated_at) : 0;
      if (since > PROCESSING_GIVE_UP_MS) {
        await store.setState(id, { drive_state: "error", drive_error: "Drive did not finish preparing the video." }, now());
        return { state: "error", percent: 100, error: "Drive did not finish preparing the video." };
      }
      return { state: "processing", percent: 100 };
    }

    const link = await opts.link(rec.provider_recording_id);
    let job = await store.getJob(id);

    if (!job) {
      const mine = await store.claimStart(id, now(), { staleMs: START_STALE_MS, cooldownMs: ERROR_COOLDOWN_MS });
      if (!mine) {
        return rec.drive_state === "error"
          ? { state: "error", percent: 0, error: rec.drive_error ?? undefined }
          : { state: "starting", percent: 0 };
      }
      const total = await sizeOf(link);
      const folder = await ensureFolder();
      const title = await store.classTitle(rec.class_id);
      const session = await startResumable(`${title} (${id.slice(0, 8)}).mp4`, folder, total);
      job = { recording_id: id, session_uri: session, total_bytes: total, bytes_sent: 0, lock_until: new Date(now() + LOCK_MS).toISOString() };
      await store.createJob(job);
      await store.setState(id, { drive_state: "uploading", drive_error: null }, now());
    } else {
      const locked = await store.lockJob(id, now(), LOCK_MS);
      if (!locked) return { state: "uploading", percent: pct(job) }; // someone else is copying right now
      job = locked;
    }

    // Start from what Google has really kept, not from what we last wrote down
    let sent = job.bytes_sent;
    let fileId: string | null = null;
    if (sent > 0) {
      const st = await queryStatus(job.session_uri, job.total_bytes);
      if (st.done) { fileId = st.fileId ?? null; sent = job.total_bytes; } else { sent = st.persisted; }
    }
    const total = job.total_bytes;
    const session = job.session_uri;

    if (!fileId) {
      const res = await copyChunks({
        total, sent, chunk: opts.chunk ?? CHUNK, budgetMs: opts.budgetMs, now,
        read: (a, b) => readRange(link, a, b),
        put: (a, bytes) => putChunk(session, a, bytes, total),
        progress: (s) => store.saveProgress(id, s),
      });
      sent = res.sent;
      fileId = res.fileId;
    }

    if (!fileId) {
      await store.unlock(id);
      return { state: "uploading", percent: pct({ ...job, bytes_sent: sent }) };
    }

    await makeViewable(fileId);
    await store.setState(id, { drive_file_id: fileId, drive_state: "processing", drive_error: null }, now());
    await store.deleteJob(id);
    return { state: "processing", percent: 100 };
  } catch (e) {
    const kind = e instanceof DriveError ? e.kind : "other";
    if (kind === "session-lost") {
      // Google forgot the upload. Begin again with a new one.
      await store.deleteJob(id);
      await store.setState(id, { drive_state: null, drive_error: "The upload was interrupted and will start again." }, now());
      return { state: "starting", percent: 0 };
    }
    if (kind === "retry" || kind === "expired" || e instanceof TypeError) {
      await store.unlock(id).catch(() => undefined);
      return { state: "uploading", percent: 0, error: message(e) };
    }
    await store.unlock(id).catch(() => undefined);
    await store.setState(id, { drive_state: "error", drive_error: message(e).slice(0, 300) }, now());
    return { state: "error", percent: 0, error: message(e) };
  }
}
