import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { addLesson, deleteLesson, setLessonCourse } from "./actions";

const errors: Record<string, string> = {
  title: "Please enter a title.",
  link: "That doesn't look like a YouTube or Vimeo link.",
  course: "Please choose one of your courses.",
  denied: "You don't have permission to add a lesson to that course.",
};

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  const isAdmin = profile.role === "admin";
  const isStaff = profile.role !== "student";

  const { data: courseData } = await supabase
    .from("courses").select("id, title, instructor_id").order("title");
  const allCourses = (courseData ?? []) as { id: string; title: string; instructor_id: string | null }[];
  const titleById = new Map(allCourses.map((c) => [c.id, c.title]));
  const assignable = isAdmin ? allCourses : allCourses.filter((c) => c.instructor_id === user.id);

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, description, created_by, course_id")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lessons</h1>
          <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
        </div>

        {isStaff && (
          <form action={addLesson} className="space-y-3 rounded-xl bg-white p-4 shadow">
            <h2 className="font-semibold">Add a lesson</h2>
            <input name="title" required placeholder="Lesson title" className={input} />
            <input name="video_url" required placeholder="YouTube or Vimeo link" className={input} />
            <select name="course_id" defaultValue="" className={input}>
              <option value="">{isAdmin ? "No course (staff only)" : "Choose a course…"}</option>
              {assignable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <textarea name="description" rows={2} placeholder="Short description (optional)" className={input} />
            {error && <p className="text-sm text-red-600">{errors[error] ?? "Something went wrong."}</p>}
            <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">Add lesson</button>
          </form>
        )}

        <ul className="space-y-3">
          {(lessons ?? []).length === 0 && <p className="text-sm text-gray-500">No lessons yet.</p>}
          {(lessons ?? []).map((l: { id: string; title: string; description: string | null; created_by: string | null; course_id: string | null }) => {
            const canEdit = isAdmin || l.created_by === user.id;
            return (
              <li key={l.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/lessons/${l.id}`} className="flex-1">
                    <p className="font-medium">{l.title}</p>
                    {l.description && <p className="text-sm text-gray-600">{l.description}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {l.course_id ? titleById.get(l.course_id) ?? "Course" : "Not assigned to a course (staff only)"}
                    </p>
                  </Link>
                  {canEdit && (
                    <form action={deleteLesson}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Delete</button>
                    </form>
                  )}
                </div>
                {canEdit && (
                  <form action={setLessonCourse} className="flex gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="course_id" defaultValue={l.course_id ?? ""} className="flex-1 rounded-lg border border-gray-300 bg-white p-2 text-sm text-black">
                      <option value="">{isAdmin ? "No course (staff only)" : "Choose a course…"}</option>
                      {assignable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">Save course</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
