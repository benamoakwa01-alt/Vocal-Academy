"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/AuthShell";
import { Alert, PasswordField, SubmitButton } from "@/components/auth/fields";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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
    <AuthShell title="Choose a new password" subtitle="Pick something you will remember.">
      {expired ? (
        <Alert kind="error">
          This reset link has expired or was already used. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label="New password" autoComplete="new-password" required minLength={6}
            hint="At least 6 characters." value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordField label="Repeat new password" autoComplete="new-password" required minLength={6}
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <Alert kind="error">{error}</Alert>}
          <SubmitButton loading={loading} loadingText="Saving...">Save new password</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
