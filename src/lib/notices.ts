import type { SupabaseClient } from "@supabase/supabase-js";

// Adds a notification, or adds to an unread one with the same key ("3 students have handed in work").
// With once: true, a person is told only one time for a given key.
export async function pushNotice(
  admin: SupabaseClient,
  userId: string,
  n: { key: string; title: string; body: (count: number) => string; url: string; once?: boolean }
): Promise<boolean> {
  const { data: last } = await admin
    .from("notifications").select("id, count, read_at").eq("user_id", userId).eq("group_key", n.key)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (n.once && last) return false;
  if (last && !last.read_at) {
    const count = Number(last.count ?? 1) + 1;
    await admin.from("notifications")
      .update({ title: n.title, body: n.body(count), url: n.url, count, created_at: new Date().toISOString() })
      .eq("id", last.id);
    return true;
  }
  await admin.from("notifications")
    .insert({ user_id: userId, title: n.title, body: n.body(1), url: n.url, group_key: n.key, count: 1 });
  return true;
}
