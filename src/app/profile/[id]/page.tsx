import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";
import TutorPhotoField from "@/components/TutorPhotoField";
import { PageHeader, Panel, btnPrimary } from "@/components/ui";
import { saveTutorProfile } from "../actions";

const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#17253B]";
const errors: Record<string, string> = {
  name: "Please enter the name to show on the website.",
  video: "That does not look like a YouTube or Vimeo link.",
  photo: "That photo could not be used. Please upload it again.",
  bio: "Add a short bio before you show the profile on the website.",
  save: "Could not save the profile.",
};

export default async function ProfileEditPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; detail?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  if (id !== user.id && profile.role !== "admin") redirect(`/profile/${user.id}`);

  const { data: person } = await supabase.from("profiles").select("full_name, role").eq("id", id).maybeSingle();
  if (!person || person.role === "student") notFound();

  const { data: row } = await supabase.from("tutor_profiles").select(TUTOR_COLUMNS).eq("id", id).maybeSingle();
  const t = (row ?? null) as TutorProfile | null;
  const photo = photoUrl(supabase, t?.photo_path ?? null);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader title={id === user.id ? "My public profile" : `Public profile: ${person.full_name ?? "Tutor"}`}
        description="This is what students and visitors see on the website."
        actions={t?.published ? <Link href={`/tutors/${id}`} className="text-sm font-medium text-[#101B2D] underline">View public page</Link> : undefined} />

      {sp.saved && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Saved.{t?.published ? "" : " It is not showing on the website yet. Tick Show on the website to publish it."}</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors[sp.error] ?? "Something went wrong."} {sp.detail ?? ""}</p>}

      <form action={saveTutorProfile} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="tutor_id" value={id} />
        <TutorPhotoField tutorId={id} initialPath={t?.photo_path ?? ""} initialUrl={photo} />

        <label className="block text-sm">Name to show
          <input name="display_name" required maxLength={100} defaultValue={t?.display_name ?? person.full_name ?? ""} className={input} />
        </label>
        <label className="block text-sm">Headline
          <input name="headline" maxLength={120} defaultValue={t?.headline ?? ""} className={input} />
          <span className="mt-1 block text-xs text-[#647084]">One line under your name, for example your role and what you teach.</span>
        </label>
        <label className="block text-sm">About you
          <textarea name="bio" rows={8} maxLength={2000} defaultValue={t?.bio ?? ""} className={input} />
          <span className="mt-1 block text-xs text-[#647084]">About 120 to 200 words. Say what students gain from learning with you.</span>
        </label>
        <label className="block text-sm">Background and credentials (one per line)
          <textarea name="credentials" rows={5} defaultValue={(t?.credentials ?? []).join("\n")} className={input} />
          <span className="mt-1 block text-xs text-[#647084]">Only things you can prove: training, years of teaching, performances, awards.</span>
        </label>
        <label className="block text-sm">Video link (optional)
          <input name="video_url" defaultValue={t?.video_url ?? ""} placeholder="YouTube or Vimeo link" className={input} />
          <span className="mt-1 block text-xs text-[#647084]">A short clip of you teaching or performing. Get written permission before showing any student.</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={t?.published ?? false} /> Show on the website
        </label>
        <button className={btnPrimary}>Save profile</button>
      </form>

      <Panel title="Tips for a profile that earns trust">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[#17253B]">
          <li>Use a real, recent portrait. Smiling, in good light, face in the upper middle.</li>
          <li>Write about the student, not only about yourself.</li>
          <li>List three to five true credentials rather than a long list.</li>
          <li>A 60 to 90 second video builds more trust than any paragraph.</li>
        </ul>
      </Panel>
    </main>
  );
}
