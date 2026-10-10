import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { signedAudioUrl, submissionStatus } from "@/lib/assignments";
import AssignmentStatus from "@/components/AssignmentStatus";
import ConfirmButton from "@/components/ConfirmButton";
import EnrollmentRequired from "@/components/EnrollmentRequired";
import LocalTime from "@/components/LocalTime";
import SubmissionForm from "@/components/SubmissionForm";
import { deleteAssignment } from "../actions";

type Asg = {
  id: string; title: string; instructions: string | null; course_id: string;
  courses: { title: string; instructor_id: string | null } | null;
  course_sessions: { day_number: number | null; title: string } | null;
};
type Sub = { id: string; student_id: string; text_body: string | null; audio_path: string | null; submitted_at: string; updated_at: string };
type Fb = { submission_id: string; comment: string | null; score: number | null; audio_path: string | null; needs_revision: boolean; updated_at: string };

const errors: Record<string, string> = {
  empty: "Add a written answer, a recording, or both.",
  audio: "That recording could not be used. Please record it again.",
  locked: "This work has already been reviewed, so it can no longer be changed.",
  denied: "Your enrollment is not active, so you cannot submit right now.",
};

export default async function AssignmentPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string; reviewed?: string }>;
}) {
  const { id } = await params;
  const { error, done, reviewed } = await searchParams;
  const { supabase, user, profile } = await requireAccess();
  const isStaff = profile.role !== "student";

  const { data } = await supabase
    .from("assignments")
    .select("id, title, instructions, course_id, courses(title, instructor_id), course_sessions(day_number, title)")
    .eq("id", id).maybeSingle();

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        <div className="mx-auto max-w-xl space-y-4">
          <Link href="/assignments" className="text-sm underline">Back to assignments</Link>
          <EnrollmentRequired title="You do not have access to this assignment"
            message="Assignments are available to students enrolled in the course." />
        </div>
      </main>
    );
  }
  const a = data as unknown as Asg;
  const day = a.course_sessions?.day_number;

  const header = (
    <div className="space-y-1">
      <Link href="/assignments" className="text-sm underline">Back to assignments</Link>
      <h1 className="pt-2 text-2xl font-bold">{a.title}</h1>
      <p className="text-sm text-gray-600">{a.courses?.title}{day ? ` · Day ${day}` : ""}</p>
      {a.instructions && <p className="whitespace-pre-line pt-2 text-gray-700">{a.instructions}</p>}
    </div>
  );

  // ---------- Staff view ----------
  if (isStaff) {
    const { data: sData } = await supabase
      .from("submissions").select("id, student_id, text_body, audio_path, submitted_at, updated_at").eq("assignment_id", id);
    const subs = (sData ?? []) as Sub[];
    const { data: fData } = subs.length
      ? await supabase.from("feedback").select("submission_id, comment, score, audio_path, needs_revision, updated_at").in("submission_id", subs.map((s) => s.id))
      : { data: [] };
    const fbBySub = new Map(((fData ?? []) as Fb[]).map((f) => [f.submission_id, f]));

    const { data: pData } = subs.length
      ? await supabase.from("profiles").select("id, full_name").in("id", subs.map((s) => s.student_id))
      : { data: [] };
    const nameOf = new Map(((pData ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Unnamed"]));

    const { data: eData } = await supabase
      .from("enrollments").select("student_id, profiles(full_name)").eq("course_id", a.course_id).eq("status", "active");
    const submitted = new Set(subs.map((s) => s.student_id));
    const missing = ((eData ?? []) as unknown as { student_id: string; profiles: { full_name: string | null } | null }[])
      .filter((e) => !submitted.has(e.student_id));

    const canDelete = profile.role === "admin" || a.courses?.instructor_id === user.id;

    return (
      <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {header}
          {reviewed && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Feedback saved.</p>}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Submissions ({subs.length})</h2>
            {subs.length === 0 && <p className="text-sm text-gray-500">Nothing submitted yet.</p>}
            <ul className="space-y-2">
              {subs.map((s) => (
                <li key={s.id}>
                  <Link href={`/assignments/${id}/submissions/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{nameOf.get(s.student_id) ?? "Unnamed"}</p>
                      <p className="text-sm text-gray-600">
                        {s.audio_path ? "Recording" : ""}{s.audio_path && s.text_body ? " and " : ""}{s.text_body ? "Written answer" : ""} · <LocalTime iso={s.updated_at} />
                      </p>
                    </div>
                    <AssignmentStatus status={submissionStatus(s, fbBySub.get(s.id))} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {missing.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Not submitted yet ({missing.length})</h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {missing.map((m) => <li key={m.student_id}>{m.profiles?.full_name ?? "Unnamed"}</li>)}
              </ul>
            </section>
          )}

          {canDelete && (
            <form action={deleteAssignment}>
              <input type="hidden" name="id" value={a.id} />
              <ConfirmButton label="Delete this assignment"
                message="Delete this assignment? Every student submission and all feedback for it will be deleted too."
                className="text-sm text-red-600 underline" />
            </form>
          )}
        </div>
      </main>
    );
  }

  // ---------- Student view ----------
  const { data: subData } = await supabase
    .from("submissions").select("id, student_id, text_body, audio_path, submitted_at, updated_at")
    .eq("assignment_id", id).eq("student_id", user.id).maybeSingle();
  const sub = (subData ?? null) as Sub | null;
  const { data: fbData } = sub
    ? await supabase.from("feedback").select("submission_id, comment, score, audio_path, needs_revision, updated_at").eq("submission_id", sub.id).maybeSingle()
    : { data: null };
  const fb = (fbData ?? null) as Fb | null;

  const status = submissionStatus(sub, fb);
  const editable = status !== "reviewed";
  const { data: canSubmit } = await supabase.rpc("can_submit", { aid: id });
  const audioUrl = await signedAudioUrl(supabase, sub?.audio_path ?? null);
  const fbUrl = await signedAudioUrl(supabase, fb?.audio_path ?? null);

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <AssignmentStatus status={status} />
        {done && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Saved. Your tutor will review it.</p>}

        {fb && (
          <section className="space-y-3 rounded-xl bg-white p-5 shadow">
            <h2 className="font-semibold">Feedback from your tutor</h2>
            {fb.needs_revision && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Your tutor has asked you to revise and resubmit.
              </p>
            )}
            {fb.score !== null && <p className="text-lg font-semibold">{fb.score} / 100</p>}
            {fb.comment && <p className="whitespace-pre-line text-gray-700">{fb.comment}</p>}
            {fbUrl && <audio controls src={fbUrl} className="w-full" />}
          </section>
        )}

        {editable && canSubmit === true ? (
          <SubmissionForm
            assignmentId={id}
            initialText={sub?.text_body ?? ""}
            initialAudioPath={sub?.audio_path ?? ""}
            initialAudioUrl={audioUrl}
            error={error ? errors[error] ?? "Something went wrong." : null}
            isResubmit={!!sub}
          />
        ) : (
          <section className="space-y-3 rounded-xl bg-white p-5 shadow">
            <h2 className="font-semibold">Your submission</h2>
            {!sub && <p className="text-sm text-gray-600">Submissions are closed because your enrollment is not active.</p>}
            {sub?.text_body && <p className="whitespace-pre-line text-gray-700">{sub.text_body}</p>}
            {audioUrl && <audio controls src={audioUrl} className="w-full" />}
            {sub && <p className="text-xs text-gray-500">Submitted <LocalTime iso={sub.updated_at} /></p>}
          </section>
        )}
      </div>
    </main>
  );
}
