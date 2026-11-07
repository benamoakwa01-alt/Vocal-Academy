import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { recordingAccessLink } from "@/lib/daily";
import { probe, type Probe } from "@/lib/probe-fetch";
import { layoutOf, totalFromContentRange, type Layout } from "@/lib/mp4-probe";
import { PageHeader, Panel } from "@/components/ui";

// This page makes a few requests to the storage, each with its own short timer
export const maxDuration = 60;

function show(p: Probe | null, label: string): [string, string] {
  if (!p) return [label, "not run"];
  if (p.error) return [label, `failed: ${p.error}`];
  const ttfb = p.ttfb !== null ? `${p.ttfb} ms to start answering` : "";
  return [label, `status ${p.status}, ${ttfb}, ${p.ms} ms in total${p.interrupted ? " (stopped early)" : ""}`];
}

function verdict(first: Probe, rangeWorks: boolean, layout: Layout, totalMb: number | null, mbPerSec: number | null) {
  if (first.error) {
    return `The storage did not answer even a request for a single byte (${first.error}). From our server it is slow to respond, which fits what you see in Ghana: the video box waits a long time before anything plays.`;
  }
  if (first.status !== null && first.status >= 400) {
    return `The storage refused the request (status ${first.status}). The link may have expired, or something is blocking it.`;
  }
  if (!rangeWorks) {
    return `The storage does not allow the video to be fetched in pieces. A browser then has to download the whole file${totalMb ? ` (${totalMb} MB)` : ""} before it can start playing. That would explain the long wait, and it would get worse for longer lessons.`;
  }
  if (mbPerSec !== null && mbPerSec < 0.7) {
    return "Pieces are allowed, but the storage sends data slowly even to our server. The slowness is on the storage's side, so a different place to keep the video is likely the real fix.";
  }
  if (layout === "moov-at-end") {
    return "The file's index sits at the very end, so the player must make an extra trip to the end before it can start. Pieces are allowed, so this should be quick if the network is fine.";
  }
  if (layout === "fragmented") {
    return "The file is built in many small pieces with no single index. Some browsers, Safari especially, can show a wrong or growing length for such files while they download. This fits the iPhone student's report.";
  }
  if (layout === "faststart") {
    return "The file is laid out for a quick start, and pieces are allowed. The wait is then mostly the network between Ghana and the storage, not the file.";
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
  const tLink = getNow();
  try {
    link = await recordingAccessLink(rec.provider_recording_id);
  } catch (e) {
    linkError = e instanceof Error ? e.message : String(e);
  }
  const linkMs = getNow() - tLink;

  let first: Probe | null = null;
  let head: Probe | null = null;
  let tail: Probe | null = null;
  let speed: Probe | null = null;
  let total: number | null = null;

  if (!linkError) {
    first = await probe(link, "bytes=0-0", 1, 8000, getNow);
    if (!first.error && first.status !== null && first.status < 400) {
      total = totalFromContentRange(first.contentRange) ?? (first.status === 200 && first.contentLength ? Number(first.contentLength) : null);
      head = await probe(link, "bytes=0-65535", 65536, 8000, getNow);
      if (first.status === 206 && total && total > 131072) {
        tail = await probe(link, `bytes=${total - 65536}-${total - 1}`, 65536, 8000, getNow);
      }
      const from = first.status === 206 && total && total > 8_000_000 ? 2_000_000 : 0;
      speed = await probe(link, `bytes=${from}-${from + 1_999_999}`, 2_000_000, 10000, getNow);
    }
  }

  const rangeWorks = first?.status === 206;
  const headBody = head && !head.error ? head.body : null;
  const { layout, boxes } = headBody ? layoutOf(headBody, tail && !tail.error ? tail.body : null) : { layout: "unknown" as Layout, boxes: [] as string[] };
  const totalMb = total ? Math.round(total / 1e6) : null;
  const sendMs = speed && !speed.error ? Math.max(1, speed.ms - (speed.ttfb ?? 0)) : null;
  const mbPerSec = speed && !speed.error && sendMs ? speed.body.length / 1e6 / (sendMs / 1000) : null;

  const rows: [string, string][] = [
    ["Getting the recording link from Daily", linkError ? `failed: ${linkError}` : `${linkMs} ms`],
    show(first, "Asking for 1 byte"),
    show(head, "Asking for the first 64 KB"),
    show(tail, "Asking for the last 64 KB"),
    show(speed, "Asking for 2 MB"),
    ["File size", totalMb ? `${totalMb} MB` : "not known"],
    ["Can it be fetched in pieces?", first && !first.error ? (rangeWorks ? "Yes (status 206)" : `No (status ${first.status}). The whole file is sent.`) : "not known"],
    ["Accept-Ranges header", first?.acceptRanges ?? "not seen"],
    ["Content type", first?.contentType ?? "not seen"],
    ["File layout", layout],
    ["Parts of the file seen at the start", boxes.join(", ") || "none"],
    ["Speed from our server to the storage", mbPerSec !== null ? `${mbPerSec.toFixed(2)} MB per second (${speed?.body.length ?? 0} bytes received)` : "not measured"],
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <PageHeader title="Recording check" description="Why a recording may be slow to start. Admin only." />
      {linkError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not get the recording link: {linkError}</p>}
      {first && (
        <Panel title="What this means">
          <p className="text-sm text-[#17253B]">{verdict(first, rangeWorks, layout, totalMb, mbPerSec)}</p>
        </Panel>
      )}
      <Panel title="The details">
        <dl className="divide-y divide-gray-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-3 py-2">
              <dt className="text-[#647084]">{k}</dt>
              <dd className={`font-medium ${v.startsWith("failed") ? "text-red-700" : "text-[#17253B]"}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-[#647084]">
          These requests come from our server, not from Ghana. What matters here is whether the storage answers quickly, whether pieces are allowed, and how the file is built.
        </p>
      </Panel>
    </main>
  );
}
