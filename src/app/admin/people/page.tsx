import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { assignInstructor, promoteToTutor, removeTutor } from "./actions";

type P = { id: string; full_name: string | null; email: string | null; role: string };
const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function PeoplePage() {
  const { supabase } = await requireAdmin();

  const { data: people } = await supabase
    .from("profiles").select("id, full_name, email, role").order("full_name");
  const { data: courses } = await supabase
    .from("courses").select("id, title, instructor_id").order("title");

  const all = (people ?? []) as P[];
  const tutors = all.filter((p) => p.role === "tutor");
  const students = all.filter((p) => p.role === "student");
  const instructors = all.filter((p) => p.role !== "student");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">People &amp; tutors</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Add a tutor</h2>
          <p className="text-sm text-gray-600">
            Ask the tutor to create an account at your site&apos;s sign-up page first. Then choose them here.
          </p>
          <form action={promoteToTutor} className="flex flex-col gap-3 sm:flex-row">
            <select name="id" required defaultValue="" className={input}>
              <option value="" disabled>Choose a signed-up user…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"} ({s.email})</option>
              ))}
            </select>
            <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800 sm:whitespace-nowrap">Make tutor</button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tutors ({tutors.length})</h2>
          {tutors.length === 0 && <p className="text-sm text-gray-500">No tutors yet.</p>}
          <ul className="space-y-2">
            {tutors.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div>
                  <p className="font-medium">{t.full_name ?? "Unnamed"}</p>
                  <p className="text-sm text-gray-600">{t.email}</p>
                </div>
                <form action={removeTutor}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Remove tutor role</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Course instructors</h2>
          <ul className="space-y-2">
            {(courses ?? []).map((c: { id: string; title: string; instructor_id: string | null }) => (
              <li key={c.id}>
                <form action={assignInstructor} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
                  <input type="hidden" name="course_id" value={c.id} />
                  <p className="flex-1 font-medium">{c.title}</p>
                  <select name="tutor_id" defaultValue={c.instructor_id ?? ""} className="rounded-lg border border-gray-300 bg-white p-2 text-sm text-black">
                    <option value="">No instructor</option>
                    {instructors.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                    ))}
                  </select>
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Save</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
