import type { SupabaseClient } from "@supabase/supabase-js";
import { toInputValue } from "@/lib/due";
import { Panel } from "@/components/ui";
import DueDateForm from "./DueDateForm";

export default async function DueDatePanel({ supabase, assignmentId }: { supabase: SupabaseClient; assignmentId: string }) {
  const { data: a } = await supabase.from("assignments").select("due_at, closes_at").eq("id", assignmentId).maybeSingle();
  return (
    <Panel title="Due date">
      <DueDateForm assignmentId={assignmentId} dueAt={toInputValue(a?.due_at ?? null)} closesAt={toInputValue(a?.closes_at ?? null)} />
    </Panel>
  );
}
