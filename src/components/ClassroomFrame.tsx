"use client";
import { useEffect, useRef, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { recordingOptions, type RecordingQuality } from "@/lib/recording-quality";

type State = "idle" | "starting" | "on" | "stopping";
const WAIT_MS = 20000;

// The live classroom. For tutors it adds Start and Stop recording buttons that record at a smaller size.
export default function ClassroomFrame({
  url, title, ownControls, quality,
}: {
  url: string;
  title: string;
  ownControls: boolean;
  quality: RecordingQuality;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const call = useRef<DailyCall | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<State>("idle");
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ownControls) return;
    let cancelled = false;
    let mine: DailyCall | null = null;
    const settle = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    (async () => {
      try {
        const Daily = (await import("@daily-co/daily-js")).default;
        if (cancelled || !frame.current) return;
        await Daily.getCallInstance()?.destroy();
        if (cancelled || !frame.current) return;
        mine = Daily.wrap(frame.current);
        call.current = mine;
        mine.on("recording-started", () => {
          settle();
          setProblem(null);
          setState("on");
        });
        mine.on("recording-stopped", () => {
          settle();
          setState("idle");
        });
        mine.on("recording-error", (ev?: { errorMsg?: string }) => {
          settle();
          setState("idle");
          setProblem(ev?.errorMsg ? `Daily said: ${ev.errorMsg}` : "The recording could not start.");
        });
        setReady(true);
      } catch {
        if (!cancelled) setProblem("The recording buttons could not load. Use the link on the right to use the classroom's own Record button.");
      }
    })();

    return () => {
      cancelled = true;
      settle();
      call.current = null;
      void mine?.destroy();
    };
  }, [ownControls]);

  function waitFor(message: string) {
    timer.current = setTimeout(() => {
      timer.current = null;
      setState((s) => (s === "starting" ? "idle" : s === "stopping" ? "on" : s));
      setProblem(message);
    }, WAIT_MS);
  }

  function start() {
    const c = call.current;
    if (!c) return;
    setProblem(null);
    setState("starting");
    waitFor("Daily did not confirm that recording started. Look for the recording notice in the classroom, then try again.");
    Promise.resolve(c.startRecording(recordingOptions(quality))).catch(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setState("idle");
      setProblem("Recording could not start. Check that you are inside the classroom, then try again.");
    });
  }

  function stop() {
    const c = call.current;
    if (!c) return;
    setProblem(null);
    setState("stopping");
    waitFor("Daily did not confirm that recording stopped. Check the classroom, and use its own controls if needed.");
    Promise.resolve(c.stopRecording()).catch(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setState("on");
      setProblem("Recording could not be stopped from here. Use the classroom's own controls.");
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ownControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-800 px-3 py-2 text-sm">
          {state === "on" || state === "stopping" ? (
            <span className="flex items-center gap-2 font-medium text-red-300">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              Recording
            </span>
          ) : (
            <span className="rounded bg-amber-500 px-2 py-1 text-black">
              Not recording. Press Start recording once students have joined.
            </span>
          )}
          <div className="flex items-center gap-3">
            {state === "on" || state === "stopping" ? (
              <button onClick={stop} disabled={state === "stopping"}
                className="rounded-lg bg-red-600 px-3 py-1.5 font-medium hover:bg-red-700 disabled:opacity-60">
                {state === "stopping" ? "Stopping..." : "Stop recording"}
              </button>
            ) : (
              <button onClick={start} disabled={!ready || state === "starting"}
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-60">
                {state === "starting" ? "Starting..." : ready ? "Start recording" : "Loading..."}
              </button>
            )}
            <a href="?basic=1" className="text-xs underline">Buttons not working?</a>
          </div>
          {problem && <p role="alert" className="w-full text-red-300">{problem}</p>}
        </div>
      )}
      <iframe
        ref={frame}
        src={url}
        title={title}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
