const fs = require("fs");
const R = String.raw;
const lines = (...a) => a.join("\n");
const edits = [];
const add = (file, done, find, replace, opts = {}) => edits.push({ file, done, find, replace, ...opts });

const NAV = "src/components/shell/nav.ts";
const CLASS_PAGE = "src/app/classes/[id]/page.tsx";
const MYC = "src/app/my-courses/[slug]/page.tsx";
const DASH = "src/app/dashboard/page.tsx";
const ENR = "src/app/admin/enrollments/page.tsx";
const REC = "src/app/admin/recordings/page.tsx";
const COURSE = "src/app/courses/[slug]/page.tsx";

// ---- Shell: confirmation before destructive buttons
add("src/components/shell/ShellFrame.tsx", "import ConfirmGuard",
  'import { Icon } from "./icons";', 'import { Icon } from "./icons";\nimport ConfirmGuard from "@/components/ConfirmGuard";');
add("src/components/shell/ShellFrame.tsx", "<ConfirmGuard />",
  '<div className="flex min-h-dvh bg-[#F4F5F7] text-[#17253B]">',
  '<div className="flex min-h-dvh bg-[#F4F5F7] text-[#17253B]">\n      <ConfirmGuard />');

// ---- Photos on the course banner and sign-in panel
add(COURSE, 'import Image from "next/image"', 'import Link from "next/link";', 'import Image from "next/image";\nimport Link from "next/link";');
add(COURSE, "vocal-training-hero.jpg", '<section className="bg-[#101B2D] pb-14 pt-8 text-white">', lines(
  '<section className="relative isolate overflow-hidden bg-[#101B2D] pb-14 pt-8 text-white">',
  '        <Image src="/images/vocal-training-hero.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover object-[80%_center]" />',
  '        <div aria-hidden="true" className="absolute inset-0 -z-10"',
  '          style={{ background: "linear-gradient(90deg, rgba(16,27,45,0.96) 0%, rgba(16,27,45,0.88) 45%, rgba(16,27,45,0.55) 100%)" }} />'));
add("src/components/auth/AuthShell.tsx", "vocal-performance.jpg",
  '<div className="hidden flex-col justify-between bg-[#101B2D] p-10 text-white md:flex">', lines(
  '<div className="relative isolate hidden flex-col justify-between overflow-hidden bg-[#101B2D] p-10 text-white md:flex">',
  '        <Image src="/images/vocal-performance.jpg" alt="" fill sizes="50vw" className="-z-20 object-cover object-[65%_center]" />',
  '        <div aria-hidden="true" className="absolute inset-0 -z-10"',
  '          style={{ background: "linear-gradient(180deg, rgba(16,27,45,0.9) 0%, rgba(16,27,45,0.62) 50%, rgba(16,27,45,0.92) 100%)" }} />'));

// ---- Classmates, student lists, My courses links
add("src/app/assignments/[id]/page.tsx", "profiles!student_id(full_name)",
  'select("student_id, profiles(full_name)")', 'select("student_id, profiles!student_id(full_name)")');
add(CLASS_PAGE, "import Classmates", 'import RecordingsPanel from "@/components/RecordingsPanel";',
  'import RecordingsPanel from "@/components/RecordingsPanel";\nimport Classmates from "@/components/Classmates";');
add(CLASS_PAGE, "<Classmates supabase",
  '<RecordingsPanel supabase={supabase} classId={c.id} classStatus={c.status} endsAt={c.ends_at} now={now} canManage={false} isAdmin={false} />',
  '<RecordingsPanel supabase={supabase} classId={c.id} classStatus={c.status} endsAt={c.ends_at} now={now} canManage={false} isAdmin={false} />\n          {c.course_id && <Classmates supabase={supabase} courseId={c.course_id} />}');
add(DASH, 'href="/my-courses" className="text-sm font-medium text-[#101B2D] underline">See all',
  '<Panel title="My courses" action={<Link href="/courses" className="text-sm font-medium text-[#101B2D] underline">Explore</Link>}>',
  '<Panel title="My courses" action={<Link href="/my-courses" className="text-sm font-medium text-[#101B2D] underline">See all</Link>}>');
add(DASH, "`/my-courses/${e.courses!.slug}`",
  '`/courses/${e.courses!.slug}/enroll` : `/courses/${e.courses!.slug}`',
  '`/courses/${e.courses!.slug}/enroll` : `/my-courses/${e.courses!.slug}`');

// ---- Assign a cohort from the Enrollments page
add(ENR, "import { assignToCohort }", 'import { enrollStudent, setEnrollmentStatus } from "./actions";',
  'import { enrollStudent, setEnrollmentStatus } from "./actions";\nimport { assignToCohort } from "./cohort-actions";');
add(ENR, "assigned?: string", 'searchParams: Promise<{ q?: string; course?: string; status?: string }>;',
  'searchParams: Promise<{ q?: string; course?: string; status?: string; assigned?: string; error?: string }>;');
