import type { SupabaseClient } from "@supabase/supabase-js";

export type SubStatus = "todo" | "submitted" | "resubmitted" | "revision" | "reviewed";

export const STATUS: Record<SubStatus, { label: string; cls: string }> = {
  todo: { label: "Not submitted", cls: "bg-gray-100 text-gray-700" },
  submitted: { label: "Awaiting feedback", cls: "bg-blue-100 text-blue-800" },
  resubmitted: { label: "Resubmitted", cls: "bg-blue-100 text-blue-800" },
  revision: { label: "Revision requested", cls: "bg-amber-100 text-amber-800" },
  reviewed: { label: "Reviewed", cls: "bg-green-100 text-green-800" },
};

export function submissionStatus(
  sub?: { updated_at: string } | null,
  fb?: { updated_at: string; needs_revision: boolean } | null
): SubStatus {
  if (!sub) return "todo";
  if (!fb) return "submitted";
  if (new Date(sub.updated_at).getTime() > new Date(fb.updated_at).getTime()) return "resubmitted";
  return fb.needs_revision ? "revision" : "reviewed";
}

// Short-lived link, only requested after the database has already shown this person the row.
export async function signedAudioUrl(supabase: SupabaseClient, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
