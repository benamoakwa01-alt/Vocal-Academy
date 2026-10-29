import Image from "next/image";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excerpt, initials, photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";

// "Your instructor(s)" on a course page: the lead first, then the rest of the team.
// Only tutors who have published a profile appear, and nothing shows if nobody has.
export default async function InstructorCard({
  supabase, tutorId, courseId,
}: {
  supabase: SupabaseClient;
  tutorId: string | null;
  courseId?: string;
}) {
  const ids: string[] = [];
  if (tutorId) ids.push(tutorId);
  if (courseId) {
    const { data } = await supabase.from("course_tutors").select("tutor_id").eq("course_id", courseId);
    for (const r of (data ?? []) as { tutor_id: string }[]) if (!ids.includes(r.tutor_id)) ids.push(r.tutor_id);
  }
  if (ids.length === 0) return null;

  const { data } = await supabase.from("tutor_profiles").select(TUTOR_COLUMNS).in("id", ids).eq("published", true);
  const byId = new Map(((data ?? []) as TutorProfile[]).map((t) => [t.id, t]));
  const list = ids.map((id) => byId.get(id)).filter((t): t is TutorProfile => !!t);
  if (list.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-semibold">{list.length > 1 ? "Your instructors" : "Your instructor"}</h2>
      <ul className="space-y-3">
        {list.map((t) => {
          const photo = photoUrl(supabase, t.photo_path);
          return (
            <li key={t.id} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