add(ENR, "const cohortList", '  const { data: courses } = await supabase.from("courses").select("id, title").order("title");', lines(
  '  const { data: courses } = await supabase.from("courses").select("id, title").order("title");',
  '  const { data: kData } = await supabase.from("cohorts").select("id, name, course_id, status")',
  '    .neq("status", "cancelled").order("starts_at", { ascending: false });',
  '  const cohortList = (kData ?? []) as { id: string; name: string; course_id: string; status: string }[];'));
add(ENR, "{sp.assigned &&", '      <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">', lines(
  '      {sp.assigned && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Student added to the cohort. They have been notified.</p>}',
  '      {sp.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}',
  '',
  '      <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">'));
add(ENR, "action={assignToCohort}",
  '<li key={e.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><Who e={e} now={now} /></li>', lines(
  '<li key={e.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">',
  '                <Who e={e} now={now} />',
  '                {(() => {',
  '                  const options = cohortList.filter((k) => k.course_id === e.courses?.id);',
  '                  return options.length === 0 ? (',
  '                    <p className="text-sm text-[#647084]">No cohort exists for this course yet. <Link href="/admin/cohorts" className="underline">Create one</Link>.</p>',
  '                  ) : (',
  '                    <form action={assignToCohort} className="flex flex-wrap gap-2">',
  '                      <input type="hidden" name="enrollment_id" value={e.id} />',
  '                      <select name="cohort_id" required defaultValue="" aria-label="Cohort" className={`${input} sm:max-w-xs`}>',
  '                        <option value="" disabled>Choose a cohort...</option>',
  '                        {options.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}',
  '                      </select>',
  '                      <button className={btnPrimary}>Add to cohort</button>',
  '                    </form>',
  '                  );',
  '                })()}',
  '              </li>'));

// ---- "Video library" naming
add(NAV, 'label: "Video library"', 'label: "Lessons"', 'label: "Video library"', { all: true });
add(NAV, R`[/^\/lessons\/[^/]+/, "Video"]`, R`[/^\/lessons\/[^/]+/, "Lesson"]`, R`[/^\/lessons\/[^/]+/, "Video"]`);
add(NAV, R`[/^\/lessons/, "Video library"]`, R`[/^\/lessons/, "Lessons"]`, R`[/^\/lessons/, "Video library"]`);
add("src/app/lessons/page.tsx", ">Video library</h1>", '<h1 className="text-2xl font-bold">Lessons</h1>', '<h1 className="text-2xl font-bold">Video library</h1>');
add("src/app/lessons/[id]/page.tsx", "Back to video library", "Back to lessons", "Back to video library");
add(MYC, '["lessons", "Video library"]', '["lessons", "Lessons"]', '["lessons", "Video library"]');
add(MYC, '<Panel title="Video library"',
  '<Panel title="Lessons" action={<Link href="/lessons" className="text-sm font-medium text-[#101B2D] underline">All lessons</Link>}>',
  '<Panel title="Video library" action={<Link href="/lessons" className="text-sm font-medium text-[#101B2D] underline">Full library</Link>}>');
add(MYC, "No videos for this course yet.", "No recorded lessons for this course yet.", "No videos for this course yet.");
add(DASH, '{ label: "Video library", href: "/lessons" }', '{ label: "Lessons", href: "/lessons" }', '{ label: "Video library", href: "/lessons" }');
add(DASH, "Recordings waiting for approval", 'label: "Recordings to check"', 'label: "Recordings waiting for approval"');

// ---- Recordings page: approval wording and visible errors
add(REC, "failed?: string; detail?: string",
  'searchParams: Promise<{ course?: string; status?: string; checked?: string; failed?: string }>;',
  'searchParams: Promise<{ course?: string; status?: string; checked?: string; failed?: string; detail?: string }>;');
add(REC, '["review", "Needs approval"]', '["ready", "Ready"], ["review", "Needs review"],', '["ready", "Published"], ["review", "Needs approval"],');
add(REC, 'ready: { text: "Published"', 'ready: { text: "Ready", cls: "bg-green-100 text-green-800" },', 'ready: { text: "Published", cls: "bg-green-100 text-green-800" },');
add(REC, 'review: { text: "Needs approval"', 'review: { text: "Needs review", cls: "bg-amber-100 text-amber-800" },', 'review: { text: "Needs approval", cls: "bg-amber-100 text-amber-800" },');
add(REC, "Reason: ${sp.detail}", '${sp.failed} could not be checked. See the note below.', '${sp.failed} could not be checked.${sp.detail ? ` Reason: ${sp.detail}` : ""}');
add(REC, "let firstFailure", "let providerFailures = 0;", "let providerFailures = 0;\n  let firstFailure: string | null = null;");
add(REC, 'const bad = results.find((r) => !r.ok && r.reason !== "no-room");',
  'providerFailures = results.filter((r) => !r.ok && r.reason === "provider").length;', lines(
  'providerFailures = results.filter((r) => !r.ok && r.reason !== "no-room").length;',
  '    const bad = results.find((r) => !r.ok && r.reason !== "no-room");',
  '    firstFailure = bad && !bad.ok ? bad.detail : null;'));
