import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { updateCourse } from "./actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function EditCoursePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();
  const { data: tutors } = await supabase.from("tutor_names").select("id, full_name").order("full_name");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/courses" className="text-sm underline">All courses</Link>
          <Link href={`/courses/${course.slug}`} className="text-sm underline">View as student</Link>
        </div>

        <h1 className="text-2xl font-bold">Edit course</h1>
        {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Saved.</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error === "title" ? "Please enter a title." : error === "price" ? "Enter the price as a number, for example 100." : "Could not save. Please try again."}
        </p>}

        <form action={updateCourse} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <input type="hidden" name="id" value={course.id} />
          <label className="block text-sm">Title
            <input name="title" required defaultValue={course.title} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm">One-line summary
            <input name="summary" defaultValue={course.summary ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm">Description
            <textarea name="description" rows={5} defaultValue={course.description ?? ""} className={`${input} mt-1`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Duration
              <input name="duration" defaultValue={course.duration ?? ""} className={`${input} mt-1`} />
            </label>
            <label className="block text-sm">Format
              <input name="format" defaultValue={course.format ?? ""} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-sm">Price in GHS (leave empty until you are ready to open enrollment; 0 = free)
            <input name="price" type="number" step="0.01" min="0" defaultValue={course.price_ghs ?? ""} className={`${input} mt-1 sm:w-48`} />
          </label>
          <label className="block text-sm">What students will learn (one per line)
            <textarea name="outcomes" rows={5} defaultValue={(course.outcomes ?? []).join("\n")} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm">Curriculum (one line each: Duration, Schedule and Session Length lines, then Module and Lesson lines. Optional: a Summary line directly under a Module line)
            <textarea name="curriculum" rows={5} defaultValue={(course.curriculum ?? []).join("\n")} className={`${input} mt-1`} />
          </label>
          <a href={`/admin/courses/${course.id}/team`} className="inline-block text-sm font-medium text-[#101B2D] underline">Manage the teaching team and topic tutors</a>
          <label className="block text-sm">Keep recordings for (days after the last class)
            <input name="retention_days" type="number" min={0} defaultValue={course.recording_retention_days ?? ""} className={`${input} mt-1 sm:w-48`} />
            <span className="mt-1 block text-xs text-[#647084]">Leave empty to keep recordings forever. Recommended: 30. Removed recordings go to the trash for 14 days first.</span>
          </label>
          <label className="block text-sm">Instructor
            <select name="instructor_id" defaultValue={course.instructor_id ?? ""} className={`${input} mt-1`}>
              <option value="">No instructor</option>
              {(tutors ?? []).map((t: { id: string; full_name: string | null }) => (
                <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" defaultChecked={course.published} /> Published in the catalog
          </label>
          <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Save changes</button>
        </form>

        <p className="text-sm text-gray-600">
          The day-by-day lesson titles are edited under <Link href={`/admin/curriculum?course=${course.id}`} className="underline">Curriculum</Link>.
        </p>
      </div>
    </main>
  );
}
