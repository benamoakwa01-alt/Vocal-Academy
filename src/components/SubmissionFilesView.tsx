import type { AttachedFile } from "./FileAttachments";

function sizeLabel(b: number | null) {
  if (b === null) return "";
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function SubmissionFilesView({ files }: { files: AttachedFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-3">
      {files.map((f) => (
        <li key={f.path} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.filename}</p>
              <p className="text-xs text-gray-500">{sizeLabel(f.size_bytes)}</p>
            </div>
            {f.url && (
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                Open
              </a>
            )}
          </div>
          {f.url && f.mime_type?.startsWith("audio/") && <audio controls src={f.url} className="w-full" />}
          {f.url && f.mime_type?.startsWith("video/") && (
            <video controls playsInline preload="metadata" src={f.url} className="w-full rounded-lg bg-black" />
          )}
        </li>
      ))}
    </ul>
  );
}
