import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { createToken, recordingMode, roomUrl } from "@/lib/daily";
import { parseQuality } from "@/lib/recording-quality";
import { endClass } from "../../actions";
import RejoinButton from "@/components/RejoinButton";
import ConfirmEndButton from "@/components/ConfirmEndButton";
import ClassroomFrame from "@/components/ClassroomFrame";

export default async function RoomPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basic?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  const isStaff = profile.role !== "student";

  const { data } = await supabase.from("classes").select(CLASS_COLUMNS).eq("id", id).maybeSingle();
  if (!data) redirect(`/classes/${id}`);
  const c = data as ClassRow;

  // Staff may enter once they've started the lesson; students only after the scheduled time.
  const { data: allowed } = isStaff
    ? await supabase.rpc("can_manage_class", { cid: id })
    : await supabase.rpc("can_join_class", { cid: id });
  if (allowed !== true || c.status !== "live") redirect(`/classes/${id}`);

  const { data: session } = await supabase
    .from("live_sessions").select("room_name").eq("class_id", id).maybeSingle();
  if (!session?.room_name) redirect(`/classes/${id}?error=room`);

  const nowS = Math.floor(getNow() / 1000);
  const endS = Math.floor(new Date(c.ends_at).getTime() / 1000);
  const startS = Math.floor(new Date(c.starts_at).getTime() / 1000);

  // Tutors get our own Start and Stop recording buttons (smaller recordings).
  // "?basic=1" brings back the classroom's own Record button, as a way out if the new buttons ever fail.
  const ownControls = isStaff && recordingMode() === "cloud" && sp.basic !== "1";
  const quality = parseQuality(process.env.DAILY_RECORDING_QUALITY);

  let url = "";
  let failed = false;
  try {
    const token = await createToken({
      room: session.room_name,
      userName: profile.full_name ?? (isStaff ? "Tutor" : "Student"),
      userId: user.id,
      isOwner: isStaff,
      expUnix: Math.max(endS, nowS) + 3600,
      nbfUnix: isStaff ? undefined : startS,
      showRecordButton: !ownControls,
    });
    url = `${roomUrl(session.room_name)}?t=${token}`;
  } catch (e) {
    console.error("room token failed:", e);
    failed = true;
  }
  if (failed) redirect(`/classes/${id}?error=room`);

  return (
    <main className="flex h-dvh flex-col bg-gray-900 text-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <Link href={`/classes/${id}`} className="underline">Leave</Link>
          <RejoinButton />
        </div>
        <span className="truncate font-medium">{c.title}</span>
        {isStaff ? (
          <form action={endClass}>
            <input type="hidden" name="class_id" value={id} />
            <ConfirmEndButton />
          </form>
        ) : (
          <span className="w-10" />
        )}
      </div>
      {isStaff && !ownControls && (
        <p className="bg-amber-500 px-3 py-1.5 text-sm text-black">
          Recording is not automatic. Press Record in the toolbar once students have joined, and check it shows as recording.
        </p>
      )}
      <ClassroomFrame url={url} title={c.title} ownControls={ownControls} quality={quality} />
    </main>
  );
}