add(REC, "We could not check {providerFailures}",
  'We could not reach Daily for {providerFailures} {providerFailures === 1 ? "class" : "classes"}. Check that',
  'We could not check {providerFailures} {providerFailures === 1 ? "class" : "classes"}{firstFailure ? ` (${firstFailure})` : ""}. Check that');

// ---- Grading: connect the new pages
add(NAV, '"Grading settings"', R`  [/^\/dashboard/, "Dashboard"],`, lines(
  R`  [/^\/dashboard/, "Dashboard"],`,
  R`  [/^\/grades\/settings/, "Grading settings"],`,
  R`  [/^\/grades\/[^/]+/, "Student record"],`,
  R`  [/^\/grades/, "Grades"],`));
add(NAV, '{ href: "/grades"', '          { href: "/assignments", label: "Assignments", icon: "clipboard" },', lines(
  '          { href: "/assignments", label: "Assignments", icon: "clipboard" },',
  '          { href: "/grades", label: "Grades", icon: "award" },'), { all: true });
add("src/components/shell/icons.tsx", "award:", '  menu: (<path d="M4 6h16M4 12h16M4 18h16" />),', lines(
  '  award: (<><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 21l5-3 5 3-1.5-6.5" /></>),',
  '  menu: (<path d="M4 6h16M4 12h16M4 18h16" />),'));
add("src/components/BrandBar.tsx", '"/grades"', '"/my-courses", "/notifications",', '"/my-courses", "/grades", "/notifications",', { optional: true });
add("src/components/BrandBar.tsx", '"/grades"', '"/courses", "/notifications",', '"/courses", "/my-courses", "/grades", "/notifications",');
add(CLASS_PAGE, "import AttendanceRegister", 'import RecordingsPanel from "@/components/RecordingsPanel";',
  'import RecordingsPanel from "@/components/RecordingsPanel";\nimport AttendanceRegister from "@/components/AttendanceRegister";');
add(CLASS_PAGE, "<AttendanceRegister",
  '<RecordingsPanel supabase={supabase} classId={c.id} classStatus={c.status} endsAt={c.ends_at} now={now} canManage={canManage} isAdmin={profile.role === "admin"} />',
  '<RecordingsPanel supabase={supabase} classId={c.id} classStatus={c.status} endsAt={c.ends_at} now={now} canManage={canManage} isAdmin={profile.role === "admin"} />\n\n        {canManage && <AttendanceRegister supabase={supabase} classId={c.id} courseId={c.course_id} cohortId={c.cohort_id} status={c.status} />}');
add(MYC, "import ProgressPanel", 'import Classmates from "@/components/Classmates";', 'import Classmates from "@/components/Classmates";\nimport ProgressPanel from "@/components/ProgressPanel";');
add(MYC, '.select("id, status, cohort_id")', '.select("status, cohort_id")', '.select("id, status, cohort_id")');
add(MYC, "<ProgressPanel supabase",
  '<section id="classmates" className="scroll-mt-24 space-y-6">',
  '<ProgressPanel supabase={supabase} courseId={course.id} slug={slug} enrollmentId={enr.id} studentId={user.id} cohortId={enr.cohort_id} />\n            <section id="classmates" className="scroll-mt-24 space-y-6">');

// ---------------- run
let applied = 0, already = 0, problems = 0;
for (const e of edits) {
  if (!fs.existsSync(e.file)) { console.log("MISSING FILE ", e.file); problems++; continue; }
  let s = fs.readFileSync(e.file, "utf8");
  if (s.includes(e.done)) { already++; continue; }
  if (!s.includes(e.find)) {
    if (!e.optional) { console.log("NOT FOUND    ", e.file, "->", e.find.slice(0, 70)); problems++; }
    continue;
  }
  s = e.all ? s.split(e.find).join(e.replace) : s.replace(e.find, () => e.replace);
  fs.writeFileSync(e.file, s);
  console.log("APPLIED      ", e.file, "->", e.done.slice(0, 55));
  applied++;
}

const needed = [
  "src/lib/grading.ts", "src/lib/grading-data.ts", "src/components/AttendanceRegister.tsx", "src/components/ProgressPanel.tsx",
  "src/components/PrintButton.tsx", "src/components/ConfirmGuard.tsx", "src/components/Classmates.tsx",
  "src/app/classes/attendance-actions.ts", "src/app/grades/layout.tsx", "src/app/grades/page.tsx", "src/app/grades/actions.ts",
  "src/app/grades/[id]/page.tsx", "src/app/grades/settings/actions.ts", "src/app/grades/settings/[courseId]/page.tsx",
  "src/app/my-courses/[slug]/report/page.tsx",
];
for (const f of needed) if (!fs.existsSync(f)) { console.log("MISSING FILE ", f); problems++; }

console.log(`\nApplied ${applied}, already done ${already}, problems ${problems}.`);
if (problems === 0) console.log("Everything is in place.");
