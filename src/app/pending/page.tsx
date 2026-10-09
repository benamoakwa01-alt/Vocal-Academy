import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function PendingPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("approved, role").eq("id", user.id).single();
  if (profile?.approved || (profile && profile.role !== "student")) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center text-gray-900">
      <h1 className="text-2xl font-bold">Your account is pending approval</h1>
      <p className="max-w-md text-gray-600">
        Once your payment is confirmed, the academy will approve your account and you will get access
        to classes and lessons. Please check back soon.
      </p>
      <SignOutButton />
    </main>
  );
}
