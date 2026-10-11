import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import { money, type Quote } from "@/lib/pricing";
import { requestEnrollment } from "../actions";
import ClassList from "@/components/ClassList";
import CourseSummary from "@/components/CourseSummary";
import CurriculumView from "@/components/CurriculumView";

const errors: Record<string, string> = {
  promo: "That promo code is not valid or has expired.",
  price: "Enrollment is not open for this course yet.",
  failed: "We could not send your request. Please try again.",
};

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
    <span className="text-gray-600">Price coming soon</span>
  ) : quote.list === 0 ? (
    <span className="font-semibold">Free</span>
  ) : quote.discount > 0 ? (
    <span>
      <s className="mr-2 text-gray-500">{money(quote.list)}</s>
      <span className="text-xl font-bold">{money(quote.due)}</span>
    </span>
  ) : (
    <span className="text-xl font-bold">{money(quote.list)}</span>
  );

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/courses" className="text-sm underline">All courses</Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{course.title}</h1>
          {course.summary && <p className="text-gray-600">{course.summary}</p>}
          <p className="text-sm text-gray-500">
            {[instructor ? `Instructor: ${instructor}` : null,
              
              course.format ? `Format: ${course.format}` : null].filter(Boolean).join(" · ")}
          </p>
        </header>

        {course.description && <p className="whitespace-pre-line text-gray-700">{course.description}</p>}

        <CourseSummary lines={curriculum} fallbackDuration={course.duration ?? null} />

        {outcomes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What you will learn</h2>
            <ul className="list-disc space-y-1 pl-5 text-gray-700">
              {outcomes.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>
        )}

        {curriculum.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Curriculum overview</h2>
            <CurriculumView lines={curriculum} />
          </section>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? errors.failed}</p>}

        {!hasAccess && status === "pending" && (
          <section className="space-y-3 rounded-xl bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">Your enrollment is waiting for payment confirmation</p>
            <p className="text-sm text-amber-900">
              Complete your payment, then tell us you have paid. Your access starts as soon as the academy confirms it.
            </p>
            <Link href={`/courses/${course.slug}/enroll`}
              className="inline-block rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              See payment details
            </Link>
          </section>
        )}

        {!hasAccess && status === "paused" && (
          <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
            Your enrollment is paused. Please contact the academy.
          </p>
        )}

        {canRequest && (
          <section className="space-y-4 rounded-xl bg-white p-5 shadow">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Enroll in this course</h2>
              {priceNode}
            </div>

            {quote?.valid && quote.discount > 0 && (
              <p className="text-sm text-green-700">
                {quote.label ? `${quote.label}: ` : ""}you save {money(quote.discount)}.
              </p>
            )}

            {quote?.priced && (
              <form method="get" className="flex gap-2">
                <input name="code" defaultValue={cleanCode} placeholder="Promo code (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
                <button className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-100">Apply</button>
              </form>
            )}
            {cleanCode && quote && !quote.valid && (
              <p className="text-sm text-red-600">That promo code is not valid or has expired.</p>
            )}

            {quote?.priced ? (
              <form action={requestEnrollment}>
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="slug" value={course.slug} />
                <input type="hidden" name="code" value={quote.valid ? cleanCode : ""} />
                <button className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 sm:w-auto">
                  {quote.due === 0 ? "Enroll for free" : `Enroll for ${money(quote.due)}`}
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-600">Enrollment opens once the price is set.</p>
            )}

            <p className="text-xs text-gray-500">
              After you enroll you will see the payment details. Classes, lessons, recordings and assignments unlock once the academy confirms your payment. Lessons are recorded, and recordings are shared with the students in your class.
            </p>
          </section>
        )}

        {hasAccess && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {status === "completed" ? "Completed" : isStaffHere ? "Course classes" : "You are enrolled"}
              </h2>
              {isStaffHere && <Link href="/classes/new" className="text-sm underline">Schedule a class</Link>}
            </div>
            <ClassList classes={classes} names={classNames} now={now} empty="No classes scheduled yet." />
          </section>
        )}
      </div>
    </main>
  );
}
