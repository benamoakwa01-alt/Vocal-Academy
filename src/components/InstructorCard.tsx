import Image from "next/image";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excerpt, initials, photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";

// "Your instructor" on a course page. Shows nothing until the tutor has published a profile.
export default async function InstructorCard({ supabase, tutorId }: { supabase: SupabaseClient; tutorId: string | null }) {
  if (!tutorId) return null;
  const { data } = await supabase.from("tutor_profiles").select(TUTOR_COLUMNS).eq("id", tutorId).eq("published", true).maybeSingle();
  const t = data as TutorProfile | null;
  if (!t) return null;
  const photo = photoUrl(supabase, t.photo_path);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-semibold">Your instructor</h2>
      <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#101B2D] sm:h-28 sm:w-28">
          {photo ? (
            <Image src={photo} alt={`Portrait of ${t.display_name}`} fill sizes="112px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center font-display text-3xl text-[#D8BC7E]" aria-hidden="true">{initials(t.display_name)}</span>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-display text-xl font-semibold text-[#101B2D]">{t.display_name}</p>
          {t.headline && <p className="text-sm font-medium text-[#8a6d2f]">{t.headline}</p>}
          {t.bio && <p className="text-sm text-[#647084]">{excerpt(t.bio, 240)}</p>}
          <Link href={`/tutors/${t.id}`} className="inline-block text-sm font-medium text-[#101B2D] underline">View full profile</Link>
        </div>
      </div>
    </section>
  );
}
