import type { SupabaseClient } from "@supabase/supabase-js";

// "Which cohort is this for?" on the new-assignment form. Cohorts are grouped by course.
export default async function CohortSelect({ supabase }: { supabase: SupabaseClient }) {
  const { data: kData } = await supabase
    .from("cohorts").select("id, name, course_id, status, starts_on")
    .neq("status", "cancelled").order("starts_on", { ascending: false });
  const cohorts = (kData ?? []) as { id: string; name: string; course_id: string }[];
  if (cohorts.length === 0) return null;

  const { data: cData } = await supabase
    .from("courses").select("id, title").in("id", [...new Set(cohorts.map((k) => k.course_id))]).order("title");
  const courses = (cData ?? []) as { id: string; title: string }[];

  return (
    <label className="block text-sm">Cohort (optional)
      <select name="cohort_id" defaultValue="" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black">
        <option value="">All cohorts of the course</option>
        {courses.map((c) => (
          <optgroup key={c.id} label={c.title}>
            {cohorts.filter((k) => k.course_id === c.id).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </optgroup>
        ))}
      </select>
      <span className="mt-1 block text-xs text-gray-500">
        Choose a cohort to give this assignment to that cohort only. The course is then taken from the cohort, so you do not need to match them.
      </span>
    </label>
  );
}
