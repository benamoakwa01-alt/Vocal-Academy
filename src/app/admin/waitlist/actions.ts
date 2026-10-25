"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

export async function removeEntry(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("waitlist").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/waitlist");
}
