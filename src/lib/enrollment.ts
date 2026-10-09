export const ENROLLMENT_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Enrolled",
  paused: "Paused",
  completed: "Completed",
  expired: "Expired",
  withdrawn: "Withdrawn",
  cancelled: "Closed",
};

export function enrollmentLabel(status: string) {
  return ENROLLMENT_LABEL[status] ?? status;
}
