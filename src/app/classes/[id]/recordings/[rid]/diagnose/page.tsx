import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { recordingAccessLink } from "@/lib/daily";
import { layoutOf, totalFromContentRange, type Layout } from "@/lib/mp4-probe";
import { PageHeader, Panel } from "@/components/ui";

type Part = {
  status: number; ms: number; ttfb: number; body: Uint8Array;
  acceptRanges: string | null; contentRange: string | null; contentLength: string | null;
  contentType: string | null; disposition: string | null;
};

// Reads at most `limit` bytes, then stops, so a server that ignores the range cannot make us download a whole file
async function readUpTo(res: Response, limit: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let n = 0;
  while (n < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    n += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(n, limit));
  let o = 0;
  for (const c of chunks) {
    if (o >= out.length) break;
    const piece = c.subarray(0, out.length - o);
    out.set(piece, o);
    o += piece.length;
  }
  return out;
}

async function fetchPart(url: string, range: string, limit: number): Promise<Part | { error: string }> {
  try {
    const t0 = getNow();
    const res = await fetch(url, { headers: { Range: range }, cache: "no-store" });
    const ttfb = getNow() - t0;
    const body = await readUpTo(res, limit);
    return {
      status: res.status, ms: getNow() - t0, ttfb, body,
      acceptRanges: res.headers.get("accept-ranges"), contentRange: res.headers.get("content-range"),
      contentLength: res.headers.get("content-length"), contentType: res.headers.get("content-type"),
      disposition: res.headers.get("content-disposition"),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const isPart = (p: Part | { error: string }): p is Part => !("error" in p);

function verdict(rangeWorks: boolean, layout: Layout, totalMb: number | null) {
  if (!rangeWorks) {
    return `The storage does not allow the video to be fetched in pieces. A browser then has to download the whole file${totalMb ? ` (${totalMb} MB)` : ""} before it can start playing. That would explain the long wait, and it would get worse for longer lessons.`;
  }
  if (layout === "moov-at-end") {
    return "The file's index sits at the very end, so the player must make an extra trip to the end of the file before it can start. Pieces are allowed, so this should be quick. If the wait is still long, the cause is mostly the network between Ghana and the storage.";
  }
  if (layout === "faststart") {
    return "The file is laid out for a quick start, and pieces are allowed. The wait is then mostly the network speed between Ghana and the storage, not the file.";
  }
  if (layout === "fragmented") {
    return "The file is built in many small pieces with no single index. Some browsers, Safari especially, can show a wrong or growing length for such files while they download. This fits the iPhone student's report.";
  }
  return "The file's layout could not be read. Send me the table below and I will work it out.";
}

export default async function DiagnosePage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const { supabase } = await requireAdmin();

  const { data: rec } = await supabase
    .from("recordings").select("id, provider, provider_recording_id").eq("id", rid).eq("class_id", id).maybeSingle();
  if (!rec) notFound();
  if (rec.provider === "link") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <PageHeader title="Recording check" description="This recording is hosted outside the platform, so there is nothing to check." />
      </main>
    );
  }

  let link = "";
  let linkError: string | null = null;
  try {
    link = await recordingAccessLink(rec.provider_recording_id);
  } catch (e) {
    linkError = e instanceof Error ? e.message : String(e);
  }

  let head: Part | { error: string } | null = null;
  let tail: Part | { error: string } | null = null;
  let speed: Part | { error: string } | null = null;
  let total: number | null = null;

  if (!linkError) {
    head = await fetchPart(link, "bytes=0-65535", 65536);
    if (isPart(head)) {
      total = totalFromContentRange(head.contentRange) ?? (head.status === 200 && head.contentLength ? Number(head.contentLength) : null);
      const rangeWorks = head.status === 206;
      if (rangeWorks && total && total > 131072) tail = await fetchPart(link, `bytes=${total - 65536}-${total - 1}`, 65536);
      const from = rangeWorks && total && total > 8_000_000 ? 2_000_000 : 0;
      speed = await fetchPart(link, `bytes=${from}-${from + 4_000_000}`, 4_000_000);
    }
  }

  const headOk = head && isPart(head) ? head : null;
  const tailOk = tail && isPart(tail) ? tail : null;
  const speedOk = speed && isPart(speed) ? speed : null;
  const rangeWorks = headOk?.status === 206;
  const { layout, boxes } = headOk ? layoutOf(headOk.body, tailOk?.body ?? null) : { layout: "unknown" as Layout, boxes: [] as string[] };
  const totalMb = total ? Math.round(total / 1e6) : null;
  const mbPerSec = speedOk && speedOk.ms > 0 ? (speedOk.body.length / 1e6) / (speedOk.ms / 1000) : null;

  const rows: [string, string][] = headOk
    ? [
        ["File size", totalMb ? `${totalMb} MB` : "not stated"],
        ["Can it be fetched in pieces?", rangeWorks ? "Yes (status 206)" : `No (status ${headOk.status}). The whole file is sent.`],
        ["Accept-Ranges header", headOk.acceptRanges ?? "not sent"],
        ["Content type", headOk.contentType ?? "not stated"],
        ["Content-Disposition", headOk.disposition ?? "not sent"],
        ["File layout", layout],
        ["Parts of the file seen at the start", boxes.join(", ") || "none"],
        ["Time to first byte (from our server)", `${headOk.ttfb} ms`],
        ["Speed from our server to the storage", mbPerSec ? `${mbPerSec.toFixed(1)} MB per second` : "not measured"],
      ]
    : [];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <PageHeader title="Recording check" description="Why a recording may be slow to start. Admin only." />
      {linkError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not get the recording link: {linkError}</p>}
      {head && !isPart(head) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not reach the storage: {head.error}</p>}
      {headOk && (
        <>
          <Panel title="What this means">
            <p className="text-sm text-[#17253B]">{verdict(rangeWorks, layout, totalMb)}</p>
          </Panel>
          <Panel title="The details">
            <dl className="divide-y divide-gray-100 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-3 py-2">
                  <dt className="text-[#647084]">{k}</dt>
                  <dd className="font-medium text-[#17253B]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-[#647084]">
              The speeds above are measured from our server, which is close to Daily&apos;s storage, so they look fast. They say nothing about Ghana. What matters here is whether pieces are allowed and how the file is laid out.
            </p>
          </Panel>
        </>
      )}
    </main>
  );
}
