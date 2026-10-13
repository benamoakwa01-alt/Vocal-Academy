"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { syncClassRecordings } from "@/lib/recordings";

type Outcome = Awaited<ReturnType<typeof syncClassRecordings>>;

function tally(results: Outcome[]) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && r.reason !== "no-room").length;
  return { ok, failed };
}

// Asks Daily about every class that has already finished
export async function syncAll() {
  const { supabase } = await requireAdmin();
  const nowIso = new Date(getNow()).toISOString();
  const since = new Date(getNow() - 90 * 86400000).toISOString();
  const { data } = await supabase
    .from("classes").select("id").in("status", ["completed", "live"])
    .gte("ends_at", since).lt("ends_at", nowIso).order("starts_at", { ascending: false }).limit(40);
  const results = await Promise.all((data ?? []).map((c: { id: string }) => syncClassRecordings(supabase, c.id)));
  const { ok, failed } = tally(results);
  revalidatePath("/admin/recordings");
  redirect(`/admin/recordings?checked=${ok}&failed=${failed}`);
}

export async function checkOne(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await syncClassRecordings(supabase, String(formData.get("class_id") ?? ""));
  revalidatePath("/admin/recordings");
  redirect(`/admin/recordings?checked=${result.ok ? 1 : 0}&failed=${result.ok ? 0 : 1}`);
}

export async function approveHere(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("recordings")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id") ?? "")).eq("status", "review");
  revalidatePath("/admin/recordings");
  redirect("/admin/recordings");
}
