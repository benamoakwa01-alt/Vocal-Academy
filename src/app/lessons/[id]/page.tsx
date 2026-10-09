import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { toEmbedUrl } from "@/lib/video";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAccess();

  const { data: lesson } = await supabase
    .from("lessons").select("title, description, video_url").eq("id", id).single();
  if (!lesson) notFound();

  const embed = toEmbedUrl(lesson.video_url);

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/lessons" className="text-sm underline">Back to lessons</Link>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        {embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe src={embed} title={lesson.title} className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen />
          </div>
        ) : (
          <p className="text-red-600">This video link could not be loaded.</p>
        )}
        {lesson.description && <p className="text-gray-700">{lesson.description}</p>}
      </div>
    </main>
  );
}
