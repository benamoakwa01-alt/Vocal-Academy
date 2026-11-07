// Fetches a small piece of a file and reports how it went, without ever waiting longer than timeoutMs.
// A slow, stalled or silent server becomes a result, not a crash.

export type Probe = {
  status: number | null;
  error: string | null;       // set when nothing usable came back
  ttfb: number | null;        // milliseconds until the server started answering
  ms: number;                 // milliseconds in total
  body: Uint8Array;
  interrupted: boolean;       // true if the time ran out while data was still arriving
  acceptRanges: string | null;
  contentRange: string | null;
  contentLength: string | null;
  contentType: string | null;
  disposition: string | null;
};

export async function probe(
  url: string, range: string, limit: number, timeoutMs: number, now: () => number = Date.now
): Promise<Probe> {
  const t0 = now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const empty = (error: string | null): Probe => ({
    status: null, error, ttfb: null, ms: now() - t0, body: new Uint8Array(0), interrupted: false,
    acceptRanges: null, contentRange: null, contentLength: null, contentType: null, disposition: null,
  });

  try {
    const res = await fetch(url, { headers: { Range: range }, cache: "no-store", signal: ctl.signal });
    const ttfb = now() - t0;

    const chunks: Uint8Array[] = [];
    let n = 0;
    let interrupted = false;
    const reader = res.body?.getReader();
    if (reader) {
      try {
        while (n < limit) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          n += value.length;
        }
      } catch {
        interrupted = true; // the timer ran out, or the connection dropped
      }
    }
    ctl.abort(); // stop the download here, whatever else the server wants to send

    const body = new Uint8Array(Math.min(n, limit));
    let o = 0;
    for (const c of chunks) {
      if (o >= body.length) break;
      const piece = c.subarray(0, body.length - o);
      body.set(piece, o);
      o += piece.length;
    }
    return {
      status: res.status, error: null, ttfb, ms: now() - t0, body, interrupted,
      acceptRanges: res.headers.get("accept-ranges"), contentRange: res.headers.get("content-range"),
      contentLength: res.headers.get("content-length"), contentType: res.headers.get("content-type"),
      disposition: res.headers.get("content-disposition"),
    };
  } catch (e) {
    if (ctl.signal.aborted) return empty(`no answer within ${Math.round(timeoutMs / 1000)} seconds`);
    return empty(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}
