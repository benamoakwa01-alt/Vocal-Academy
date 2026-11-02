// Server-only helper for the Daily REST API. Never import this from a client component.
const API = "https://api.daily.co/v1";

function headers() {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export const autoRecord = () => process.env.DAILY_AUTO_RECORD === "true";

export function roomNameFor(classId: string) {
  return `class-${classId}`;
}

export function roomUrl(name: string) {
  const domain = process.env.DAILY_DOMAIN;
  if (!domain) throw new Error("DAILY_DOMAIN is not set");
  return `https://${domain}.daily.co/${name}`;
}

// Creates a private room. Recording is OFF at room level; only the tutor's token turns it on.
function roomProps(expUnix: number) {
  return {
    exp: expUnix,
    max_participants: 30,
    enable_chat: true,
    enable_emoji_reactions: true,
    enable_hand_raising: true,
  };
}

export async function ensureRoom(name: string, expUnix: number) {
  const res = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: roomProps(expUnix),
    }),
  });
  if (res.ok) return;
  const body = await res.text();
  if (res.status === 400 && /already exists/i.test(body)) {
    // Room already exists: refresh its settings so newer features apply. Not fatal if it fails.
    const upd = await fetch(`${API}/rooms/${name}`, {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({ privacy: "private", properties: roomProps(expUnix) }),
    });
    if (!upd.ok) console.warn("Daily room update failed:", upd.status, await upd.text());
    return;
  }
  throw new Error(`Daily room error ${res.status}: ${body}`);
}

export async function createToken(opts: {
  room: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expUnix: number;
  nbfUnix?: number;
  showRecordButton?: boolean;
}) {
  const build = (extras: boolean) => {
    const properties: Record<string, unknown> = {
      room_name: opts.room,
      user_name: opts.userName,
      user_id: opts.userId,
      is_owner: opts.isOwner,
      exp: opts.expUnix,
    };
    if (opts.nbfUnix) properties.nbf = opts.nbfUnix;
    if (opts.isOwner) {
      const mode = recordingMode();
      properties.enable_recording = mode;
      if (extras) {
        // The classroom's own Record button always records at Daily's full 1080p size. Our Start and Stop
        // buttons record at a smaller size, so the classroom's button is hidden unless asked for.
        if (mode === "cloud" && !opts.showRecordButton) properties.enable_recording_ui = false;
        if (autoRecord() && mode !== "local") properties.start_cloud_recording = true;
      }
    }
    return properties;
  };
  const post = (properties: Record<string, unknown>) =>
    fetch(`${API}/meeting-tokens`, {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({ properties }),
    });

  let res = await post(build(true));
  if (!res.ok && opts.isOwner) {
    // Daily did not accept the recording extras. The class must still be able to start,
    // so try again without them. The tutor can then use the classroom's own Record button.
    console.warn(`Daily rejected the recording settings (${res.status}): ${await res.text()}`);
    res = await post(build(false));
  }
  if (!res.ok) throw new Error(`Daily token error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { token: string };
  return json.token;
}

export type DailyRecording = {
  id: string;
  room_name?: string;
  start_ts: number;
  status: "finished" | "in-progress" | "canceled";
  duration?: number;
};

export async function listRoomRecordings(room: string): Promise<DailyRecording[]> {
  const res = await fetch(`${API}/recordings?room_name=${encodeURIComponent(room)}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daily recordings error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: DailyRecording[] };
  return json.data ?? [];
}

export async function recordingAccessLink(id: string) {
  const res = await fetch(`${API}/recordings/${encodeURIComponent(id)}/access-link`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daily access-link error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { download_link: string };
  return json.download_link;
}

// Deletes a recording from Daily for good. A recording that is already gone counts as deleted.
export async function deleteRecording(id: string): Promise<void> {
  const res = await fetch(`${API}/recordings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
    cache: "no-store",
  });
  if (res.ok || res.status === 404) return;
  throw new Error(`Daily delete error ${res.status}: ${await res.text()}`);
}

// How the tutor's classroom records. "cloud" is Daily's cloud recording. "local" saves a file on the tutor's own computer and costs nothing.
export function recordingMode(): string {
  const v = (process.env.DAILY_RECORDING_MODE ?? "cloud").trim();
  return ["cloud", "cloud-audio-only", "local"].includes(v) ? v : "cloud";
}
