const fs = require("fs");
const R = String.raw;
const edits = [];
const add = (file, done, find, replace, opts = {}) => edits.push({ file, done, find, replace, ...opts });

const NAV = "src/components/shell/nav.ts";
const HOME = "src/app/page.tsx";
const COURSE = "src/app/courses/[slug]/page.tsx";

// Images from Supabase storage
add("next.config.ts", "remotePatterns", "const nextConfig: NextConfig = {",
  'const nextConfig: NextConfig = {\n  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },');

// Sidebar and page titles
add(NAV, '"/my-grades"',
  '        { href: "/assignments", label: "Assignments", icon: "clipboard" },\n      ],',
  '        { href: "/assignments", label: "Assignments", icon: "clipboard" },\n        { href: "/my-grades", label: "My grades", icon: "award" },\n      ],');
add(NAV, '"/admin/waitlist"', '{ href: "/admin/promos", label: "Promos", icon: "tag" },',
  '{ href: "/admin/promos", label: "Promos", icon: "tag" },\n          { href: "/admin/waitlist", label: "Waitlist", icon: "list" },');
add(NAV, '"My grades"]', R`  [/^\/dashboard/, "Dashboard"],`, [
  R`  [/^\/dashboard/, "Dashboard"],`,
  R`  [/^\/my-grades/, "My grades"],`,
  R`  [/^\/profile/, "My profile"],`,
  R`  [/^\/admin\/waitlist/, "Instrument waitlist"],`].join("\n"));

// The old top bar must not show on these pages
add("src/components/BrandBar.tsx", '"/my-grades"', '"/grades", "/notifications",',
  '"/grades", "/my-grades", "/profile", "/tutors", "/notifications",');

// "My profile" in the account menu for tutors and admins
add("src/components/shell/ShellFrame.tsx", "My profile",
  '<Link role="menuitem" href="/notifications" onClick={() => setOpen(false)} className={item}>Notifications</Link>',
  '{user.role !== "student" && <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={item}>My profile</Link>}\n          <Link role="menuitem" href="/notifications" onClick={() => setOpen(false)} className={item}>Notifications</Link>');

// Admin: edit a tutor's public profile from the People page
add("src/app/admin/people/page.tsx", "Public profile",
  '<p className="font-medium">{t.full_name ?? "Unnamed"}</p>',
  '<p className="font-medium">{t.full_name ?? "Unnamed"} <Link href={`/profile/${t.id}`} className="ml-2 text-sm font-normal underline">Public profile</Link></p>');

// Course page: "Your instructor"
add(COURSE, "import InstructorCard", 'import CourseSummary from "@/components/CourseSummary";',
  'import CourseSummary from "@/components/CourseSummary";\nimport InstructorCard from "@/components/InstructorCard";');
add(COURSE, "<InstructorCard", '<div className="order-2 space-y-8 lg:order-1 lg:col-span-2">',
  '<div className="order-2 space-y-8 lg:order-1 lg:col-span-2">\n            <InstructorCard supabase={supabase} tutorId={course.instructor_id} />');

// Homepage
add(HOME, "import TutorsSection", 'import StaveDivider from "@/components/StaveDivider";',
  'import StaveDivider from "@/components/StaveDivider";\nimport TutorsSection from "@/components/TutorsSection";\nimport WaitlistSection from "@/components/WaitlistSection";');
add(HOME, "<WaitlistSection />", '<section id="how-it-works" className="bg-white py-16">',
  '<WaitlistSection />\n\n        <section id="how-it-works" className="bg-white py-16">');
add(HOME, "<TutorsSection />", '<section className="bg-[#101B2D] py-14 text-white">',
  '<TutorsSection />\n\n        <section className="bg-[#101B2D] py-14 text-white">');
add(HOME, 'href="/tutors"', '<a href="#how-it-works" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">How it works</a>',
  '<a href="#how-it-works" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">How it works</a>\n            <Link href="/tutors" className="hidden text-sm text-[#C9D1DF] hover:text-white sm:inline">Tutors</Link>');

let applied = 0, already = 0, problems = 0;
for (const e of edits) {
  if (!fs.existsSync(e.file)) { console.log("MISSING FILE ", e.file); problems++; continue; }
  const raw = fs.readFileSync(e.file, "utf8");
  const crlf = raw.includes("\r\n");
  let s = raw.replace(/\r\n/g, "\n");
  if (s.includes(e.done)) { already++; continue; }
  if (!s.includes(e.find)) { console.log("NOT FOUND    ", e.file, "->", e.find.slice(0, 80)); problems++; continue; }
  s = s.replace(e.find, () => e.replace);
  fs.writeFileSync(e.file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("APPLIED      ", e.file, "->", e.done.slice(0, 50));
  applied++;
}
console.log(`\nApplied ${applied}, already done ${already}, problems ${problems}.`);
if (problems === 0) console.log("Everything is in place.");
