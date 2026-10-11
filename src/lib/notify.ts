import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

// Creates an in-app notification and sends an email. Never throws, so a mail problem
// can never break the action that triggered it.
export async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  n: { title: string; body: string; path: string; buttonLabel?: string; email?: boolean }
) {
  try {
    const { error } = await supabase.rpc("notify_user", { uid: userId, t: n.title, b: n.body, u: n.path });
    if (error) console.error("notify_user failed:", error.message);
    if (n.email === false) return;

    const { data: p } = await supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    if (p?.email) {
      await sendEmail({
        to: p.email,
        subject: n.title,
        heading: n.title,
        body: p.full_name ? `Hello ${p.full_name},\n\n${n.body}` : n.body,
        path: n.path,
        buttonLabel: n.buttonLabel,
      });
    }
  } catch (e) {
    console.error("notifyUser failed:", e);
  }
}
