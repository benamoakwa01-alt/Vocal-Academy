"use client";
import { useEffect, useRef, useState } from "react";

type Line = { t: number; text: string };
const EVENTS = ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing", "waiting", "stalled", "ended", "error"];

const seconds = (d: number) => (Number.isFinite(d) ? `${d.toFixed(1)}s` : String(d));
const loaded = (v: HTMLVideoElement) => (v.buffered.length ? `${v.buffered.end(v.buffered.length - 1).toFixed(1)}s` : "0s");

// Plays a recording and writes down what the browser does and when, to show why a video is slow to start
export default function PlaybackTest({ src }: { src: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<"metadata" | "auto">("metadata");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function log(text: string) {
    setLines((l) => [...l.slice(-199), { t: Math.round(performance.now() - started.current), text }]);
  }

  function stop() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (video.current) {
      video.current.pause();
      video.current.removeAttribute("src");
      video.current.load();
    }
    setRunning(false);
  }

  function start() {
    stop();
    setLines([]);
    const v = document.createElement("video");
    v.controls = true;
    v.playsInline = true;
    v.preload = mode;
    v.className = "w-full rounded-xl bg-black";
    holder.current?.replaceChildren(v);
    video.current = v;
    started.current = performance.now();

    const state = () => `length ${seconds(v.duration)}, loaded ${loaded(v)}, ready ${v.readyState}`;
    for (const ev of EVENTS) v.addEventListener(ev, () => log(`${ev}: ${state()}`));
    v.addEventListener("durationchange", () => log(`LENGTH CHANGED to ${seconds(v.duration)}`));

    log(`started (preload = ${mode})`);
    v.src = src;
    v.load();
    timer.current = setInterval(() => {
      log(`every 2s: ${state()}`);
      if (performance.now() - started.current > 90000) stop();
    }, 2000);
    setRunning(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">Load
          <select value={mode} onChange={(e) => setMode(e.target.value as "metadata" | "auto")} disabled={running}
            className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm text-[#17253B]">
            <option value="metadata">only the start (what the page does now)</option>
            <option value="auto">as much as possible</option>
          </select>
        </label>
        {running ? (
          <button onClick={stop} className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm">Stop the test</button>
        ) : (
          <button onClick={start} className="h-10 rounded-lg bg-[#101B2D] px-4 text-sm font-semibold text-white">Start the test</button>
        )}
      </div>
      <div ref={holder} />
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-900 p-3 text-xs text-green-300">
        {lines.length === 0
          ? "Press Start the test. Then wait about 30 seconds without pressing anything. Then press play on the video and let it play for 10 seconds."
          : lines.map((l) => `${String(l.t).padStart(6, " ")} ms  ${l.text}`).join("\n")}
      </pre>
    </div>
  );
}
