"use client";
import { useEffect, useRef, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { recordingOptions, type RecordingQuality } from "@/lib/recording-quality";

type State = "idle" | "starting" | "on" | "stopping";
const WAIT_MS = 20000;

// The live classroom. Students get the plain classroom. Tutors get it with Start and Stop recording
// buttons that record at a smaller size. For tutors, Daily's library creates the classroom and joins it,
// which is what lets the buttons control the recording.
export default function ClassroomFrame({
  url, roomUrl, token, title, ownControls, quality,
}: {
  url: string;
  roomUrl: string;
  token: string;
  title: string;
  ownControls: boolean;
  quality: RecordingQuality;
}) {
  const container = useRef<HTMLDivElement>(null);
  const call = useRef<DailyCall | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<State>("idle");
  const [joined, setJoined] = useState(false);
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
        if (cancelled || !container.current) return;
        await Daily.getCallInstance()?.destroy();
        if (cancelled || !container.current) return;

        mine = Daily.createFrame(container.current, {
          iframeStyle: { width: "100%", height: "100%", border: "0" },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        call.current = mine;

        mine.on("joined-meeting", () => {
          if (!cancelled) setJoined(true);
        });
        mine.on("left-meeting", () => {
          settle();
          setJoined(false);
          setState("idle");
        });
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
        mine.on("error", (ev?: { errorMsg?: string }) => {
          setProblem(ev?.errorMsg ? `The classroom reported a problem: ${ev.errorMsg}` : "The classroom reported a problem.");
        });

        await mine.join({ url: roomUrl, token });
      } catch (e) {
        console.error("Classroom could not open:", e);
        if (!cancelled) {
          setProblem(`The classroom could not open here${e instanceof Error ? ` (${e.message})` : ""}. Use "Buttons not working?" to open it the standard way.`);
        }
      }
    })();

    return () => {
      cancelled = true;
      settle();
      call.current = null;
      void mine?.destroy();
    };
  }, [ownControls, roomUrl, token]);

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
    Promise.resolve(c.startRecording(recordingOptions(quality))).catch((e) => {
      console.error("startRecording failed:", e);
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
    Promise.resolve(c.stopRecording()).catch((e) => {
      console.error("stopRecording failed:", e);
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
              {joined ? "Not recording. Press Start recording once students have joined." : "Opening the classroom..."}
            </span>
          )}
          <div className="flex items-center gap-3">
            {state === "on" || state === "stopping" ? (
              <button onClick={stop} disabled={state === "stopping"}
                className="rounded-lg bg-red-600 px-3 py-1.5 font-medium hover:bg-red-700 disabled:opacity-60">
                {state === "stopping" ? "Stopping..." : "Stop recording"}
              </button>
            ) : (
              <button onClick={start} disabled={!joined || state === "starting"}
                className="rounded-lg bg-white px-3 py-1.5 font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-60">
                {state === "starting" ? "Starting..." : "Start recording"}
              </button>
            )}
            <a href="?basic=1" className="text-xs underline">Buttons not working?</a>
          </div>
          {problem && <p role="alert" className="w-full text-red-300">{problem}</p>}
        </div>
      )}
      {ownControls ? (
        <div ref={container} className="min-h-0 w-full flex-1" />
      ) : (
        <iframe
          src={url}
          title={title}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full flex-1 border-0"
        />
      )}
    </div>
  );
}
