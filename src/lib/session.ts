import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Logged-in user only (does NOT require account approval). Used by the course catalog.
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("profiles").select("full_name, role, approved").eq("id", user.id).single();
  const profile = data ?? { full_name: null, role: "student", approved: false };
  return { supabase, user, profile };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/dashboard");
  return ctx;
}
