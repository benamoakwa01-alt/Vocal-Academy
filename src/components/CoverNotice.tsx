import type { SupabaseClient } from "@supabase/supabase-js";
import { tutorNames } from "@/lib/people";

// Shown when a class has been handed to a different tutor than first planned
export default async function CoverNotice({
  supabase, classId, showNote = false,
}: {
  supabase: SupabaseClient;
  classId: string;
  showNote?: boolean;
}) {
  const { data: c } = await supabase
    .from("classes").select("tutor_id, original_tutor_id, cover_note").eq("id", classId).maybeSingle();
  if (!c?.original_tutor_id || !c.tutor_id) return null;
  const names = await tutorNames(supabase, [c.tutor_id, c.original_tutor_id]);
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      {names[c.tutor_id] ?? "A tutor"} is teaching this lesson in place of {names[c.original_tutor_id] ?? "the usual tutor"}.
      {showNote && c.cover_note ? ` Reason: ${c.cover_note}` : ""}
    </p>
  );
}
