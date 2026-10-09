import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("full_name, role, approved").eq("id", user.id).single();

  if (!profile || !(profile.approved || profile.role !== "student")) redirect("/pending");
  return { supabase, user, profile };
}
