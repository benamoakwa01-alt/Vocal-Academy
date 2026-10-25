import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorProfile = {
  id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  credentials: string[];
  photo_path: string | null;
  video_url: string | null;
  published: boolean;
};

export const TUTOR_COLUMNS = "id, display_name, headline, bio, credentials, photo_path, video_url, published";

export function photoUrl(supabase: SupabaseClient, path: string | null) {
  if (!path) return null;
  return supabase.storage.from("tutor-photos").getPublicUrl(path).data.publicUrl;
}

export function excerpt(text: string | null, max = 220): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max * 0.55 ? space : max)}\u2026`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "T";
}
