import { DriveError, type PutResult } from "./drive";

// Copies a file in pieces, within a time budget, and can carry on later from where it stopped.

// Reads one piece of the source (a Daily recording). The source answers with 206 and exactly the bytes asked for.
export async function readRange(url: string, start: number, endInclusive: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${endInclusive}` }, cache: "no-store" });
  if (res.status === 403 || res.status === 404) throw new DriveError(`The recording link no longer works (${res.status})`, "expired");
  if (res.status !== 206) throw new DriveError(`The recording storage did not return a piece (${res.status})`, res.status >= 500 ? "retry" : "other");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length !== endInclusive - start + 1) throw new DriveError("The recording storage returned the wrong amount of data", "retry");
  return bytes;
}

// The total size of the source, from a one-byte request
export async function sizeOf(url: string): Promise<number> {
  const res = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
  const m = /\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "");
  await res.arrayBuffer().catch(() => undefined);
  if (res.status !== 206 || !m) throw new DriveError(`Could not find the size of the recording (${res.status})`, res.status >= 500 ? "retry" : "other");
  return Number(m[1]);
}

export type CopyOptions = {
  total: number;
  sent: number;
  chunk: number;
  budgetMs: number;
  now: () => number;
  read: (start: number, endInclusive: number) => Promise<Uint8Array>;
  put: (start: number, bytes: Uint8Array) => Promise<PutResult>;
  progress: (sent: number) => Promise<void>;
  retries?: number;
  pauseMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries: number, pauseMs: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof DriveError ? e.kind === "retry" : e instanceof TypeError; // TypeError: network failure
      if (!retryable || attempt >= retries) throw e;
      await sleep(pauseMs * (attempt + 1));
    }
  }
}

// Returns how far it got, and the file id once Google confirms the whole file is there
export async function copyChunks(o: CopyOptions): Promise<{ sent: number; fileId: string | null }> {
  const retries = o.retries ?? 2;
  const pause = o.pauseMs ?? 400;
  const deadline = o.now() + o.budgetMs;
  let sent = o.sent;
  let slowest = 0;
  let stalls = 0;

  while (sent < o.total) {
    // Do not begin a piece that probably would not finish inside the budget (the first piece is always allowed)
    if (sent > o.sent && o.now() + slowest * 1.3 > deadline) break;

    const began = o.now();
    const end = Math.min(sent + o.chunk, o.total) - 1;
    const bytes = await withRetry(() => o.read(sent, end), retries, pause);
    const r = await withRetry(() => o.put(sent, bytes), retries, pause);
    slowest = Math.max(slowest, o.now() - began);

    if (r.done) {
      await o.progress(o.total);
      return { sent: o.total, fileId: r.fileId ?? null };
    }
    if (r.persisted <= sent) {
      stalls += 1;
      if (stalls >= 3) throw new DriveError("Google keeps not accepting the upload", "other");
    } else {
      stalls = 0;
    }
    sent = Math.min(r.persisted, end + 1); // Google may have kept less than we sent: carry on from what it kept
    await o.progress(sent);
  }
  return { sent, fileId: null };
}
