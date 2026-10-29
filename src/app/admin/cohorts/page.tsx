import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createCohort } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";
const errors: Record<string, string> = {
  invalid: "Please fill in every field.",
  weekend: "The start date must be a weekday (Monday to Friday).",
  failed: "Couldn't create the cohort.",
  team: "That tutor is not on this course's teaching team. Add them to the team first.",
};

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const { error, detail } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: cohortData } = await supabase
    .from("cohorts").select("id, name, status, starts_on, session_time, courses(title)")
    .order("starts_on", { ascending: false });
  const cohorts = (cohortData ?? []) as unknown as {
    id: string; name: string; status: string; starts_on: string; session_time: string; courses: { title: string } | null;
  }[];

  const { data: courses } = await supabase.from("courses").select("id, title").order("title");
  const { data: tutors } = await supabase.from("tutor_names").select("id, full_name").order("full_name");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cohorts</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <ul className="space-y-2">
          {cohorts.length === 0 && <p className="text-sm text-gray-500">No cohorts yet.</p>}
          {cohorts.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cohorts/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-600">
                    {c.courses?.title} · starts {c.starts_on} · {c.session_time.slice(0, 5)} Ghana time
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs capitalize">{c.status}</span>
              </Link>
            </li>
          ))}
        </ul>

        <form action={createCohort} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Create a cohort</h2>
          <input name="name" required placeholder="Cohort name (e.g. 30:15 · January 2027)" className={input} />
          <select name="course_id" required defaultValue="" className={input}>
            <option value="" disabled>Course…</option>
            {(courses ?? []).map((c: { id: string; title: string }) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select name="tutor_id" defaultValue="" className={input}>
            <option value="">No tutor yet</option>
            {(tutors ?? []).map((t: { id: string; full_name: string | null }) => (
              <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">First day (weekday)
              <input type="date" name="starts_on" required className={`${input} mt-1`} />
            </label>
            <label className="text-sm">Time (Ghana time)
              <input type="time" name="session_time" required className={`${input} mt-1`} />
            </label>
            <label className="text-sm">Minutes
              <input type="number" name="session_minutes" min={1} defaultValue={15} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-sm">Holidays to skip (optional, one date per line, YYYY-MM-DD)
            <textarea name="skip_dates" rows={2} className={`${input} mt-1`} />
          </label>
          {error && <p className="text-sm text-red-600">{errors[error] ?? "Something went wrong."}{detail ? ` (${detail})` : ""}</p>}
          <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Create cohort</button>
        </form>
      </div>
    </main>
  );
}
