import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createCourse, setPublished } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: courses } = await supabase
    .from("courses").select("id, title, slug, published").order("created_at", { ascending: true });
  const { data: tutors } = await supabase.from("tutor_names").select("id, full_name").order("full_name");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Manage courses</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>

        <ul className="space-y-2">
          {(courses ?? []).map((c: { id: string; title: string; slug: string; published: boolean }) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-gray-500">{c.published ? "Published" : "Draft (hidden from catalog)"}</p>
              </div>
              <form action={setPublished}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="published" value={c.published ? "false" : "true"} />
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                  {c.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={createCourse} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Add a course</h2>
          <input name="title" required placeholder="Course title" className={input} />
          <input name="summary" placeholder="One-line summary" className={input} />
          <textarea name="description" rows={3} placeholder="Description" className={input} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="duration" placeholder="Duration (e.g. 8 weeks)" className={input} />
            <input name="format" placeholder="Format (e.g. Live classes)" className={input} />
          </div>
          <textarea name="outcomes" rows={3} placeholder="What students will learn (one per line)" className={input} />
          <textarea name="curriculum" rows={3} placeholder="Curriculum modules (one per line)" className={input} />
          <select name="instructor_id" defaultValue="" className={input}>
            <option value="">No instructor yet</option>
            {(tutors ?? []).map((t: { id: string; full_name: string | null }) => (
              <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" /> Publish to the catalog now
          </label>
          {error && <p className="text-sm text-red-600">Couldn&apos;t save. Check the title is unique.</p>}
          <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Add course</button>
        </form>
      </div>
    </main>
  );
}
