// How big a lesson recording is. Daily's own default is 1920x1080 at 5 Mbps video plus 160 kbps audio.
export type RecordingQuality = "480p" | "720p" | "full";

export function parseQuality(v: string | undefined): RecordingQuality {
  const x = (v ?? "").trim();
  return x === "720p" || x === "full" ? x : "480p";
}

type Options = { width?: number; height?: number; fps?: number; videoBitrate?: number; audioBitrate?: number; maxDuration: number };

// A forgotten recording stops by itself after an hour
export function recordingOptions(q: RecordingQuality): Options {
  const maxDuration = 3600;
  if (q === "full") return { maxDuration };
  if (q === "720p") return { width: 1280, height: 720, fps: 30, videoBitrate: 1800, audioBitrate: 128, maxDuration };
  return { width: 854, height: 480, fps: 24, videoBitrate: 700, audioBitrate: 128, maxDuration };
}

// Megabytes for a recording of this length, from the bitrates above (video + audio)
export function estimateMb(q: RecordingQuality, minutes: number): number {
  const kbps = q === "full" ? 5000 + 160 : q === "720p" ? 1800 + 128 : 700 + 128;
  return Math.round(((kbps * 1000) / 8) * 60 * minutes / 1e6);
}
