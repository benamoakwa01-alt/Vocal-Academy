// Works out a student's course grade from the records the platform already keeps.
// Pure logic with no database calls, so the arithmetic can be tested on its own.

export type Band = { min: number; grade: string; label: string };
export type Scheme = {
  attendance_weight: number;
  assignments_weight: number;
  assessment_weight: number;
  pass_mark: number;
  bands: Band[];
};

export const DEFAULT_BANDS: Band[] = [
  { min: 80, grade: "A", label: "Distinction" },
  { min: 70, grade: "B", label: "Merit" },
  { min: 60, grade: "C", label: "Credit" },
  { min: 50, grade: "D", label: "Pass" },
  { min: 0, grade: "F", label: "Fail" },
];

export const DEFAULT_SCHEME: Scheme = {
  attendance_weight: 20,
  assignments_weight: 80,
  assessment_weight: 0,
  pass_mark: 50,
  bands: DEFAULT_BANDS,
};

export type ClassRecord = { id: string; title: string; starts_at: string; status: "present" | "excused" | "absent" };
export type WorkState = "graded" | "pending" | "missing" | "ungraded";
export type WorkRecord = {
  id: string;
  title: string;
  weight: number;
  counts: boolean;
  state: WorkState; // graded = final score given, pending = waiting for review or revision, missing = never submitted, ungraded = reviewed with no score
  score: number | null;
};

export type GradeInput = {
  classes: ClassRecord[];
  work: WorkRecord[];
  assessment: number | null;
  scheme: Scheme;
  missingAsZero: boolean;
};

export type PartKey = "attendance" | "assignments" | "assessment";
export type GradeResult = {
  attendance: { held: number; present: number; excused: number; absent: number; pct: number | null };
  assignments: { counted: number; graded: number; missing: number; pending: number; pct: number | null };
  assessment: number | null;
  parts: { key: PartKey; label: string; weight: number; value: number | null }[];
  final: number | null;
  grade: string | null;
  label: string | null;
  passed: boolean | null;
  warnings: string[];
  blockers: string[];
  ready: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function bandFor(final: number, bands: Band[]): Band | null {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => final >= b.min) ?? sorted[sorted.length - 1] ?? null;
}

