import type { SupabaseClient } from "@supabase/supabase-js";
import { saveAttendance } from "@/app/classes/attendance-actions";
import { Panel, btnPrimary } from "@/components/ui";

export default async function AttendanceRegister({
  supabase, classId, courseId, cohortId, status,
}: {
  supabase: SupabaseClient;
  classId: string;
  courseId: string | null;
  cohortId: string | null;
  status: string;
}) {
  if (status !== "live" && status !== "completed") return null;

  const ids = new Set<string>();
  const { data: assigned } = await supabase.from("class_students").select("student_id").eq("class_id", classId);
  for (const r of (assigned ?? []) as { student_id: string }[]) ids.add(r.student_id);

  const base = supabase.from("enrollments").select("student_id").in("status", ["active", "completed"]);
  const { data: enrolled } = cohortId
    ? await base.eq("cohort_id", cohortId)
    : courseId
      ? await base.eq("course_id", courseId)
      : { data: [] };
  for (const r of (enrolled ?? []) as { student_id: string }[]) ids.add(r.student_id);

  const { data: att } = await supabase.from("attendance").select("student_id, status").eq("class_id", classId);
  const current = new Map(
    ((att ?? []) as { student_id: string; status: string }[]).map((a) => [a.student_id, a.status === "excused" ? "excused" : "present"])
  );

  const { data: pData } = ids.size
    ? await supabase.from("profiles").select("id, full_name, email").in("id", [...ids])
    : { data: [] };
  const people = ((pData ?? []) as { id: string; full_name: string | null; email: string | null }[])
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  if (people.length === 0) return null;

  return (
    <Panel title="Attendance register">
      <form action={saveAttendance} className="space-y-3">
        <input type="hidden" name="class_id" value={classId} />
        <p className="text-sm text-[#647084]">
          Anyone who joined the classroom shows as Present. Change it if needed, for example after a connection problem.
          Choose Excused to leave this class out of a student attendance score.
        </p>
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <input type="hidden" name="student_id" value={p.id} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-[#17253B]">{p.full_name ?? "No name"}</span>
                <span className="block truncate text-xs text-[#647084]">{p.email}</span>
              </span>
              <select name={`s_${p.id}`} defaultValue={current.get(p.id) ?? "absent"} aria-label={`Attendance for ${p.full_name ?? "student"}`}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </li>
          ))}
        </ul>
        <button className={btnPrimary}>Save attendance</button>
      </form>
    </Panel>
  );
}
