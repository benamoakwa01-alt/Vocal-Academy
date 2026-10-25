import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initials, photoUrl, TUTOR_COLUMNS, type TutorProfile } from "@/lib/tutors";
import { toEmbedUrl } from "@/lib/video";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

export default async function TutorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tutor_profiles").select(TUTOR_COLUMNS).eq("id", id).eq("published", true).maybeSingle();
  const t = data as TutorProfile | null;
  if (!t) notFound();

  const photo = photoUrl(supabase, t.photo_path);
  const embed = t.video_url ? toEmbedUrl(t.video_url) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F5F7] text-[#17253B]">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Link href="/tutors" className="text-sm font-medium text-[#101B2D] underline">All tutors</Link>
        <div className="mt-6 grid gap-8 md:grid-cols-[18rem_1fr]">
          <div className="relative aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl bg-[#101B2D] md:max-w-none">
            {photo ? (
              <Image src={photo} alt={`Portrait of ${t.display_name}`} fill priority sizes="(min-width: 768px) 288px, 90vw" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center font-display text-7xl text-[#D8BC7E]" aria-hidden="true">{initials(t.display_name)}</span>
            )}
          </div>

          <div className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold text-[#101B2D] sm:text-4xl">{t.display_name}</h1>
              {t.headline && <p className="mt-1 text-lg font-medium text-[#8a6d2f]">{t.headline}</p>}
            </header>

            {t.bio && (
              <section className="space-y-2">
                <h2 className="font-display text-2xl font-semibold text-[#101B2D]">About</h2>
                <p className="whitespace-pre-line text-[#17253B]">{t.bio}</p>
              </section>
            )}

            {t.credentials.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-2xl font-semibold text-[#101B2D]">Background</h2>
                <ul className="space-y-2">
                  {t.credentials.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[#17253B]">
                      <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-[#8a6d2f]" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {embed && (
              <section className="space-y-2">
                <h2 className="font-display text-2xl font-semibold text-[#101B2D]">Watch</h2>
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <iframe src={embed} title={`Video from ${t.display_name}`} className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              </section>
            )}

            <Link href="/signup" className="inline-block rounded-lg bg-[#101B2D] px-5 py-3 font-semibold text-white hover:bg-[#14223A]">
              Join the Academy
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
