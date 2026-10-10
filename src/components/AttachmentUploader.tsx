"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addAttachment } from "@/app/assignments/attachment-actions";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

export default function AttachmentUploader({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please log in again.");
      setBusy(false);
      return;
    }

    const problems: string[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 25 MB.`);
        continue;
      }
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${user.id}/${assignmentId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("assignment-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) {
        problems.push(`${file.name}: ${upErr.message}`);
        continue;
      }
      const res = await addAttachment({
        assignmentId, path, filename: file.name, mime: file.type || null, size: file.size,
      });
      if (!res.ok) problems.push(`${file.name} could not be attached. Only the course instructor or an admin can add files.`);
    }

    if (problems.length) setError(problems.join(" "));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="inline-block cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100">
        {busy ? "Uploading..." : "Add files"}
        <input type="file" multiple accept={ACCEPT} onChange={onChange} disabled={busy} className="hidden" />
      </label>
      <p className="text-xs text-gray-500">Audio, PDF, Word, PowerPoint, Excel, text or images. Up to 25 MB each.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
