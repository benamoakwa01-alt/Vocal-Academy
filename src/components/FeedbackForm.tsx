"use client";
import { useState } from "react";
import { saveFeedback } from "@/app/assignments/actions";
import AudioRecorder from "./AudioRecorder";

const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";

export default function FeedbackForm({
  assignmentId, submissionId, initialComment, initialScore, initialNeedsRevision,
  initialAudioPath, initialAudioUrl, error,
}: {
  assignmentId: string;
  submissionId: string;
  initialComment: string;
  initialScore: number | null;
  initialNeedsRevision: boolean;
  initialAudioPath: string;
  initialAudioUrl: string | null;
  error: string | null;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form action={saveFeedback} className="space-y-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold">Your feedback</h2>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="submission_id" value={submissionId} />
      <label className="block text-sm">Comments
        <textarea name="comment" rows={5} defaultValue={initialComment} className={input} />
      </label>
      <label className="block text-sm">Score out of 100 (optional)
        <input name="score" type="number" min={0} max={100} step={1} defaultValue={initialScore ?? ""} className={`${input} sm:w-40`} />
      </label>
      <AudioRecorder name="audio_path" folder={`fb-${submissionId}`} label="Voice note (optional)"
        initialPath={initialAudioPath} initialUrl={initialAudioUrl} onBusyChange={setBusy} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needs_revision" defaultChecked={initialNeedsRevision} />
        Ask the student to revise and resubmit
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? "Uploading voice note..." : "Save feedback"}
      </button>
    </form>
  );
}
