import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { recordingAccessLink } from "@/lib/daily";
import { driveConfigured, embedUrl } from "@/lib/drive";
import DrivePreparer from "@/components/DrivePreparer";

export default async function RecordingPage({
  params, searchParams,
}: {
  params: Promise<{ id: string; rid: string }>;
  searchParams: Promise<{ standard?: string }>;
}) {
  const { id, rid } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess();
  const staff = profile.role !== "student";

  // The database only returns this row if the person is allowed to see it.
  const { data: rec } = await supabase.from("recordings").select("*").eq("id", rid).eq("class_id", id).maybeSingle();
  if (!rec) redirect(`/classes/${id}`);

  const gone = !!rec.purged_at;
  const isLink = rec.provider === "link";
  const configured = driveConfigured();
  const forceStandard = sp.standard === "1";
  const driveReady = configured && !forceStandard && !gone && !isLink && rec.drive_state === "ready" && !!rec.drive_file_id;

  // Fetched side by side, so the page opens sooner
  const [clsRes, dailyLink] = await Promise.all([
    supabase.from("classes").select("title").eq("id", id).maybeSingle(),
    !gone && !isLink && !driveReady
      ? recordingAccessLink(rec.provider_recording_id).catch((e) => {
          console.error("recording link failed:", e);
          return null;
        })
      : Promise.resolve(null),
  ]);
  const title = clsRes.data?.title ?? "Lesson recording";

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <Link href={`/classes/${id}`} className="text-sm underline">Back to class</Link>
      <h1 className="text-2xl font-bold text-[#101B2D]">{title}</h1>

      {gone ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#647084]">
          This recording has passed its retention period and has been removed.
        </p>
      ) : isLink ? (
        <p className="text-sm">
          This recording is kept outside the platform.{" "}
          {rec.external_url && <a href={rec.external_url} target="_blank" rel="noreferrer" className="underline">Open it</a>}
        </p>
      ) : driveReady ? (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              src={embedUrl(rec.drive_file_id)}
              title={title}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
          <p className="text-xs text-[#647084]">
            Not playing well? <Link href={`/classes/${id}/recordings/${rid}?standard=1`} className="underline">Use the standard version</Link>.
          </p>
        </>
      ) : dailyLink ? (
        <>
          <video controls playsInline preload="metadata" src={dailyLink} className="w-full rounded-xl bg-black" />
          {!configured && (
            <p className="text-xs text-gray-500">On a slow connection this version can take a while to start, so Wi-Fi is best.</p>
          )}
          {configured && !forceStandard && <DrivePreparer recordingId={rid} />}
          {configured && forceStandard && rec.drive_state === "ready" && (
            <p className="text-xs text-[#647084]">
              <Link href={`/classes/${id}/recordings/${rid}`} className="underline">Go back to the faster version</Link>
            </p>
          )}
        </>
      ) : (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          We couldn&apos;t load this recording right now. Please try again in a moment.
        </p>
      )}

      {staff && configured && !gone && !isLink && (
        <p className="text-xs text-[#647084]">
          Fast copy on Google Drive: {rec.drive_state ?? "not started"}
          {rec.drive_error ? ` (${rec.drive_error})` : ""}
        </p>
      )}
    </main>
  );
}
