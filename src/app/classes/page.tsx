import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import ClassList from "@/components/ClassList";
import { EmptyState, PageHeader, Panel, btnPrimary } from "@/components/ui";

type Course = { id: string; title: string; slug: string };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course: filter } = await searchParams;
  const { supabase, profile } = await requireAccess();
  const isStaff = profile.role !== "student";
  const now = getNow();

  const { data } = await supabase.from("classes").select(CLASS_COLUMNS).order("starts_at", { ascending: true });
  const all = (data ?? []) as ClassRow[];

  const courseIds = [...new Set(all.map((c) => c.course_id).filter((x): x is string => !!x))];
  const { data: cData } = courseIds.length
    ? await supabase.from("courses").select("id, title, slug").in("id", courseIds)
    : { data: [] };
  const courses = (cData ?? []) as Course[];
  const names = await tutorNames(supabase, all.map((c) => c.tutor_id));

  const isUpcoming = (c: ClassRow) =>
    c.status === "live" || (c.status === "scheduled" && new Date(c.ends_at).getTime() >= now);

  const groups = courses.map((c) => ({
    key: c.id, title: c.title, href: isStaff ? `/courses/${c.slug}` : `/my-courses/${c.slug}`,
    classes: all.filter((x) => x.course_id === c.id),
  }));
  const individual = all.filter((c) => !c.course_id);
  if (individual.length) groups.push({ key: "none", title: "Individual classes", href: "", classes: individual });
  groups.sort((a, b) => {
    const ua = a.classes.some(isUpcoming) ? 0 : 1;
    const ub = b.classes.some(isUpcoming) ? 0 : 1;
    return ua - ub || a.title.localeCompare(b.title);
  });
  const shown = filter ? groups.filter((g) => g.key === filter) : groups;

  const pillBase = "rounded-full border px-3 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={isStaff ? "Classes" : "My classes"}
        description="Grouped by course."
        actions={isStaff ? <Link href="/classes/new" className={btnPrimary}>Schedule a class</Link> : undefined}
      />

      {groups.length > 1 && (
        <nav aria-label="Filter by course" className="flex flex-wrap gap-2">
          <Link href="/classes" className={`${pillBase} ${!filter ? "border-[#101B2D] bg-[#101B2D] text-white" : "border-gray-300 bg-white text-[#17253B]"}`}>All</Link>
          {groups.map((g) => (
            <Link key={g.key} href={`/classes?course=${g.key}`}
              className={`${pillBase} ${filter === g.key ? "border-[#101B2D] bg-[#101B2D] text-white" : "border-gray-300 bg-white text-[#17253B]"}`}>
              {g.title}
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 && (
        <EmptyState title="No classes yet"
          text={isStaff ? "Schedule a class to get started." : "When a class is scheduled for you, it appears here, grouped by course."}
          href={isStaff ? "/classes/new" : "/my-courses"} cta={isStaff ? "Schedule a class" : "My courses"} />
      )}

      {shown.map((g) => {
        const up = g.classes.filter(isUpcoming);
        const past = g.classes.filter((c) => !isUpcoming(c)).reverse();
        return (
          <Panel key={g.key} title={g.title}
            action={g.href ? <Link href={g.href} className="text-sm font-medium text-[#101B2D] underline">{isStaff ? "Course page" : "Open course"}</Link> : undefined}>
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#17253B]">Upcoming ({up.length})</h3>
                <ClassList classes={up} names={names} now={now} empty="No upcoming classes." />
              </div>
              {past.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-[#17253B]">Past classes ({past.length})</summary>
                  <div className="mt-2"><ClassList classes={past} names={names} now={now} empty="" /></div>
                </details>
              )}
            </div>
          </Panel>
        );
      })}
    </main>
  );
}
