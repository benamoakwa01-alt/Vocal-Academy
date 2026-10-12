"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/AuthShell";
import { Alert, Field, PasswordField, SubmitButton } from "@/components/auth/fields";

const ALREADY = "This email is already registered. Please log in, or use Forgot password if you cannot remember your password.";

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
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, recording_consent: true },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      setError(/already registered/i.test(error.message) ? ALREADY : error.message);
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError(ALREADY);
    } else if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    } else {
      setMessage("Check your email for a confirmation link, then log in. If it does not arrive, check your spam folder.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the academy and start learning."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-[#101B2D] underline">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Password" autoComplete="new-password" required minLength={6}
          hint="At least 6 characters." value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="flex items-start gap-2 text-sm text-[#17253B]">
          <input type="checkbox" required className="mt-1" />
          <span>I understand that lessons are recorded, and that other students may appear in recordings shared with my class.</span>
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <SubmitButton loading={loading} loadingText="Creating your account...">Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
