import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

// Only accounts the academy has suspended end up here.
export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("approved, role").eq("id", user.id).single();
  if (profile?.approved || (profile && profile.role !== "student")) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center text-gray-900">
      <h1 className="text-2xl font-bold">Your account is on hold</h1>
      <p className="max-w-md text-gray-600">
        Please contact the academy to find out why and to have your account restored.
      </p>
      <SignOutButton />
    </main>
  );
}
