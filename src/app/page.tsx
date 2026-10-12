import Image from "next/image";
import Link from "next/link";
import EqBars from "@/components/EqBars";
import PianoStrip from "@/components/PianoStrip";
import StaveDivider from "@/components/StaveDivider";

const vocalCourses = [
  "30:15 Vocal Transformation",
  "Harmony & Backing Vocals",
  "Advanced Vocal Development",
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
    title: "Join and enroll",
    text: "Choose your programme, create your account and pay by Mobile Money. Your access opens once the academy confirms your payment.",
    icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M18 8v6M15 11h6" /></>,
  },
  {
    title: "Learn with your tutor",
    text: "Attend scheduled live classes and receive personal guidance.",
    icon: <><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="M15.5 10l6-3.5v11l-6-3.5z" /></>,
  },
  {
    title: "Practise and improve",
    text: "Watch recordings, complete assignments and get feedback, including voice notes, to build your skills.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></>,
  },
  {
    title: "Keep growing",
    text: "Continue into the next programme when you are ready.",
    icon: <><path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" /></>,
  },
];

const gold = "bg-[#D8BC7E] text-[#101B2D] hover:bg-[#e6d19b]";

export default function Home() {
  return (
    <div className="bg-[#F4F5F7] text-[#17253B]">
      <header className="sticky top-0 z-40 border-b border-[#D8BC7E]/30 bg-[#101B2D]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
            <Image src="/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 rounded" />
            <span className="font-display text-lg font-semibold text-[#D8BC7E]">Pneuma Music Academy</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
            <a href="#programmes" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">Programmes</a>
            <a href="#how-it-works" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">How it works</a>
            <Link href="/login" className="rounded-lg border border-[#D8BC7E]/60 px-3 py-2 text-sm font-medium text-[#D8BC7E] hover:bg-white/5">Log in</Link>
            <Link href="/signup" className={`rounded-lg px-3 py-2 text-sm font-semibold ${gold}`}>Join the Academy</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#101B2D] text-white">
          <Image src="/images/vocal-training-hero.jpg" alt="" fill priority sizes="100vw"
            className="-z-20 object-cover object-[78%_center]" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#101B2D]/75 md:hidden" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 hidden md:block"
            style={{ background: "linear-gradient(90deg, #101B2D 0%, rgba(16,27,45,0.88) 38%, rgba(16,27,45,0) 78%)" }} />
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-28">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-sm font-medium text-[#D8BC7E]">
                <EqBars className="h-4" bars={4} /> Welcome to Pneuma Music Academy
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Nurturing Voices. Building Musicians. <span className="text-[#D8BC7E]">Shaping Futures.</span>
              </h1>
              <p className="mt-4 text-[#E3E8F0]">
                Professional music education with live classes, recorded lessons and personal feedback from your tutor. Discover your voice. Grow in purpose.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className={`rounded-lg px-5 py-3 font-semibold ${gold}`}>Join the Academy</Link>
                <a href="#programmes" className="rounded-lg border border-[#D8BC7E]/70 px-5 py-3 font-semibold text-[#D8BC7E] hover:bg-white/5">
                  Explore programmes
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-[#101B2D] pb-6">
          <div className="mx-auto max-w-4xl px-4">
            <StaveDivider />
          </div>
        </div>

        <section id="programmes" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl font-semibold text-[#101B2D] sm:text-4xl">Find your path</h2>
          <p className="mt-2 max-w-xl text-[#647084]">Instruments lessons coming soon.</p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-[#D8BC7E]/40 bg-[#101B2D] text-white">
              <div className="relative aspect-[16/8]">
                <Image src="/images/vocal-performance.jpg" alt="A singer performing at a microphone" fill
                  sizes="(min-width: 1024px) 560px, 100vw" className="object-cover object-[65%_center]" />
              </div>
              <div className="border-t-[3px] border-t-[#D8BC7E] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D8BC7E] text-[#101B2D]">
                    <Icon><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>
                  </span>
                  <h3 className="font-display text-2xl font-semibold">Vocals</h3>
                  <EqBars className="h-5 text-[#D8BC7E]" bars={5} />
                </div>
                <p className="mt-3 text-[#C9D1DF]">Build confidence. Develop your voice. Express your story.</p>
                <ul className="mt-4 space-y-2">
                  {vocalCourses.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-[#F4F5F7]">
                      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#D8BC7E]" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                      {c}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`mt-6 inline-block rounded-lg px-5 py-2.5 font-semibold ${gold}`}>Join the Academy</Link>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-dashed border-[#D8BC7E] bg-white">
              <div className="relative grid aspect-[16/8] grid-cols-2 gap-px bg-[#D8BC7E]/50">
                <div className="relative">
                  <Image src="/images/piano-learning.jpg" alt="A student playing a grand piano" fill
                    sizes="(min-width: 1024px) 280px, 50vw" className="object-cover object-[35%_center]" />
                </div>
                <div className="relative">
                  <Image src="/images/guitar-learning.jpg" alt="A student learning acoustic guitar" fill
                    sizes="(min-width: 1024px) 280px, 50vw" className="object-cover object-[45%_center]" />
                </div>
                <span className="absolute right-3 top-3 rounded-full bg-[#101B2D] px-3 py-1 text-xs font-semibold text-[#D8BC7E]">
                  Coming soon
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D8BC7E] text-[#101B2D]">
                    <Icon><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M8 6v12M12 6v12M16 6v12" /></Icon>
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-[#101B2D]">Instruments</h3>
                </div>
                <p className="mt-3 text-[#647084]">Instrument lessons are coming soon.</p>
              </div>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-3xl font-semibold text-[#101B2D] sm:text-4xl">Simple. Structured. Effective.</h2>
            <p className="mt-2 max-w-xl text-[#647084]">A clear learning journey, with your tutor guiding every step.</p>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="space-y-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D8BC7E]/30 text-[#101B2D]">
                    <Icon>{s.icon}</Icon>
                  </span>
                  <h3 className="font-semibold text-[#101B2D]">{i + 1}. {s.title}</h3>
                  <p className="text-sm text-[#647084]">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#101B2D] py-14 text-white">
          <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 md:grid-cols-2">
            <div className="text-center md:text-left">
              <h2 className="font-display text-3xl font-semibold">Ready to begin?</h2>
              <p className="mt-2 text-[#C9D1DF]">Create your account, choose a programme and take your first step.</p>
              <Link href="/signup" className={`mt-6 inline-block rounded-lg px-6 py-3 font-semibold ${gold}`}>Join the Academy</Link>
            </div>
            <div className="logo-feather logo-in relative isolate mx-auto w-[min(70vw,300px)]">
              <Image src="/logo-full.jpg" alt="Pneuma Music Academy. Spirit, Excellence, Impact."
                width={1000} height={1000} className="h-auto w-full select-none" />
              <span className="flame-glow" aria-hidden="true" />
              <span className="logo-sweep absolute inset-0" aria-hidden="true" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0b1423] text-center">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="font-display text-xl text-[#D8BC7E]">Equipping hearts. Elevating sound. Transforming nations.</p>
          <p className="mt-2 text-sm text-[#9aa6bd]">Pneuma Music Academy</p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Link href="/login" className="text-[#D8BC7E] underline-offset-4 hover:underline">Log in</Link>
            <Link href="/signup" className="text-[#D8BC7E] underline-offset-4 hover:underline">Join the Academy</Link>
          </div>
        </div>
        <PianoStrip />
      </footer>
    </div>
  );
}
