"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
      Sign out
    </button>
  );
}
