import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { money, type Quote } from "@/lib/pricing";
import { requestEnrollment } from "../actions";
import ClassList from "@/components/ClassList";
import CourseSummary from "@/components/CourseSummary";
import InstructorCard from "@/components/InstructorCard";
import CurriculumView from "@/components/CurriculumView";

const errors: Record<string, string> = {
  promo: "That promo code is not valid or has expired.",
  price: "Enrollment is not open for this course yet.",
  failed: "We could not send your request. Please try again.",
};

const panel = "rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

export default async function CoursePage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { slug } = await params;
  const { error, code } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
  if (!course) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments").select("status").eq("course_id", course.id).eq("student_id", user.id).maybeSingle();
  const { data: accessData } = await supabase.rpc("has_course_access", { cid: course.id });
  const hasAccess = accessData === true;
  const isStaffHere = hasAccess && !enrollment;
  const status: string | undefined = enrollment?.status;

  const cleanCode = (code ?? "").trim();
  const { data: quoteData } = await supabase.rpc("price_quote", { cid: course.id, promo: cleanCode || null });
  const quote = (quoteData ?? null) as Quote | null;
  const canRequest = !hasAccess && (!status || ["cancelled", "expired", "withdrawn"].includes(status));

  const names = await tutorNames(supabase, [course.instructor_id]);
  const instructor = course.instructor_id ? names[course.instructor_id] : null;
  const now = getNow();

  let classes: ClassRow[] = [];
  if (hasAccess) {
    const { data } = await supabase
      .from("classes").select(CLASS_COLUMNS).eq("course_id", course.id).order("starts_at", { ascending: true });
    classes = (data ?? []) as ClassRow[];
  }
  const classNames = await tutorNames(supabase, classes.map((c) => c.tutor_id));

  const outcomes: string[] = course.outcomes ?? [];
  const curriculum: string[] = course.curriculum ?? [];

  const priceNode = !quote?.priced ? (
    <span className="text-[#647084]">Price coming soon</span>
  ) : quote.list === 0 ? (
    <span className="text-2xl font-bold text-[#101B2D]">Free</span>
  ) : quote.discount > 0 ? (
    <span>
      <s className="mr-2 text-[#647084]">{money(quote.list)}</s>
      <span className="text-2xl font-bold text-[#101B2D]">{money(quote.due)}</span>
    </span>
  ) : (
    <span className="text-2xl font-bold text-[#101B2D]">{money(quote.list)}</span>
  );

  const chips = [instructor ? `Instructor: ${instructor}` : null, course.format ? `Format: ${course.format}` : null]
    .filter(Boolean) as string[];

  return (
    <main className="pb-10">
      <section className="relative isolate overflow-hidden bg-[#101B2D] pb-14 pt-8 text-white">
        <Image src="/images/vocal-training-hero.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover object-[80%_center]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(90deg, rgba(16,27,45,0.96) 0%, rgba(16,27,45,0.88) 45%, rgba(16,27,45,0.55) 100%)" }} />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link href="/courses" className="text-sm text-[#D8BC7E] underline">All courses</Link>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{course.title}</h1>
          {course.summary && <p className="mt-3 max-w-2xl text-[#C9D1DF]">{course.summary}</p>}
          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c} className="rounded-full border border-[#D8BC7E]/40 px-3 py-1 text-sm text-[#D8BC7E]">{c}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mx-auto -mt-8 max-w-6xl space-y-6 px-4 sm:px-6">
        <CourseSummary lines={curriculum} fallbackDuration={course.duration ?? null} />

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? errors.failed}</p>}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="order-2 space-y-8 lg:order-1 lg:col-span-2">
            <InstructorCard supabase={supabase} tutorId={course.instructor_id} />
            {course.description && (
              <section className="space-y-2">
                <h2 className="font-display text-2xl font-semibold">About this course</h2>
                <p className="whitespace-pre-line text-[#17253B]">{course.description}</p>
              </section>
            )}

            {outcomes.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-semibold">What you will learn</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-[#17253B]">
                      <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6d2f]" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 10.5l4 4 8-9" />
                      </svg>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {curriculum.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-semibold">Curriculum</h2>
                <CurriculumView lines={curriculum} />
              </section>
            )}
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
            {canRequest && (
              <section className={`${panel} space-y-4`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-[#101B2D]">Enroll</h2>
                  {priceNode}
                </div>

                {quote?.valid && quote.discount > 0 && (
                  <p className="text-sm text-green-700">
                    {quote.label ? `${quote.label}: ` : ""}you save {money(quote.discount)}.
                  </p>
                )}

                {quote?.priced && (
                  <form method="get" className="flex gap-2">
                    <input name="code" defaultValue={cleanCode} placeholder="Promo code (optional)" aria-label="Promo code"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-[#17253B]" />
                    <button className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50">Apply</button>
                  </form>
                )}
                {cleanCode && quote && !quote.valid && (
                  <p role="alert" className="text-sm text-red-600">That promo code is not valid or has expired.</p>
                )}

                {quote?.priced ? (
                  <form action={requestEnrollment}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="slug" value={course.slug} />
                    <input type="hidden" name="code" value={quote.valid ? cleanCode : ""} />
                    <button className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#101B2D] font-semibold text-white hover:bg-[#14223A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101B2D] focus-visible:ring-offset-2">
                      {quote.due === 0 ? "Enroll for free" : `Enroll for ${money(quote.due)}`}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-[#647084]">Enrollment opens once the price is set.</p>
                )}

                <p className="text-xs text-[#647084]">
                  After you enroll you will see the payment details. Classes, lessons, recordings and assignments unlock once the academy confirms your payment. Lessons are recorded, and recordings are shared with the students in your class.
                </p>
              </section>
            )}

            {!hasAccess && status === "pending" && (
              <section className={`${panel} space-y-3 border-[#D8BC7E]`}>
                <p className="font-semibold text-[#101B2D]">Waiting for payment confirmation</p>
                <p className="text-sm text-[#647084]">
                  Complete your payment, then tell us you have paid. Your access starts as soon as the academy confirms it.
                </p>
                <Link href={`/courses/${course.slug}/enroll`}
                  className="inline-flex h-10 items-center rounded-lg bg-[#101B2D] px-4 text-sm font-semibold text-white hover:bg-[#14223A]">
                  See payment details
                </Link>
              </section>
            )}

            {!hasAccess && status === "paused" && (
              <p className={`${panel} text-sm text-[#647084]`}>Your enrollment is paused. Please contact the academy.</p>
            )}

            {hasAccess && (
              <section className={`${panel} space-y-3`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-[#101B2D]">
                    {status === "completed" ? "Completed" : isStaffHere ? "Course classes" : "You are enrolled"}
                  </h2>
                  {isStaffHere && <Link href="/classes/new" className="text-sm font-medium text-[#101B2D] underline">Schedule a class</Link>}
                </div>
                <ClassList classes={classes} names={classNames} now={now} empty="No classes scheduled yet." />
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
