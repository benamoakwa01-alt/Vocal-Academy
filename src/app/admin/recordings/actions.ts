"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { syncClassRecordings, type SyncResult } from "@/lib/recordings";

function summarise(results: SyncResult[]) {
  const checked = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok && r.reason !== "no-room");
  const first = bad.find((r) => !r.ok);
  return { checked, failed: bad.length, detail: first && !first.ok ? first.detail : "" };
}

function backTo(s: { checked: number; failed: number; detail: string }) {
  const more = s.detail ? `&detail=${encodeURIComponent(s.detail)}` : "";
  return `/admin/recordings?checked=${s.checked}&failed=${s.failed}${more}`;
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
  revalidatePath("/admin/recordings");
  redirect(backTo(summarise(results)));
}

export async function checkOne(formData: FormData) {
  const { supabase } = await requireAdmin();
  const result = await syncClassRecordings(supabase, String(formData.get("class_id") ?? ""));
  revalidatePath("/admin/recordings");
  redirect(backTo({
    checked: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
    detail: result.ok ? "" : result.detail,
  }));
}

export async function approveHere(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("recordings")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id") ?? "")).eq("status", "review");
  revalidatePath("/admin/recordings");
  redirect("/admin/recordings");
}
