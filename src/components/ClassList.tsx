import Link from "next/link";
import LocalTime from "./LocalTime";
import StatusBadge from "./StatusBadge";
import { getLessonState, type ClassRow } from "@/lib/classes";

export default function ClassList({
  classes, names, now, empty,
}: {
  classes: ClassRow[];
  names: Record<string, string>;
  now: number;
  empty: string;
}) {
  if (!classes.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {classes.map((c) => (
        <li key={c.id}>
          <Link href={`/classes/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-gray-600">
                {c.tutor_id && names[c.tutor_id] ? `${names[c.tutor_id]} · ` : ""}
                <LocalTime iso={c.starts_at} end={c.ends_at} />
              </p>
            </div>
            <StatusBadge state={getLessonState(c, now)} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
