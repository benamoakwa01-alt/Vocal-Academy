"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Crops to a 4:5 portrait (a little biased toward the top so faces are not cut) and shrinks it before uploading
async function prepare(file: File, w = 800, h = 1000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.max(w / bmp.width, h / bmp.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (bmp.width - sw) / 2;
  const sy = Math.max(0, (bmp.height - sh) * 0.25);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the photo.");
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo."))), "image/jpeg", 0.85)
  );
}

export default function TutorPhotoField({
  tutorId, initialPath, initialUrl,
}: {
  tutorId: string;
  initialPath: string;
  initialUrl: string | null;
}) {
  const [path, setPath] = useState(initialPath);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await prepare(file);
      const p = `${tutorId}/photo-${Date.now()}.jpg`;
      const { error: upErr } = await createClient().storage.from("tutor-photos").upload(p, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      setPath(p);
      setUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">Portrait photo</p>
      <input type="hidden" name="photo_path" value={path} />
      <div className="flex items-center gap-4">
        <div className="h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-[#101B2D]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Your portrait" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-xs text-[#D8BC7E]">No photo yet</span>
          )}
        </div>
        <div className="space-y-2">
          <label className="inline-block cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
            {busy ? "Uploading..." : url ? "Change photo" : "Choose a photo"}
            <input type="file" accept="image/*" onChange={onFile} disabled={busy} className="hidden" />
          </label>
          <p className="text-xs text-[#647084]">A clear upright portrait in good light. It is cropped to 4:5 automatically.</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
