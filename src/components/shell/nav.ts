// Navigation for the internal workspace. Every href below is a route that already exists in the app.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  exclude?: string[];
};
export type NavGroup = { label: string; items: NavItem[] };

const dashboard: NavItem = { href: "/dashboard", label: "Dashboard", icon: "home", exact: true };

export function navFor(role: string): NavGroup[] {
  if (role === "admin") {
    return [
      { label: "Overview", items: [dashboard] },
      {
        label: "Teaching",
        items: [
          { href: "/classes", label: "Classes", icon: "video", exclude: ["/classes/new"] },
          { href: "/classes/new", label: "Schedule class", icon: "calendar-plus", exact: true },
          { href: "/lessons", label: "Video library", icon: "book" },
          { href: "/assignments", label: "Assignments", icon: "clipboard" },
          { href: "/grades", label: "Grades", icon: "award" },
          { href: "/admin/recordings", label: "Recordings", icon: "play" },
        ],
      },
      {
        label: "Academy",
        items: [
          { href: "/admin/courses", label: "Manage courses", icon: "layers" },
          { href: "/admin/curriculum", label: "Curriculum", icon: "list" },
          { href: "/admin/cohorts", label: "Cohorts", icon: "users" },
          { href: "/courses", label: "Explore courses", icon: "compass" },
        ],
      },
      {
        label: "Students and payments",
        items: [
          { href: "/admin/students", label: "Students", icon: "user" },
          { href: "/admin/enrollments", label: "Enrollments", icon: "user-check" },
          { href: "/admin/promos", label: "Promos", icon: "tag" },
          { href: "/admin/settings", label: "Payment details", icon: "card" },
        ],
      },
      {
        label: "People",
        items: [
          { href: "/admin/people", label: "People and tutors", icon: "shield" },
          { href: "/admin", label: "Accounts", icon: "shield", exact: true },
        ],
      },
    ];
  }
  if (role === "tutor") {
    return [
      { label: "Overview", items: [dashboard] },
      {
        label: "Teaching",
        items: [
          { href: "/classes", label: "Classes", icon: "video", exclude: ["/classes/new"] },
          { href: "/classes/new", label: "Schedule class", icon: "calendar-plus", exact: true },
          { href: "/lessons", label: "Video library", icon: "book" },
          { href: "/assignments", label: "Assignments", icon: "clipboard" },
          { href: "/grades", label: "Grades", icon: "award" },
        ],
      },
      { label: "Academy", items: [{ href: "/courses", label: "Explore courses", icon: "compass" }] },
    ];
  }
  return [
    {
      label: "Learn",
      items: [
        dashboard,
        { href: "/my-courses", label: "My courses", icon: "layers" },
        { href: "/classes", label: "My classes", icon: "video" },
        { href: "/lessons", label: "Video library", icon: "book" },
        { href: "/assignments", label: "Assignments", icon: "clipboard" },
      ],
    },
    { label: "Courses", items: [{ href: "/courses", label: "Explore courses", icon: "compass" }] },
  ];
}

export function isActive(item: NavItem, path: string) {
  if (item.exclude?.some((e) => path === e || path.startsWith(e + "/"))) return false;
  if (item.exact) return path === item.href;
  return path === item.href || path.startsWith(item.href + "/");
}

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/grades\/settings/, "Grading settings"],
  [/^\/grades\/[^/]+/, "Student record"],
  [/^\/grades/, "Grades"],
  [/^\/classes\/new/, "Schedule a class"],
  [/^\/classes\/[^/]+\/recordings/, "Recording"],
  [/^\/classes\/[^/]+/, "Class"],
  [/^\/classes/, "Classes"],
  [/^\/lessons\/[^/]+/, "Video"],
  [/^\/lessons/, "Video library"],
  [/^\/assignments\/new/, "New assignment"],
  [/^\/assignments\/[^/]+\/submissions/, "Review submission"],
  [/^\/assignments\/[^/]+/, "Assignment"],
  [/^\/assignments/, "Assignments"],
  [/^\/courses\/[^/]+\/enroll/, "Complete enrollment"],
  [/^\/courses\/[^/]+/, "Course"],
  [/^\/courses/, "Explore courses"],
  [/^\/notifications/, "Notifications"],
  [/^\/my-courses\/[^/]+/, "My course"],
  [/^\/my-courses/, "My courses"],
  [/^\/admin\/students\/[^/]+/, "Student"],
  [/^\/admin\/students/, "Students"],
  [/^\/admin\/enrollments/, "Enrollments"],
  [/^\/admin\/cohorts\/[^/]+/, "Cohort"],
  [/^\/admin\/cohorts/, "Cohorts"],
  [/^\/admin\/curriculum/, "Curriculum"],
  [/^\/admin\/recordings/, "Recordings"],
  [/^\/admin\/courses\/[^/]+/, "Edit course"],
  [/^\/admin\/courses/, "Manage courses"],
  [/^\/admin\/promos/, "Promos and discounts"],
  [/^\/admin\/settings/, "Payment details"],
  [/^\/admin\/people/, "People and tutors"],
  [/^\/admin/, "Student accounts"],
];

export function titleFor(path: string, role: string) {
  if (role === "student" && path === "/classes") return "My classes";
  return TITLES.find(([re]) => re.test(path))?.[1] ?? "Pneuma Music Academy";
}
