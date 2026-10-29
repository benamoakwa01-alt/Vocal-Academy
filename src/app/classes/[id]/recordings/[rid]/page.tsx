import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { recordingAccessLink } from "@/lib/daily";

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id, rid } = await params;
  const { supabase } = await requireAccess();

  // The database only returns this row if the person is allowed to see it.
  const { data: rec } = await supabase
    .from("recordings")
    .select("id, provider_recording_id, purged_at")
    .eq("id", rid)
    .eq("class_id", id)
    .maybeSingle();
  if (!rec) redirect(`/classes/${id}`);

  const { data: cls } = await supabase.from("classes").select("title").eq("id", id).maybeSingle();

  let link = "";
  const gone = !!rec.purged_at;
  let failed = false;
  try {
    if (!gone) link = await recordingAccessLink(rec.provider_recording_id);
  } catch (e) {
    console.error("recording link failed:", e);
    failed = true;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={`/classes/${id}`} className="text-sm underline">Back to class</Link>
        <h1 className="text-2xl font-bold">{cls?.title ?? "Lesson recording"}</h1>
        {gone ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#647084]">This recording has passed its retention period and has been deleted.</p>
        ) : failed ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            We couldn&apos;t load this recording right now. Please try again in a moment.
          </p>
        ) : (
          <>
            <video controls playsInline preload="metadata" src={link} className="w-full rounded-xl bg-black" />
            <a href={link} className="text-sm underline">Download</a>
            <p className="text-xs text-gray-500">This link works for a limited time. Reload the page for a fresh one.</p>
          </>
        )}
      </div>
    </main>
  );
}
