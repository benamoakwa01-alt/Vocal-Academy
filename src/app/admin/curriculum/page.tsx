import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { addCourseSession, bulkCreateDays, deleteCourseSession, updateCourseSession } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; error?: string }>;
}) {
  const { course, error } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: courseData } = await supabase.from("courses").select("id, title").order("title");
  const courses = (courseData ?? []) as { id: string; title: string }[];
  const selected = courses.find((c) => c.id === course) ?? courses[0];

  const { data: sessionData } = selected
    ? await supabase.from("course_sessions")
        .select("id, day_number, title, objectives").eq("course_id", selected.id)
        .order("day_number", { ascending: true })
    : { data: [] };
  const sessions = (sessionData ?? []) as { id: string; day_number: number | null; title: string; objectives: string | null }[];

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Curriculum</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {courses.map((c) => (
            <Link key={c.id} href={`/admin/curriculum?course=${c.id}`}
              className={`rounded-full px-3 py-1.5 text-sm ${c.id === selected?.id ? "bg-black text-white" : "border border-gray-300 bg-white"}`}>
              {c.title}
            </Link>
          ))}
        </div>

        {selected && (
          <>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error === "exists" ? "That day number already exists for this course." : "Please check the values and try again."}
            </p>}

            <section className="space-y-3 rounded-xl bg-white p-4 shadow">
              <h2 className="font-semibold">Quick start</h2>
              <form action={bulkCreateDays} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="hidden" name="course_id" value={selected.id} />
                <span className="text-sm">Create days 1 to</span>
                <input name="count" type="number" min={1} max={200} defaultValue={30} className={`${input} sm:w-24`} />
                <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800">Create</button>
              </form>
              <p className="text-xs text-gray-500">Creates placeholder titles (Day 1, Day 2, and so on). Only missing days are added; existing days are kept. Rename them below.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Days ({sessions.length})</h2>
              {sessions.length === 0 && <p className="text-sm text-gray-500">No days yet.</p>}
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <form action={updateCourseSession} className="space-y-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="course_id" value={selected.id} />
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-sm font-semibold">Day {s.day_number ?? "–"}</span>
                        <input name="title" required defaultValue={s.title} className={input} />
                      </div>
                      <input name="objectives" defaultValue={s.objectives ?? ""} placeholder="Objectives (optional)" className={input} />
                      <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Save</button>
                    </form>
                    <form action={deleteCourseSession} className="mt-1">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="course_id" value={selected.id} />
                      <button className="text-xs text-red-600 underline">Delete day</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>

            <form action={addCourseSession} className="space-y-2 rounded-xl bg-white p-4 shadow">
              <h2 className="font-semibold">Add a single day</h2>
              <input type="hidden" name="course_id" value={selected.id} />
              <div className="grid gap-2 sm:grid-cols-4">
                <input name="day_number" type="number" min={1} required placeholder="Day #" className={input} />
                <input name="title" required placeholder="Title" className={`${input} sm:col-span-3`} />
              </div>
              <input name="objectives" placeholder="Objectives (optional)" className={input} />
              <button className="rounded-lg bg-black px-4 py-2.5 text-white hover:bg-gray-800">Add day</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
