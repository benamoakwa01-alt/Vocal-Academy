"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyTasks, runRecordingCheck } from "@/lib/jobs";

export async function runNow(formData: FormData) {
  await requireAdmin();
  const which = String(formData.get("which") ?? "");
  if (!["recordings", "preview", "daily"].includes(which)) redirect("/admin/maintenance");

  let result: unknown;
  try {
    const admin = createAdminClient();
    if (which === "recordings") result = await runRecordingCheck(admin);
    else result = await runDailyTasks(admin, { dryRun: which === "preview" });
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/recordings");
  redirect(`/admin/maintenance?which=${which}&r=${encodeURIComponent(JSON.stringify(result))}`);
}
