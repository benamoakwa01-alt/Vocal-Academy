import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { CLASS_COLUMNS, getNow, type ClassRow } from "@/lib/classes";
import { tutorNames } from "@/lib/people";
import ClassList from "@/components/ClassList";

export default async function ClassesPage() {
  const { supabase, profile } = await requireAccess();
  const isStaff = profile.role !== "student";
  const now = getNow();

  const { data } = await supabase
    .from("classes").select(CLASS_COLUMNS).order("starts_at", { ascending: true });
  const all = (data ?? []) as ClassRow[];

  const isUpcoming = (c: ClassRow) =>
    c.status === "live" || (c.status === "scheduled" && new Date(c.ends_at).getTime() >= now);
  const upcoming = all.filter(isUpcoming);
  const past = all.filter((c) => !isUpcoming(c)).reverse();
  const names = await tutorNames(supabase, all.map((c) => c.tutor_id));

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{isStaff ? "Classes" : "My classes"}</h1>
          <div className="flex items-center gap-3">
            {isStaff && (
              <Link href="/classes/new" className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
                Schedule class
              </Link>
            )}
            <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <ClassList classes={upcoming} names={names} now={now} empty="No upcoming classes." />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Past</h2>
          <ClassList classes={past} names={names} now={now} empty="No past classes yet." />
        </section>
      </div>
    </main>
  );
}
