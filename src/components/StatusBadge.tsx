import type { LessonState } from "@/lib/classes";

const map: Record<LessonState, { label: string; cls: string }> = {
  countdown: { label: "Scheduled", cls: "bg-blue-100 text-blue-800" },
  waiting: { label: "Starting now", cls: "bg-amber-100 text-amber-800" },
  preparing: { label: "Tutor preparing", cls: "bg-amber-100 text-amber-800" },
  live: { label: "Live now", cls: "bg-green-100 text-green-800" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
  missed: { label: "Not held", cls: "bg-gray-100 text-gray-500" },
};

export default function StatusBadge({ state }: { state: LessonState }) {
  const s = map[state];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
