
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { tutorNames } from "@/lib/people";
import { money } from "@/lib/pricing";
import EqBars from "@/components/EqBars";

const badge: Record<string, { label: string; cls: string }> = {
  active: { label: "Enrolled", cls: "bg-green-100 text-green-800" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-700" },
  pending: { label: "Awaiting payment", cls: "bg-amber-100 text-amber-800" },
  paused: { label: "Paused", cls: "bg-amber-100 text-amber-800" },
  expired: { label: "Expired", cls: "bg-gray-100 text-gray-700" },
  withdrawn: { label: "Withdrawn", cls: "bg-gray-100 text-gray-700" },
};

type C = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  duration: string | null;
  format: string | null;
  instructor_id: string | null;
  price_ghs: number | null;
};

function Banner({
  src,
  alt,
  title,
  position,
  extra,
}: {
  src: string;
  alt: string;
  title: string;
  position: string;
  extra?: ReactNode;
}) {
  return (
    <div className="relative isolate h-36 overflow-hidden rounded-xl bg-[#101B2D] sm:h-48">
      {/* Background image */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 1024px, 100vw"
        className="object-cover"
        style={{ objectPosition: position }}
      />

      {/* Dark overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,27,45,0.88) 0%, rgba(16,27,45,0.55) 55%, rgba(16,27,45,0.25) 100%)",
        }}
      />

      {/* White title and badge above the image */}
      <div className="absolute inset-0 z-20 flex items-end justify-between gap-3 p-5">
        <h2
          className="font-display text-3xl font-semibold drop-shadow-lg"
          style={{ color: "#FFFFFF" }}
        >
          {title}
        </h2>
        {extra}
      </div>
    </div>
  );
}

export default async function CoursesPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("courses")
    .select(
      "id, slug, title, summary, duration, format, instructor_id, price_ghs"
    )
    .eq("published", true)
    .order("created_at", { ascending: true });

  const courses = (data ?? []) as C[];

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, status")
    .eq("student_id", user.id);

  const statusByCourse = new Map<string, string>(
    (enrollments ?? []).map(
      (e: { course_id: string; status: string }) => [
        e.course_id,
        e.status,
      ]
    )
  );

  const names = await tutorNames(
    supabase,
    courses.map((c) => c.instructor_id)
  );

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#101B2D] sm:text-3xl">
          Explore courses
        </h1>
        <p className="mt-1 text-[#647084]">
          Find the programme that fits where you are and where you want to go.
        </p>
      </div>

      {/* Vocal programmes */}
      <section className="space-y-4">
        <Banner
          src="/images/vocal-performance.jpg"
          alt="A singer performing at a microphone"
          title="Vocals"
          position="65% center"
          extra={
            <EqBars
              className="mb-2 h-5 text-[#D8BC7E]"
              bars={5}
            />
          }
        />

        {courses.length === 0 && (
          <p className="text-sm text-[#647084]">
            No courses available yet.
          </p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const b = badge[statusByCourse.get(c.id) ?? ""];

            return (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.slug}`}
                  className="flex h-full flex-col justify-between gap-3 rounded-xl border border-gray-200 border-t-[3px] border-t-[#D8BC7E] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold leading-snug text-[#101B2D]">
                        {c.title}
                      </h3>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          b
                            ? b.cls
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {b ? b.label : "Explore"}
                      </span>
                    </div>

                    {c.summary && (
                      <p className="text-sm text-[#647084]">
                        {c.summary}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-[#17253B]">
                      {c.price_ghs === null
                        ? "Price coming soon"
                        : c.price_ghs === 0
                          ? "Free"
                          : money(c.price_ghs)}
                    </p>

                    <p className="text-xs text-[#647084]">
                      {[
                        c.instructor_id
                          ? names[c.instructor_id]
                          : null,
                        c.duration,
                        c.format,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Instruments — coming soon */}
      <section className="space-y-4">
        <Banner
          src="/images/instruments-preview.jpg"
          alt="A piano, guitars, violin, drums and saxophone in a bright studio"
          title="Instruments"
          position="center"
          extra={
            <span className="mb-1 shrink-0 rounded-full bg-[#D8BC7E] px-3 py-1 text-xs font-semibold text-[#101B2D]">
              Coming soon
            </span>
          }
        />

        <p className="text-sm text-[#647084]">
          Instrument programmes are coming soon.
        </p>
      </section>
    </main>
  );
}
