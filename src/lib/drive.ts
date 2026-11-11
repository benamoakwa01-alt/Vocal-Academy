// Google Drive: a free place to keep a fast-playing copy of each recording. Server-only.
// The academy's Google account owns the files. The app can only touch files it created itself (drive.file).

const apiBase = () => process.env.GOOGLE_API_BASE ?? "https://www.googleapis.com";
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const FOLDER_NAME = "Pneuma Academy Recordings";

// Google needs every piece except the last to be a multiple of 256 KiB. 64 x 256 KiB = 16 MiB.
export const CHUNK = 64 * 262144;

export type DriveErrorKind = "auth" | "session-lost" | "expired" | "retry" | "other";
export class DriveError extends Error {
  kind: DriveErrorKind;
  constructor(message: string, kind: DriveErrorKind = "other") {
    super(message);
    this.kind = kind;
  }
}

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

let cached: { token: string; until: number } | null = null;
export function forgetToken() {
  cached = null;
}

export async function accessToken(now: number = Date.now()): Promise<string> {
  if (cached && cached.until > now + 60_000) return cached.token;
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!res.ok || !json?.access_token) {
    throw new DriveError(`Google sign-in failed (${res.status}): ${json?.error_description ?? json?.error ?? res.statusText}`, "auth");
  }
  cached = { token: json.access_token, until: now + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function g(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(apiBase() + path, {
    ...init,
    headers: { ...((init.headers as Record<string, string> | undefined) ?? {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

let folderId: string | null = null;
export function forgetFolder() {
  folderId = null;
}

// The folder lives in the academy's Drive. The app finds the one it made, or makes it.
export async function ensureFolder(): Promise<string> {
  if (folderId) return folderId;
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await g(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  if (!found.ok) throw new DriveError(`Could not look for the Drive folder (${found.status})`, found.status >= 500 ? "retry" : "other");
  const list = (await found.json()) as { files?: { id: string }[] };
  if (list.files?.[0]?.id) return (folderId = list.files[0].id);

  const made = await g("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!made.ok) throw new DriveError(`Could not create the Drive folder (${made.status})`, made.status >= 500 ? "retry" : "other");
  return (folderId = ((await made.json()) as { id: string }).id);
}

// Starts a resumable upload and returns the address to send the pieces to
export async function startResumable(name: string, parent: string, total: number): Promise<string> {
  const res = await g("/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(total),
    },
    body: JSON.stringify({ name, parents: [parent], mimeType: "video/mp4" }),
  });
  const where = res.headers.get("location");
  if (!res.ok || !where) {
    if (res.status === 404) forgetFolder(); // the folder was deleted: it will be made again next time
    throw new DriveError(`Could not start the Drive upload (${res.status})`, res.status >= 500 || res.status === 429 ? "retry" : "other");
  }
  return where;
}

export type PutResult = { done: boolean; persisted: number; fileId?: string };

function readPutAnswer(status: number, headers: Headers, total: number, json: { id?: string } | null): PutResult {
  if (status === 308) {
    const m = /bytes=0-(\d+)/.exec(headers.get("range") ?? "");
    return { done: false, persisted: m ? Number(m[1]) + 1 : 0 };
  }
  if (status === 200 || status === 201) {
    if (!json?.id) throw new DriveError("Google finished the upload but did not say which file it made", "other");
    return { done: true, persisted: total, fileId: json.id };
  }
  if (status === 404 || status === 410) throw new DriveError("The Drive upload session has expired", "session-lost");
  if (status >= 500 || status === 429) throw new DriveError(`Google was busy (${status})`, "retry");
  throw new DriveError(`Google refused the upload piece (${status})`, "other");
}

// Sends one piece. The session address authorises itself, so no sign-in header is needed.
export async function putChunk(session: string, start: number, bytes: Uint8Array, total: number): Promise<PutResult> {
  const end = start + bytes.length - 1;
  const res = await fetch(session, {
    method: "PUT",
    headers: { "Content-Range": `bytes ${start}-${end}/${total}` },
    body: bytes as unknown as BodyInit, // newer TypeScript is strict about byte arrays here; the bytes are sent as they are
    cache: "no-store",
  });
  const json = res.status === 200 || res.status === 201 ? ((await res.json().catch(() => null)) as { id?: string } | null) : null;
  return readPutAnswer(res.status, res.headers, total, json);
}

// Asks Google how much of the upload it has kept (used to carry on after an interruption)
export async function queryStatus(session: string, total: number): Promise<PutResult> {
  const res = await fetch(session, { method: "PUT", headers: { "Content-Range": `bytes */${total}` }, cache: "no-store" });
  const json = res.status === 200 || res.status === 201 ? ((await res.json().catch(() => null)) as { id?: string } | null) : null;
  return readPutAnswer(res.status, res.headers, total, json);
}

// Anyone with the link can watch. Viewers cannot download, print or copy it.
export async function makeViewable(fileId: string): Promise<void> {
  const p = await g(`/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
  });
  if (!p.ok) throw new DriveError(`Could not share the Drive file (${p.status})`, p.status >= 500 ? "retry" : "other");
  const u = await g(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ copyRequiresWriterPermission: true }),
  });
  if (!u.ok) throw new DriveError(`Could not restrict downloads on the Drive file (${u.status})`, u.status >= 500 ? "retry" : "other");
}

// Drive adds the video details only once it has finished preparing the video for streaming
export async function getFileInfo(fileId: string): Promise<{ exists: boolean; ready: boolean }> {
  const res = await g(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,size,videoMediaMetadata`);
  if (res.status === 404) return { exists: false, ready: false };
  if (!res.ok) throw new DriveError(`Could not check the Drive file (${res.status})`, res.status >= 500 ? "retry" : "other");
  const j = (await res.json()) as { videoMediaMetadata?: unknown };
  return { exists: true, ready: Boolean(j.videoMediaMetadata) };
}

// A file that is already gone counts as deleted
export async function deleteDriveFile(fileId: string): Promise<void> {
  if (!driveConfigured()) return;
  const res = await g(`/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  if (res.ok || res.status === 404) return;
  throw new DriveError(`Could not delete the Drive file (${res.status})`, "other");
}

export function embedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}
