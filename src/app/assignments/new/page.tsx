import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { createAssignment } from "../actions";
import { myCourseIds } from "@/lib/team";

const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";
const errors: Record<string, string> = {
  missing: "Please choose a course and enter a title.",
  day: "That day does not belong to the course you chose.",
  denied: "You can only create assignments for courses you teach.",
};

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/assignments");

  const courseQuery = supabase.from("courses").select("id, title").order("title");
  const mine = profile.role === "admin" ? [] : await myCourseIds(supabase, user.id);
  const { data: courseData } = profile.role === "admin" ? await courseQuery : mine.length ? await courseQuery.in("id", mine) : { data: [] };
  const courses = (courseData ?? []) as { id: string; title: string }[];

  const { data: sessionData } = courses.length
    ? await supabase.from("course_sessions").select("id, course_id, day_number, title")
        .in("course_id", courses.map((c) => c.id)).order("day_number", { ascending: true })
    : { data: [] };
  const sessions = (sessionData ?? []) as { id: string; course_id: string; day_number: number | null; title: string }[];

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">New assignment</h1>
          <Link href="/assignments" className="text-sm underline">Back to assignments</Link>
        </div>

        {courses.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You are not the instructor of any course yet, so you cannot create assignments. Ask the admin to set you as a course instructor.
          </p>
        ) : (
          <form action={createAssignment} className="space-y-4 rounded-xl bg-white p-5 shadow">
            <label className="block text-sm">Course
              <select name="course_id" required defaultValue="" className={input}>
                <option value="" disabled>Choose a course...</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block text-sm">Day (optional)
              <select name="course_session_id" defaultValue="" className={input}>
                <option value="">Not tied to a day</option>
                {courses.map((c) => (
                  <optgroup key={c.id} label={c.title}>
                    {sessions.filter((s) => s.course_id === c.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.day_number ? `Day ${s.day_number}: ` : ""}{s.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block text-sm">Title
              <input name="title" required className={input} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">Due date and time (optional, Ghana time)
                <input name="due_at" type="datetime-local" className={input} />
              </label>
              <label className="block text-sm">Stop accepting work after (optional)
                <input name="closes_at" type="datetime-local" className={input} />
              </label>
            </div>
            <label className="block text-sm">Instructions
              <textarea name="instructions" rows={6} className={input} />
            </label>
            {error && <p className="text-sm text-red-600">{errors[error] ?? "Something went wrong."}</p>}
            <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Create assignment</button>
          </form>
        )}
      </div>
    </main>
  );
}
