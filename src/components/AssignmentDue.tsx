import type { SupabaseClient } from "@supabase/supabase-js";
import { getNow } from "@/lib/classes";
import { describeDue, formatWhen } from "@/lib/due";

const tone: Record<string, string> = {
  none: "",
  upcoming: "border-gray-200 bg-white text-[#17253B]",
  soon: "border-amber-300 bg-amber-50 text-amber-900",
  overdue: "border-red-200 bg-red-50 text-red-800",
  closed: "border-gray-300 bg-gray-100 text-[#17253B]",
};

// The due date, whether work is still being accepted, and the late penalty if the course has one
export default async function AssignmentDue({ supabase, assignmentId }: { supabase: SupabaseClient; assignmentId: string }) {
  const { data: a } = await supabase.from("assignments").select("due_at, closes_at, course_id").eq("id", assignmentId).maybeSingle();
  if (!a || (!a.due_at && !a.closes_at)) return null;
  const { data: s } = await supabase.from("grading_schemes").select("late_penalty").eq("course_id", a.course_id).maybeSingle();
  const penalty = Number(s?.late_penalty ?? 0);
  const info = describeDue(a.due_at, a.closes_at, getNow());

  return (
    <div className={`space-y-1 rounded-xl border p-4 text-sm ${tone[info.state]}`}>
      <p className="font-semibold">{info.label}</p>
      {a.closes_at && info.state !== "closed" && <p>Work is accepted until {formatWhen(a.closes_at)}.</p>}
      {a.due_at && penalty > 0 && <p>Work handed in after the due time loses {penalty} {penalty === 1 ? "point" : "points"}.</p>}
      <p className="text-xs opacity-80">All times are Ghana time.</p>
    </div>
  );
}
