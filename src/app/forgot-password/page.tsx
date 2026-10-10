"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        {sent ? (
          <p className="text-sm text-green-700">
            If an account exists for that email, a reset link is on its way. It can take a few minutes, so check your spam folder too.
          </p>
        ) : (
          <>
            <input required type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-black p-2.5 text-white hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-center text-sm text-gray-600">
          <Link href="/login" className="underline">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}
