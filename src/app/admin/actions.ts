"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notify";

export async function setApproval(formData: FormData) {
  const id = String(formData.get("id"));
  const approved = formData.get("approved") === "true";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // The database rules only allow admins to make this change.
  const { data: changed } = await supabase.from("profiles").update({ approved }).eq("id", id).select("id");
  if (approved && changed && changed.length > 0) {
    await notifyUser(supabase, id, {
      title: "Your account has been approved",
      body: "Welcome to Pneuma Music Academy. Your account is now active, so you can log in and see your courses, classes and lessons.",
      path: "/dashboard",
      buttonLabel: "Open the academy",
    });
  }
  revalidatePath("/admin");
}
