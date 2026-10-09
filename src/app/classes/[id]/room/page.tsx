import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, type ClassRow } from "@/lib/classes";
import { autoRecord, createToken, roomUrl } from "@/lib/daily";
import { endClass } from "../../actions";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const nowS = Math.floor(Date.now() / 1000);
  const endS = Math.floor(new Date(c.ends_at).getTime() / 1000);
  const startS = Math.floor(new Date(c.starts_at).getTime() / 1000);

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
        <Link href={`/classes/${id}`} className="underline">Leave</Link>
        <span className="truncate font-medium">{c.title}</span>
        {isStaff ? (
          <form action={endClass}>
            <input type="hidden" name="class_id" value={id} />
            <button className="rounded-lg bg-red-600 px-3 py-1.5 font-medium hover:bg-red-700">End lesson</button>
          </form>
        ) : (
          <span className="w-10" />
        )}
      </div>
      {isStaff && !autoRecord() && (
        <p className="bg-amber-500 px-3 py-1.5 text-sm text-black">
          Recording is not automatic yet. Press Record in the toolbar once students have joined, and check it shows as recording.
        </p>
      )}
      <iframe
        src={url}
        title={c.title}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full flex-1 border-0"
      />
    </main>
  );
}
