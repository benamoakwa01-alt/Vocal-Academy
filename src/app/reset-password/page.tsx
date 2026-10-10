"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      if (/session/i.test(error.message)) setExpired(true);
      else setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        {expired ? (
          <p className="text-sm text-red-600">
            This reset link has expired or was already used. <Link href="/forgot-password" className="underline">Request a new one</Link>.
          </p>
        ) : (
          <>
            <input required type="password" minLength={6} placeholder="New password (min 6 characters)" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
            <input required type="password" minLength={6} placeholder="Repeat new password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-black p-2.5 text-white hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Saving..." : "Save new password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
