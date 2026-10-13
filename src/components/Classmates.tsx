import type { SupabaseClient } from "@supabase/supabase-js";
import { Panel } from "@/components/ui";

function initials(name: string | null) {
  return (name ?? "S").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "S";
}

// People in the same cohort of the same course. Names only: no emails or other details.
export default async function Classmates({ supabase, courseId }: { supabase: SupabaseClient; courseId: string }) {
  const { data } = await supabase.rpc("cohort_classmates", { cid: courseId });
  const mates = (data ?? []) as { id: string; full_name: string | null }[];
  if (mates.length === 0) return null;
  return (
    <Panel title={`Your classmates (${mates.length})`}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {mates.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#101B2D] text-sm font-semibold text-[#D8BC7E]">
              {initials(m.full_name)}
            </span>
            <span className="truncate text-sm text-[#17253B]">{m.full_name ?? "Student"}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
