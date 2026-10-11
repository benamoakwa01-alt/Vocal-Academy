import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { signedAudioUrl, submissionStatus } from "@/lib/assignments";
import AssignmentStatus from "@/components/AssignmentStatus";
import FeedbackForm from "@/components/FeedbackForm";
import SubmissionFilesView from "@/components/SubmissionFilesView";
import { loadSubmissionFiles } from "@/lib/submission-files";
import LocalTime from "@/components/LocalTime";

const errors: Record<string, string> = {
  empty: "Add a comment, a score, a voice note, or more than one.",
  score: "The score must be a whole number from 0 to 100.",
  audio: "That voice note could not be used. Please record it again.",
  denied: "You are not allowed to give feedback on this submission.",
};

export default async function ReviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string; subId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, subId } = await params;
  const { error } = await searchParams;
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") redirect(`/assignments/${id}`);

  const { data: sub } = await supabase
    .from("submissions").select("id, student_id, text_body, audio_path, submitted_at, updated_at")
    .eq("id", subId).eq("assignment_id", id).maybeSingle();
  if (!sub) redirect(`/assignments/${id}`);

  const { data: asg } = await supabase.from("assignments").select("title").eq("id", id).maybeSingle();
  const { data: student } = await supabase.from("profiles").select("full_name").eq("id", sub.student_id).maybeSingle();
  const { data: fb } = await supabase
    .from("feedback").select("comment, score, audio_path, needs_revision, updated_at").eq("submission_id", subId).maybeSingle();

  const audioUrl = await signedAudioUrl(supabase, sub.audio_path);
  const fbUrl = await signedAudioUrl(supabase, fb?.audio_path ?? null);
  const files = await loadSubmissionFiles(supabase, subId);
  const status = submissionStatus(sub, fb);

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href={`/assignments/${id}`} className="text-sm underline">Back to {asg?.title ?? "assignment"}</Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{student?.full_name ?? "Student"}</h1>
            <p className="text-sm text-gray-600">Submitted <LocalTime iso={sub.updated_at} /></p>
          </div>
          <AssignmentStatus status={status} />
        </div>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">Submission</h2>
          {sub.text_body && <p className="whitespace-pre-line text-gray-700">{sub.text_body}</p>}
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          <SubmissionFilesView files={files} />
          {!sub.text_body && !audioUrl && files.length === 0 && <p className="text-sm text-gray-500">This submission is empty.</p>}
        </section>

        <FeedbackForm
          assignmentId={id}
          submissionId={subId}
          initialComment={fb?.comment ?? ""}
          initialScore={fb?.score ?? null}
          initialNeedsRevision={fb?.needs_revision ?? false}
          initialAudioPath={fb?.audio_path ?? ""}
          initialAudioUrl={fbUrl}
          error={error ? errors[error] ?? "Something went wrong." : null}
        />
      </div>
    </main>
  );
}