export function computeGrade(input: GradeInput): GradeResult {
  const { classes, work, scheme, missingAsZero } = input;

  // Attendance: present out of classes held, ignoring classes the student was excused from
  const present = classes.filter((c) => c.status === "present").length;
  const excused = classes.filter((c) => c.status === "excused").length;
  const absent = classes.filter((c) => c.status === "absent").length;
  const denominator = classes.length - excused;
  const attendancePct = denominator > 0 ? round1((present / denominator) * 100) : null;

  // Assignments: weighted average of the work that counts
  const counted = work.filter((w) => w.counts && w.weight > 0);
  let weightSum = 0;
  let scoreSum = 0;
  let graded = 0;
  let missing = 0;
  let pending = 0;
  for (const w of counted) {
    if (w.state === "graded" && w.score !== null) {
      scoreSum += w.score * w.weight;
      weightSum += w.weight;
      graded += 1;
    } else if (w.state === "pending") {
      pending += 1;
    } else if (w.state === "missing") {
      missing += 1;
      if (missingAsZero) weightSum += w.weight; // counts as a zero
    }
    // "ungraded" (reviewed, no score) is left out
  }
  const assignmentsPct = weightSum > 0 ? round1(scoreSum / weightSum) : null;

  const assessment = input.assessment;
  const parts: GradeResult["parts"] = [
    { key: "attendance", label: "Attendance", weight: scheme.attendance_weight, value: attendancePct },
    { key: "assignments", label: "Assignments", weight: scheme.assignments_weight, value: assignmentsPct },
    { key: "assessment", label: "Final assessment", weight: scheme.assessment_weight, value: assessment },
  ];

  // Final: weighted average of the parts that have a value (weights are scaled to the parts available)
  let wSum = 0;
  let vSum = 0;
  for (const p of parts) {
    if (p.weight > 0 && p.value !== null) {
      wSum += p.weight;
      vSum += p.weight * p.value;
    }
  }
  const final = wSum > 0 ? round1(vSum / wSum) : null;
  const band = final !== null ? bandFor(final, scheme.bands) : null;

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (pending > 0) {
    blockers.push(`${plural(pending, "assignment is", "assignments are")} still waiting for your review or for the student to resubmit.`);
  }
  if (scheme.assessment_weight > 0 && assessment === null) {
    blockers.push("The final assessment score has not been entered.");
  }
  if (final === null) blockers.push("There is not enough information yet to work out a grade.");

  const totalWeight = scheme.attendance_weight + scheme.assignments_weight + scheme.assessment_weight;
  if (Math.abs(totalWeight - 100) > 0.001) {
    warnings.push(`The weights add up to ${round1(totalWeight)}, not 100. The result is still scaled correctly.`);
  }
  if (scheme.attendance_weight > 0 && attendancePct === null) {
    warnings.push("No classes have been counted yet, so attendance is left out of the grade.");
  }
  if (scheme.assignments_weight > 0 && assignmentsPct === null) {
    warnings.push("There is no graded assignment yet, so assignments are left out of the grade.");
  }
  if (missing > 0 && missingAsZero) {
    warnings.push(`${plural(missing, "assignment was", "assignments were")} never submitted and ${missing === 1 ? "counts" : "count"} as zero.`);
  }
  if (missing > 0 && !missingAsZero) {
    warnings.push(`${plural(missing, "assignment was", "assignments were")} never submitted and ${missing === 1 ? "is" : "are"} left out.`);
  }

  return {
    attendance: { held: classes.length, present, excused, absent, pct: attendancePct },
    assignments: { counted: counted.length, graded, missing, pending, pct: assignmentsPct },
    assessment,
    parts,
    final,
    grade: band?.grade ?? null,
    label: band?.label ?? null,
    passed: final !== null ? final >= scheme.pass_mark : null,
    warnings,
    blockers,
    ready: blockers.length === 0,
  };
}

// ---- Turning the stored records into the input above ----

export type CourseData = {
  scheme: Scheme;
  classes: { id: string; title: string; starts_at: string; cohort_id: string | null }[]; // completed classes of the course
  attendance: Record<string, "present" | "excused">; // key: classId:studentId
  assignments: { id: string; title: string; weight: number; counts: boolean }[];
  work: Record<string, { state: WorkState; score: number | null }>; // key: assignmentId:studentId
};

export function toInput(
  data: CourseData,
  who: { student_id: string; cohort_id: string | null },
  opts: { assessment: number | null; missingAsZero: boolean }
): GradeInput {
  const mine = data.classes.filter((c) => (who.cohort_id ? c.cohort_id === who.cohort_id : !c.cohort_id));
  const classes: ClassRecord[] = mine.map((c) => ({
    id: c.id,
    title: c.title,
    starts_at: c.starts_at,
    status: data.attendance[`${c.id}:${who.student_id}`] ?? "absent",
  }));
  const work: WorkRecord[] = data.assignments.map((a) => {
    const w = data.work[`${a.id}:${who.student_id}`];
    return { id: a.id, title: a.title, weight: a.weight, counts: a.counts, state: w?.state ?? "missing", score: w?.score ?? null };
  });
  return { classes, work, assessment: opts.assessment, scheme: data.scheme, missingAsZero: opts.missingAsZero };
}

// The snapshot saved with a published grade, so the student's report never changes by accident
export function buildDetail(result: GradeResult, input: GradeInput) {
  return {
    scheme: { pass_mark: input.scheme.pass_mark, bands: input.scheme.bands },
    parts: result.parts,
    attendance: { ...result.attendance, rows: input.classes.map((c) => ({ title: c.title, date: c.starts_at, status: c.status })) },
    assignments: {
      ...result.assignments,
      rows: input.work.filter((w) => w.counts && w.weight > 0).map((w) => ({ title: w.title, weight: w.weight, state: w.state, score: w.score })),
    },
    missing_as_zero: input.missingAsZero,
  };
}
