import type { SupabaseClient } from "@supabase/supabase-js";

export async function tutorNames(supabase: SupabaseClient, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const result: Record<string, string> = {};
  if (!unique.length) return result;
  const { data } = await supabase.from("tutor_names").select("id, full_name").in("id", unique);
  for (const t of (data ?? []) as { id: string; full_name: string | null }[]) {
    result[t.id] = t.full_name ?? "Tutor";
  }
  return result;
}
