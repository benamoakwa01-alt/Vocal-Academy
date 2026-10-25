import Image from "next/image";
import Link from "next/link";
import { excerpt, initials, type TutorProfile } from "@/lib/tutors";

export default function TutorCard({ t, photo }: { t: TutorProfile; photo: string | null }) {
  return (
    <Link href={`/tutors/${t.id}`}
      className="block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101B2D] focus-visible:ring-offset-2">
      <div className="relative aspect-[4/5] bg-[#101B2D]">
        {photo ? (
          <Image src={photo} alt={`Portrait of ${t.display_name}`} fill
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-6xl text-[#D8BC7E]" aria-hidden="true">{initials(t.display_name)}</span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-display text-xl font-semibold text-[#101B2D]">{t.display_name}</h3>
        {t.headline && <p className="text-sm font-medium text-[#8a6d2f]">{t.headline}</p>}
        {t.bio && <p className="text-sm text-[#647084]">{excerpt(t.bio, 140)}</p>}
        <span className="inline-block text-sm font-medium text-[#101B2D] underline">Read more</span>
      </div>
    </Link>
  );
}
