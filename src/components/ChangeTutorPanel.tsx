import type { SupabaseClient } from "@supabase/supabase-js";
import { changeClassTutor } from "@/app/classes/cover-actions";
import { tutorNames } from "@/lib/people";
import { teamMemberIds } from "@/lib/team";
import { Panel, btnPrimary, btnSecondary } from "@/components/ui";

const field = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";

// Who is teaching a class that has not started, and how to cover or hand it over
export default async function ChangeTutorPanel({
  supabase, classId, courseId, currentTutorId, userId, isAdmin,
}: {
  supabase: SupabaseClient;
  classId: string;
  courseId: string | null;
  currentTutorId: string | null;
  userId: string;
  isAdmin: boolean;
}) {
  if (!courseId) return null;
  const team = await teamMemberIds(supabase, courseId);
  const names = await tutorNames(supabase, [...team, currentTutorId, userId]);
  const others = team.filter((id) => id !== currentTutorId);
  const canTakeOver = userId !== currentTutorId && (isAdmin || team.includes(userId));

  return (
    <Panel title="Who is teaching">
      <div className="space-y-4">
        <p className="text-sm text-[#17253B]">
          Teaching this class: <strong>{currentTutorId ? names[currentTutorId] ?? "A tutor" : "No tutor yet"}</strong>
        </p>

        {canTakeOver && (
          <form action={changeClassTutor} className="space-y-1">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="tutor_id" value={userId} />
            <button className={btnPrimary}>I will cover this class</button>
            <p className="text-xs text-[#647084]">Use this when the usual tutor cannot make it. The students and both tutors are told.</p>
          </form>
        )}

        {others.length > 0 ? (
          <form action={changeClassTutor} className="space-y-2">
            <input type="hidden" name="class_id" value={classId} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">Hand over to
                <select name="tutor_id" required defaultValue="" className={`${field} mt-1`}>
                  <option value="" disabled>Choose a tutor...</option>
                  {others.map((id) => <option key={id} value={id}>{names[id] ?? "Tutor"}</option>)}
                </select>
              </label>
              <label className="block text-sm">Reason (optional, only staff see it)
                <input name="note" maxLength={200} className={`${field} mt-1`} />
              </label>
            </div>
            <button className={btnSecondary}>Hand over this class</button>
          </form>
        ) : (
          <p className="text-sm text-[#647084]">No other tutor is on this course&apos;s teaching team yet.</p>
        )}

        {isAdmin && (
          <a href={`/admin/courses/${courseId}/team`} className="inline-block text-sm font-medium text-[#101B2D] underline">
            Manage the teaching team
          </a>
        )}
      </div>
    </Panel>
  );
}
