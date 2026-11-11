"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Info = { state: string; percent: number; error?: string };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Prepares the faster copy in the background while the standard version plays, and offers the switch when it is ready
export default function DrivePreparer({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      for (let i = 0; i < 500 && !stop; i++) {
        let next: Info;
        try {
          const res = await fetch("/api/drive/advance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingId }),
          });
          next = (await res.json()) as Info;
        } catch {
          await wait(5000);
          continue;
        }
        if (stop) return;
        setInfo(next);
        if (["ready", "off", "skipped", "error"].includes(next.state)) return;
        await wait(next.state === "processing" ? 6000 : 1500);
      }
    })();
    return () => {
      stop = true;
    };
  }, [recordingId]);

  if (!info || info.state === "off" || info.state === "skipped") return null;

  if (info.state === "ready") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">
        <span>The faster version is ready.</span>
        <button onClick={() => router.refresh()} className="rounded-lg bg-green-700 px-3 py-1.5 font-medium text-white hover:bg-green-800">
          Switch to it
        </button>
      </div>
    );
  }
  if (info.state === "error") {
    return (
      <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#647084]">
        A faster version could not be prepared{info.error ? ` (${info.error})` : ""}. The standard version above still works.
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      {info.state === "processing"
        ? "Google is getting the video ready for streaming. This takes a few minutes."
        : `Preparing a faster version: ${info.percent}%. You can keep watching meanwhile.`}
    </p>
  );
}
