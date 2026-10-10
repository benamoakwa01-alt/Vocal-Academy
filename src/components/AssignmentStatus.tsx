import { STATUS, type SubStatus } from "@/lib/assignments";

export default function AssignmentStatus({ status }: { status: SubStatus }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
