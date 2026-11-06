// Reads just enough of an MP4 file to say how it is laid out. Used by the recording diagnostic page.

export type Box = { type: string; size: number }; // size -1 means "runs to the end of the file"
export type Layout = "faststart" | "moov-at-end" | "fragmented" | "unknown";

const u32 = (b: Uint8Array, p: number) => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.slice(p, p + n));

// The top-level boxes that fit inside these bytes
export function readBoxes(bytes: Uint8Array): { boxes: Box[]; valid: boolean } {
  const boxes: Box[] = [];
  let pos = 0;
  while (pos + 8 <= bytes.length) {
    let size = u32(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    if (!/^[\x20-\x7e]{4}$/.test(type)) return { boxes, valid: boxes.length > 0 };
    let header = 8;
    if (size === 0) { boxes.push({ type, size: -1 }); break; }
    if (size === 1) {
      if (pos + 16 > bytes.length) { boxes.push({ type, size: -1 }); break; }
      size = u32(bytes, pos + 8) * 4294967296 + u32(bytes, pos + 12);
      header = 16;
    }
    boxes.push({ type, size });
    if (size < header) return { boxes, valid: false };
    pos += size;
  }
  return { boxes, valid: boxes.length > 0 && boxes[0].type === "ftyp" };
}

export function hasMarker(bytes: Uint8Array, marker: string): boolean {
  const m = [...marker].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + m.length <= bytes.length; i++) {
    for (let j = 0; j < m.length; j++) if (bytes[i + j] !== m[j]) continue outer;
    return true;
  }
  return false;
}

// "faststart": the index comes first, so playback can begin at once.
// "moov-at-end": the index is at the end, so the player must reach the end before it can start.
// "fragmented": built in small pieces (common for recordings), with no single index.
export function layoutOf(head: Uint8Array, tail: Uint8Array | null): { layout: Layout; boxes: string[] } {
  const { boxes, valid } = readBoxes(head);
  const names = boxes.map((b) => b.type);
  if (!valid) return { layout: "unknown", boxes: names };
  const moov = names.indexOf("moov");
  const mdat = names.indexOf("mdat");
  if (names.includes("moof") || (moov !== -1 && hasMarker(head, "mvex"))) return { layout: "fragmented", boxes: names };
  if (moov !== -1 && (mdat === -1 || moov < mdat)) return { layout: "faststart", boxes: names };
  if (mdat !== -1 && (moov === -1 || mdat < moov)) {
    if (tail && (hasMarker(tail, "mfra") || hasMarker(tail, "moof"))) return { layout: "fragmented", boxes: names };
    if (tail && hasMarker(tail, "moov")) return { layout: "moov-at-end", boxes: names };
  }
  return { layout: "unknown", boxes: names };
}

// "bytes 0-65535/19876543" gives 19876543
export function totalFromContentRange(v: string | null): number | null {
  const m = v ? /\/(\d+)\s*$/.exec(v) : null;
  return m ? Number(m[1]) : null;
}
