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
}) {
  const properties: Record<string, unknown> = {
    room_name: opts.room,
    user_name: opts.userName,
    user_id: opts.userId,
    is_owner: opts.isOwner,
    exp: opts.expUnix,
  };
  if (opts.nbfUnix) properties.nbf = opts.nbfUnix;
  if (opts.isOwner) {
    properties.enable_recording = "cloud";
    if (autoRecord()) properties.start_cloud_recording = true;
  }
  const res = await fetch(`${API}/meeting-tokens`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`Daily token error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { token: string };
  return json.token;
}
