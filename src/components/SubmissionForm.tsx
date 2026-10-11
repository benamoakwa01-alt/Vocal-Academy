"use client";
import { useState } from "react";
import { submitAssignment } from "@/app/assignments/actions";
import AudioRecorder from "./AudioRecorder";
import FileAttachments, { type AttachedFile } from "./FileAttachments";

export default function SubmissionForm({
  assignmentId, initialText, initialAudioPath, initialAudioUrl, initialFiles, error, isResubmit,
}: {
  assignmentId: string;
  initialText: string;
  initialAudioPath: string;
  initialAudioUrl: string | null;
  initialFiles: AttachedFile[];
  error: string | null;
  isResubmit: boolean;
}) {
  const [busyAudio, setBusyAudio] = useState(false);
  const [busyFiles, setBusyFiles] = useState(false);
  const busy = busyAudio || busyFiles;
  return (
    <form action={submitAssignment} className="space-y-4 rounded-xl bg-white p-5 shadow">
      <h2 className="font-semibold">{isResubmit ? "Update your submission" : "Your submission"}</h2>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <label className="block text-sm">Written answer
        <textarea name="text_body" rows={5} defaultValue={initialText}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
      </label>
      <AudioRecorder name="audio_path" folder={`a-${assignmentId}`} label="Recording"
        initialPath={initialAudioPath} initialUrl={initialAudioUrl} onBusyChange={setBusyAudio} />
      <FileAttachments folder={`f-${assignmentId}`} initial={initialFiles} onBusyChange={setBusyFiles} />
      <p className="text-xs text-gray-500">Add a written answer, a recording, files, or any mix of them.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? "Uploading..." : isResubmit ? "Save changes" : "Submit"}
      </button>
    </form>
  );
}
