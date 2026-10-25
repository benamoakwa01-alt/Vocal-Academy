import Image from "next/image";
import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#D8BC7E]/30 bg-[#101B2D]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
          <Image src="/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 rounded" />
          <span className="font-display text-lg font-semibold text-[#D8BC7E]">Pneuma Music Academy</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
          <Link href="/#programmes" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">Programmes</Link>
          <Link href="/tutors" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">Tutors</Link>
          <Link href="/login" className="rounded-lg border border-[#D8BC7E]/60 px-3 py-2 text-sm font-medium text-[#D8BC7E] hover:bg-white/5">Log in</Link>
          <Link href="/signup" className="rounded-lg bg-[#D8BC7E] px-3 py-2 text-sm font-semibold text-[#101B2D] hover:bg-[#e6d19b]">Join the Academy</Link>
        </nav>
      </div>
    </header>
  );
}
