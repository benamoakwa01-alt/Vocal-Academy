import Image from "next/image";
import Link from "next/link";
import EqBars from "@/components/EqBars";
import PianoStrip from "@/components/PianoStrip";
import StaveDivider from "@/components/StaveDivider";

const vocalCourses = [
  "30:15 Vocal Transformation",
  "Advanced Vocal Development",
  "Harmony & Backing Vocals",
  "Vocal Performance Mastery",
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const steps = [
  {
    title: "Live classes",
    text: "Join your tutor at the scheduled time and learn together, live.",
    icon: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
  },
  {
    title: "Every lesson recorded",
    text: "Watch your class again whenever you need to.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></>,
  },
  {
    title: "Assignments with feedback",
    text: "Submit a recording or written work and receive personal feedback from your tutor, including voice notes.",
    icon: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  },
];

export default function Home() {
  return (
    <main className="bg-[#0b1423] text-[#f6f1e7]">
      <section className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-8">
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
        <a href="#programmes" className="rise-in text-sm text-[#ead39e] underline-offset-4 hover:underline">
          Our programmes
        </a>
      </section>

      <div className="mx-auto max-w-4xl px-4">
        <StaveDivider />
      </div>

      <section id="programmes" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-display text-3xl font-semibold text-[#f6f1e7] sm:text-4xl">Our programmes</h2>
        <p className="mt-2 max-w-xl text-[#c5cddc]">
          One academy, built around the voice first.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#bfa26b]/40 border-t-[3px] border-t-[#bfa26b] bg-[#101c33] p-6">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-2xl font-semibold">Vocals</h3>
              <EqBars className="h-5 text-[#bfa26b]" bars={5} />
            </div>
            <p className="mt-3 text-[#c5cddc]">
              Live classes with your tutor, every lesson recorded, and assignments that come back with personal feedback.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {vocalCourses.map((c) => (
                <li key={c} className="rounded-full border border-[#bfa26b]/40 px-3 py-1 text-sm text-[#ead39e]">{c}</li>
              ))}
            </ul>
            <Link href="/signup"
              className="mt-6 inline-block rounded-lg bg-[#bfa26b] px-5 py-2.5 font-semibold text-[#0b1423] hover:bg-[#ead39e]">
              Join the academy
            </Link>
          </article>

          <article className="rounded-2xl border border-dashed border-[#bfa26b]/50 p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold">Instruments</h3>
              <span className="shrink-0 rounded-full bg-[#bfa26b] px-3 py-1 text-xs font-semibold text-[#0b1423]">
                Coming soon
              </span>
            </div>
            <p className="mt-3 text-[#c5cddc]">
              Instrument lessons are coming soon. We are starting with vocals.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="font-display text-3xl font-semibold text-[#f6f1e7] sm:text-4xl">How learning works</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title} className="space-y-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#bfa26b]/50 text-[#ead39e]">
                <Icon>{s.icon}</Icon>
              </span>
              <h3 className="font-semibold text-[#f6f1e7]">{s.title}</h3>
              <p className="text-sm text-[#c5cddc]">{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer>
        <div className="mx-auto max-w-5xl px-4 pb-8 text-center">
          <p className="font-display text-xl text-[#ead39e]">Equipping hearts. Elevating sound. Transforming nations.</p>
          <p className="mt-2 text-sm text-[#9aa6bd]">Pneuma Music Academy</p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Link href="/login" className="text-[#ead39e] underline-offset-4 hover:underline">Log in</Link>
            <Link href="/signup" className="text-[#ead39e] underline-offset-4 hover:underline">Join the academy</Link>
          </div>
        </div>
        <PianoStrip />
      </footer>
    </main>
  );
}
