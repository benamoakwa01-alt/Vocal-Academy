import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getNow } from "@/lib/classes";
import LocalTime from "@/components/LocalTime";

type N = { id: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []) as N[];

  if (items.some((n) => !n.read_at)) {
    await supabase.from("notifications")
      .update({ read_at: new Date(getNow()).toISOString() })
      .eq("user_id", user.id).is("read_at", null);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>
        {items.length === 0 && <p className="text-sm text-gray-500">No notifications yet.</p>}
        <ul className="space-y-2">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start gap-3">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-blue-600"}`} />
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
                  <p className="text-xs text-gray-500"><LocalTime iso={n.created_at} /></p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="rounded-lg border border-gray-200 bg-white p-3">
                {n.url ? <Link href={n.url} className="block hover:opacity-80">{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
