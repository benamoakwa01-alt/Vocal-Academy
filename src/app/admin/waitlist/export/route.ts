import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/waitlist";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return new Response("Admins only.", { status: 403 });

  const { data } = await supabase
    .from("waitlist").select("name, email, interests, other, created_at").order("created_at", { ascending: false });
  const rows = (data ?? []) as { name: string | null; email: string; interests: string[]; other: string | null; created_at: string }[];

  const lines = [["Name", "Email", "Interests", "Other", "Joined"].join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, r.interests.join("; "), r.other, r.created_at].map(csvCell).join(","));
  }
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="instrument-waitlist.csv"',
    },
  });
}
