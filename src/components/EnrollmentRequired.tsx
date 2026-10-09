import Link from "next/link";

export default function EnrollmentRequired({
  courseSlug, title = "Enrollment required", message,
}: {
  courseSlug?: string;
  title?: string;
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-gray-600">
        {message ?? "This content is only available to students enrolled in the course."}
      </p>
      <Link href={courseSlug ? `/courses/${courseSlug}` : "/courses"}
        className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
        {courseSlug ? "View course" : "Explore courses"}
      </Link>
    </div>
  );
}
