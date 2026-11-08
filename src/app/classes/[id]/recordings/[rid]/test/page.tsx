import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { recordingAccessLink } from "@/lib/daily";
import PlaybackTest from "@/components/PlaybackTest";

export default async function PlaybackTestPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const { supabase } = await requireAccess();

  // The database only returns this row if the person is allowed to see the recording.
  const { data: rec } = await supabase
    .from("recordings").select("id, provider, provider_recording_id, purged_at").eq("id", rid).eq("class_id", id).maybeSingle();
  if (!rec || rec.purged_at || rec.provider === "link") redirect(`/classes/${id}`);

  const link = await recordingAccessLink(rec.provider_recording_id).catch(() => null);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <Link href={`/classes/${id}`} className="text-sm underline">Back to class</Link>
      <h1 className="text-2xl font-bold text-[#101B2D]">Playback test</h1>
      <p className="text-sm text-[#647084]">
        This shows what your browser does while it loads the recording. Run it, then send a screenshot of the log to the person who asked you to.
      </p>
      {link ? (
        <PlaybackTest src={link} />
      ) : (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">We couldn&apos;t get the recording right now. Please try again in a moment.</p>
      )}
    </main>
  );
}
