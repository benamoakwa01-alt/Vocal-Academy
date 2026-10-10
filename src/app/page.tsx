import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0b1423] px-4 py-8">
      <div className="logo-feather logo-in relative isolate w-[min(92vw,520px)]">
        <Image
          src="/logo-full.jpg"
          alt="Pneuma Music Academy. Spirit, Excellence, Impact."
          width={1000}
          height={1000}
          priority
          className="h-auto w-full select-none"
        />
        <span className="flame-glow" aria-hidden="true" />
        <span className="logo-sweep absolute inset-0" aria-hidden="true" />
      </div>
      <div className="rise-in flex w-full max-w-xs flex-col gap-3 sm:max-w-sm sm:flex-row">
        <Link href="/signup"
          className="flex-1 rounded-lg bg-[#bfa26b] px-5 py-3 text-center font-semibold text-[#0b1423] hover:bg-[#ead39e]">
          Join the academy
        </Link>
        <Link href="/login"
          className="flex-1 rounded-lg border border-[#bfa26b] px-5 py-3 text-center font-semibold text-[#ead39e] hover:bg-white/5">
          Log in
        </Link>
      </div>
    </main>
  );
}
