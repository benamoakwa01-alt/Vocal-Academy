"use client";
import { useState } from "react";
import { createClass } from "@/app/classes/actions";

const input = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black";
const errors: Record<string, string> = {
  title: "Please enter a title.",
  time: "Please set a valid date, with the end time after the start time.",
  denied: "You don't have permission to create that class. Tutors can only schedule classes for courses they teach.",
  team: "That tutor is not on this course's teaching team. Add them to the team first, or choose someone else.",
};

function toIso(date: string, time: string) {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function ClassForm({
  courses, tutors, students, isAdmin, selfId, teams, error,
}: {
  courses: { id: string; title: string }[];
  tutors: { id: string; full_name: string | null }[];
  students: { id: string; full_name: string | null; email: string | null }[];
  isAdmin: boolean;
  selfId: string;
  teams: Record<string, string[]>;
  error?: string;
}) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tutorId, setTutorId] = useState(selfId);

  // For a course, only its teaching team can be chosen
  const team = courseId ? teams[courseId] : undefined;
  const options = team ? tutors.filter((t) => team.includes(t.id)) : tutors;
  const chosen = options.some((t) => t.id === tutorId) ? tutorId : options[0]?.id ?? selfId;

  return (
    <form action={createClass} className="space-y-4 rounded-xl bg-white p-5 shadow">
      <input name="title" required placeholder="Class title (e.g. Vocal Registers)" className={input} />
      <textarea name="description" rows={2} placeholder="Description (optional)" className={input} />

      <label className="block text-sm">Course (optional)
        <select name="course_id" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${input} mt-1`}>
          <option value="">No course (individual class)</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <span className="text-xs text-gray-500">Everyone actively enrolled in the course sees this class automatically.</span>
      </label>

      {isAdmin && (
        <label className="block text-sm">Tutor
          <select name="tutor_id" value={chosen} onChange={(e) => setTutorId(e.target.value)} className={`${input} mt-1`}>
            {options.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? "Unnamed"}</option>)}
          </select>
          {team && <span className="text-xs text-gray-500">Only tutors on this course&apos;s teaching team are listed.</span>}
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-sm">Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm">Start time
          <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm">End time
          <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>
      <input type="hidden" name="starts_at" value={toIso(date, start)} />
      <input type="hidden" name="ends_at" value={toIso(date, end)} />
      <p className="text-xs text-gray-500">Times are in your own timezone.</p>

      <fieldset>
        <legend className="text-sm">Assign individual students (optional)</legend>
        {students.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">
            No students available yet. Students appear here once they are enrolled in one of your courses.
          </p>
        ) : (
          <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="student_ids" value={s.id} />
                <span>{s.full_name ?? "Unnamed"} <span className="text-gray-500">{s.email}</span></span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {error && <p className="text-sm text-red-600">{errors[error] ?? "Something went wrong."}</p>}
      <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Schedule class</button>
    </form>
  );
}
