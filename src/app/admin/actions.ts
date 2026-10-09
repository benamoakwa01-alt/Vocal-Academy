"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setApproval(formData: FormData) {
  const id = String(formData.get("id"));
  const approved = formData.get("approved") === "true";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // The database rules only allow admins to make this change.
  await supabase.from("profiles").update({ approved }).eq("id", id);
  revalidatePath("/admin");
}
