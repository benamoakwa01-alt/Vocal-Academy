import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDue } from "@/lib/due";
import { Panel } from "@/components/ui";

type Row = { id: string; title: string; due_at: string; closes_at: string | null; courses: { title: string } | null };
const pill: Record<string, string> = {
  soon: "bg-amber-100 text-amber-800", overdue: "bg-red-100 text-red-700", upcoming: "bg-gray-100 text-gray-700",
};

// Assignments with a due date that the student has not handed in yet
export default async function DueSoonPanel({ supabase, studentId, now }: { supabase: SupabaseClient; studentId: string; now: number }) {
  const { data: enr } = await supabase.from("enrollments").select("course_id").eq("student_id", studentId).eq("status", "active");
  const courseIds = ((enr ?? []) as { course_id: string }[]).map((e) => e.course_id);
  if (courseIds.length === 0) return null;

  const { data: aData } = await supabase
    .from("assignments").select("id, title, due_at, closes_at, courses(title)")
    .in("course_id", courseIds).not("due_at", "is", null).order("due_at", { ascending: true }).limit(40);
  const { data: sData } = await supabase.from("submissions").select("assignment_id").eq("student_id", studentId);
  const handed = new Set(((sData ?? []) as { assignment_id: string }[]).map((s) => s.assignment_id));

  const rows = ((aData ?? []) as unknown as Row[])
    .filter((a) => !handed.has(a.id) && (!a.closes_at || now < Date.parse(a.closes_at)))
    .slice(0, 5);
  if (rows.length === 0) return null;

  return (
    <Panel title="Due dates">
      <ul className="space-y-2">
        {rows.map((a) => {
          const info = describeDue(a.due_at, a.closes_at, now);
          return (
            <li key={a.id}>
              <Link href={`/assignments/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#17253B]">{a.title}</span>
                  <span className="block text-xs text-[#647084]">{a.courses?.title}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${pill[info.state] ?? pill.upcoming}`}>{info.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
