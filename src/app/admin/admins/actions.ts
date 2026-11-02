"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushNotice } from "@/lib/notices";
import { sendEmail } from "@/lib/email";

const here = (qs: string) => `/admin/admins?${qs}`;

export async function makeAdmin(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("user_id") ?? "");
  if (!id) redirect(here("error=choose"));

  const { data: target } = await supabase.from("profiles").select("id, full_name, email, role").eq("id", id).maybeSingle();
  if (!target) redirect(here("error=missing"));
  if (target.role === "admin") redirect(here("error=already"));

  // The database only lets an admin do this.
  const { error } = await supabase.from("profiles").update({ role: "admin", approved: true }).eq("id", id);
  if (error) redirect(here(`error=save&detail=${encodeURIComponent(error.message)}`));

  // Tell them. This never blocks the change if it fails.
  try {
    const admin = createAdminClient();
    await pushNotice(admin, id, {
      key: `admin-role:${id}`,
      title: "You are now an administrator",
      body: () => "You can now manage students, payments, courses and tutors. Open Admin in the menu.",
      url: "/dashboard",
    });
    if (target.email) {
      await sendEmail({
        to: target.email,
        subject: "You are now an administrator at Pneuma Music Academy",
        heading: "You are now an administrator",
        body: "You can now manage students, payments, courses and tutors. Please keep your password private.",
        path: "/dashboard",
        buttonLabel: "Open the dashboard",
      }).catch(() => false);
    }
  } catch (e) {
    console.error("Admin notice not sent:", e instanceof Error ? e.message : e);
  }

  revalidatePath("/admin/admins");
  revalidatePath("/admin/people");
  redirect(here("saved=added"));
}

export async function removeAdmin(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = String(formData.get("user_id") ?? "");
  const becomes = formData.get("becomes") === "student" ? "student" : "tutor";

  if (id === user.id) redirect(here("error=self"));
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) <= 1) redirect(here("error=last"));

  const { data: target } = await supabase.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (!target || target.role !== "admin") redirect(here("error=missing"));

  const { error } = await supabase.from("profiles").update({ role: becomes }).eq("id", id);
  if (error) redirect(here(`error=save&detail=${encodeURIComponent(error.message)}`));

  revalidatePath("/admin/admins");
  revalidatePath("/admin/people");
  redirect(here("saved=removed"));
}
