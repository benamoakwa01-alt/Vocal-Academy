"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 25 * 1024 * 1024;

function extFor(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "audio";
}

export default function AudioRecorder({
  name, folder, label, initialPath = "", initialUrl = null, onBusyChange,
}: {
  name: string;
  folder: string;
  label: string;
  initialPath?: string;
  initialUrl?: string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  async function upload(blob: Blob, mime: string) {
    setBusyState(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please log in again.");
      setBusyState(false);
      return;
    }
    const clean = mime.split(";")[0] || "audio/webm";
    const p = `${user.id}/${folder}/${Date.now()}.${extFor(clean)}`;
    const { error: upErr } = await supabase.storage.from("submissions").upload(p, blob, { contentType: clean });
    if (upErr) {
      setError("The upload failed: " + upErr.message);
    } else {
      setPath(p);
      setPreviewUrl(URL.createObjectURL(blob));
    }
    setBusyState(false);
  }

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser. Choose a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > MAX_BYTES) {
          setError("That recording is too large. The limit is 25 MB.");
          return;
        }
        void upload(blob, type);
      };
      rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("We could not use your microphone. Allow microphone access in your browser, or choose a file instead.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That file is too large. The limit is 25 MB.");
      return;
    }
    void upload(file, file.type || "audio/mpeg");
  }

  function clear() {
    setPath("");
    setPreviewUrl(null);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const btn = "rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <p className="text-sm">{label}</p>
      <input type="hidden" name={name} value={path} />

      {previewUrl && !recording && <audio controls src={previewUrl} className="w-full" />}

      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <button type="button" onClick={start} disabled={busy} className={btn}>
            {previewUrl ? "Record again" : "Record"}
          </button>
        ) : (
          <button type="button" onClick={stop} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">
            Stop ({mm}:{ss})
          </button>
        )}
        {!recording && (
          <label className={`${btn} cursor-pointer`}>
            Choose a file
            <input type="file" accept="audio/*" onChange={onFile} className="hidden" />
          </label>
        )}
        {previewUrl && !recording && (
          <button type="button" onClick={clear} disabled={busy} className="text-sm text-red-600 underline">Remove</button>
        )}
        {busy && <span className="text-sm text-gray-600">Uploading...</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
