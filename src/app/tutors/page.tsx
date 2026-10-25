import { createClient } from "@/lib/supabase/server";
import { photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import TutorCard from "@/components/TutorCard";

export const metadata = { title: "Our tutors | Pneuma Music Academy" };

export default async function TutorsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("tutor_profiles").select(TUTOR_COLUMNS).eq("published", true).order("display_name");
  const tutors = (data ?? []) as TutorProfile[];

  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F5F7] text-[#17253B]">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold text-[#101B2D] sm:text-4xl">Our tutors</h1>
        <p className="mt-2 max-w-xl text-[#647084]">The people who will guide you through every lesson.</p>
        {tutors.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-[#647084]">
            Our tutors will be introduced here soon.
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tutors.map((t) => <li key={t.id}><TutorCard t={t} photo={photoUrl(supabase, t.photo_path)} /></li>)}
          </ul>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
