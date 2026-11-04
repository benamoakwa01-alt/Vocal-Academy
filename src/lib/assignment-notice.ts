import { formatWhen } from "./due";

// The wording of the message students get when an assignment is posted
export function assignmentNotice(title: string, courseTitle: string | null, dueAt: string | null) {
  const where = courseTitle ? ` in ${courseTitle}` : "";
  const due = dueAt ? ` It is due ${formatWhen(dueAt)} (Ghana time).` : "";
  return {
    title: `New assignment: ${title}`,
    body: `Your tutor has posted a new assignment${where}.${due}`,
  };
}
