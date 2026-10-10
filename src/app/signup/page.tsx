"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, recording_consent: true },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setError(/already registered/i.test(error.message) ? "This email is already registered. Please log in, or use Forgot password if you can't remember your password." : error.message);
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("This email is already registered. Please log in, or use Forgot password if you can't remember your password.");
    } else if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setMessage("Check your email for a confirmation link, then log in. If it does not arrive, check your spam folder.");
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <input required placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
        <input required type="password" minLength={6} placeholder="Password (min 6 characters)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" required className="mt-1" />
          <span>I understand that lessons are recorded, and that other students may appear in recordings shared with my class.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-black p-2.5 text-white hover:bg-gray-800 disabled:opacity-50">
          {loading ? "Creating..." : "Sign up"}
        </button>
        <p className="text-center text-sm text-gray-600">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}
