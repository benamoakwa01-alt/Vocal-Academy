import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachedFile } from "@/components/FileAttachments";

export async function loadSubmissionFiles(supabase: SupabaseClient, submissionId: string): Promise<AttachedFile[]> {
  const { data } = await supabase
    .from("submission_files")
    .select("path, filename, mime_type, size_bytes")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { path: string; filename: string; mime_type: string | null; size_bytes: number | null }[];
  return Promise.all(
    rows.map(async (r) => {
      const { data: s } = await supabase.storage.from("submissions").createSignedUrl(r.path, 3600);
      return { ...r, url: s?.signedUrl ?? null };
    })
  );
}
