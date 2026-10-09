import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import ClassForm from "@/components/ClassForm";

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const isAdmin = profile.role === "admin";

  const courseQuery = supabase.from("courses").select("id, title").order("title");
  const { data: courses } = isAdmin ? await courseQuery : await courseQuery.eq("instructor_id", user.id);

  const { data: tutors } = isAdmin
    ? await supabase.from("tutor_names").select("id, full_name").order("full_name")
    : { data: [] };

  // RLS limits tutors to students in their own courses or classes.
  const { data: students } = await supabase
    .from("profiles").select("id, full_name, email")
    .eq("role", "student").eq("approved", true).order("full_name");

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Schedule a class</h1>
          <Link href="/classes" className="text-sm underline">Back to classes</Link>
        </div>
        {!isAdmin && (courses ?? []).length === 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You aren&apos;t the instructor of any course yet. You can still schedule individual classes for students assigned to you.
            Ask the admin to set you as a course instructor.
          </p>
        )}
        <ClassForm
          courses={courses ?? []}
          tutors={tutors ?? []}
          students={students ?? []}
          isAdmin={isAdmin}
          selfId={user.id}
          error={error}
        />
      </div>
    </main>
  );
}
