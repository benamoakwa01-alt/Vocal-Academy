import type { SupabaseClient } from "@supabase/supabase-js";
import AttachmentUploader from "./AttachmentUploader";
import ConfirmButton from "./ConfirmButton";
import { removeAttachment } from "@/app/assignments/attachment-actions";

type F = { id: string; path: string; filename: string; mime_type: string | null; size_bytes: number | null };

function sizeLabel(b: number | null) {
  if (b === null) return "";
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default async function AttachmentList({
  supabase, assignmentId, canManage,
}: {
  supabase: SupabaseClient;
  assignmentId: string;
  canManage: boolean;
}) {
  const { data } = await supabase
    .from("assignment_files")
    .select("id, path, filename, mime_type, size_bytes")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  const files = (data ?? []) as F[];
  if (files.length === 0 && !canManage) return null;

  const urls = await Promise.all(
    files.map(async (f) => {
      const { data: s } = await supabase.storage.from("assignment-files").createSignedUrl(f.path, 3600);
      return s?.signedUrl ?? null;
    })
  );

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold">Materials</h2>
      {files.length === 0 && <p className="text-sm text-gray-500">No files attached yet.</p>}
      <ul className="space-y-3">
        {files.map((f, i) => (
          <li key={f.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.filename}</p>
                <p className="text-xs text-gray-500">{sizeLabel(f.size_bytes)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {urls[i] && (
                  <a href={urls[i]!} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                    Open
                  </a>
                )}
                {canManage && (
                  <form action={removeAttachment}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="assignment_id" value={assignmentId} />
                    <ConfirmButton label="Remove" message="Remove this file from the assignment?"
                      className="text-sm text-red-600 underline" />
                  </form>
                )}
              </div>
            </div>
            {urls[i] && f.mime_type?.startsWith("audio/") && <audio controls src={urls[i]!} className="w-full" />}
            {urls[i] && f.mime_type?.startsWith("video/") && (
              <video controls playsInline preload="metadata" src={urls[i]!} className="w-full rounded-lg bg-black" />
            )}
          </li>
        ))}
      </ul>
      {canManage && <AttachmentUploader assignmentId={assignmentId} />}
    </section>
  );
}
