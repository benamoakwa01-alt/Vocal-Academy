"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

export async function savePaymentInstructions(formData: FormData) {
  const { supabase } = await requireAdmin();
  const value = String(formData.get("value") ?? "").trim();
  await supabase.from("site_settings").upsert(
    { key: "payment_instructions", value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
