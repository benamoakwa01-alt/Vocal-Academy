"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AttachedFile = {
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  url: string | null;
  isNew?: boolean;
};

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPT = "audio/*,video/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

function sizeLabel(b: number | null) {
  if (b === null) return "";
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function FileAttachments({
  folder, initial, onBusyChange,
}: {
  folder: string;
  initial: AttachedFile[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<AttachedFile[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    if (files.length + picked.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please log in again.");
      setBusy(false);
      onBusyChange?.(false);
      return;
    }

    const added: AttachedFile[] = [];
    const problems: string[] = [];
    for (const file of picked) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 50 MB.`);
        continue;
      }
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${user.id}/${folder}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("submissions")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) {
        problems.push(`${file.name}: ${upErr.message}`);
        continue;
      }
      added.push({
        path, filename: file.name, mime_type: file.type || null, size_bytes: file.size,
        url: URL.createObjectURL(file), isNew: true,
      });
    }
    setFiles((prev) => [...prev, ...added]);
    if (problems.length) setError(problems.join(" "));
    setBusy(false);
    onBusyChange?.(false);
  }

  async function remove(f: AttachedFile) {
    if (f.isNew) await createClient().storage.from("submissions").remove([f.path]);
    setFiles((prev) => prev.filter((x) => x.path !== f.path));
  }

  const json = JSON.stringify(
    files.map(({ path, filename, mime_type, size_bytes }) => ({ path, filename, mime_type, size_bytes }))
  );

  return (
    <div className="space-y-2">
      <p className="text-sm">Files (documents, video, images or audio)</p>
      <input type="hidden" name="files_json" value={json} />
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.filename}</p>
                <p className="text-xs text-gray-500">{sizeLabel(f.size_bytes)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open</a>
                )}
                <button type="button" onClick={() => remove(f)} className="text-sm text-red-600 underline">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-block cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100">
        {busy ? "Uploading..." : "Add files"}
        <input type="file" multiple accept={ACCEPT} onChange={onChange} disabled={busy} className="hidden" />
      </label>
      <p className="text-xs text-gray-500">Up to 10 files, 50 MB each. Large videos can take a while to upload.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
