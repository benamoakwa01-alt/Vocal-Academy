"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { toEmbedUrl } from "@/lib/video";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveTutorProfile(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");

  const id = get(formData, "tutor_id");
  const back = (qs: string) => `/profile/${id}?${qs}`;
  if (id !== user.id && profile.role !== "admin") redirect(`/profile/${user.id}`);

  const display_name = get(formData, "display_name").slice(0, 100);
  const headline = get(formData, "headline").slice(0, 120) || null;
  const bio = get(formData, "bio").slice(0, 2000) || null;
  const credentials = get(formData, "credentials").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10).map((s) => s.slice(0, 200));
  const video_url = get(formData, "video_url") || null;
  const photo_path = get(formData, "photo_path") || null;
  const published = formData.get("published") === "on";

  if (!display_name) redirect(back("error=name"));
  if (video_url && !toEmbedUrl(video_url)) redirect(back("error=video"));
  if (photo_path && !photo_path.startsWith(`${id}/`)) redirect(back("error=photo"));
  if (published && !bio) redirect(back("error=bio"));

  // The database only lets this tutor, or an admin, save the profile.
  const { error } = await supabase.from("tutor_profiles").upsert(
    { id, display_name, headline, bio, credentials, photo_path, video_url, published, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) redirect(back(`error=save&detail=${encodeURIComponent(error.message)}`));

  revalidatePath("/");
  revalidatePath("/tutors");
  revalidatePath(`/tutors/${id}`);
  redirect(back("saved=1"));
}
