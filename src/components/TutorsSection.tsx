import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";
import TutorCard from "./TutorCard";

// Homepage strip. Shows nothing at all until at least one tutor has published a profile.
export default async function TutorsSection() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutor_profiles").select(TUTOR_COLUMNS).eq("published", true)
    .order("updated_at", { ascending: true }).limit(4);
  const tutors = (data ?? []) as TutorProfile[];
  if (tutors.length === 0) return null;

  return (
    <section id="tutors" className="bg-[#F4F5F7] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold text-[#101B2D] sm:text-4xl">Meet your tutors</h2>
        <p className="mt-2 max-w-xl text-[#647084]">The people who will guide you through every lesson.</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tutors.map((t) => (
            <li key={t.id}><TutorCard t={t} photo={photoUrl(supabase, t.photo_path)} /></li>
          ))}
        </ul>
        <Link href="/tutors" className="mt-6 inline-block text-sm font-medium text-[#101B2D] underline">See all tutors</Link>
      </div>
    </section>
  );
}
