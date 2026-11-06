import type { SupabaseClient } from "@supabase/supabase-js";
import { setAssignmentCohort } from "@/app/assignments/audience-actions";
import { Panel, btnSecondary } from "@/components/ui";

export default async function AudiencePanel({ supabase, assignmentId }: { supabase: SupabaseClient; assignmentId: string }) {
  const { data: a } = await supabase.from("assignments").select("course_id, cohort_id").eq("id", assignmentId).maybeSingle();
  if (!a) return null;
  const { data } = await supabase
    .from("cohorts").select("id, name").eq("course_id", a.course_id).neq("status", "cancelled").order("starts_on", { ascending: false });
  const cohorts = (data ?? []) as { id: string; name: string }[];

  return (
    <Panel title="Who gets this assignment">
      <form action={setAssignmentCohort} className="space-y-3">
        <input type="hidden" name="assignment_id" value={assignmentId} />
        <select name="cohort_id" defaultValue={a.cohort_id ?? ""} aria-label="Cohort"
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]">
          <option value="">All cohorts of this course</option>
          {cohorts.map((k) => <option key={k.id} value={k.id}>{k.name} only</option>)}
        </select>
        <button className={btnSecondary}>Save</button>
        <p className="text-xs text-[#647084]">
          Only the chosen cohort sees this assignment, gets reminders about it, and has it counted in their grade. Work already handed in stays on record.
        </p>
      </form>
    </Panel>
  );
}
