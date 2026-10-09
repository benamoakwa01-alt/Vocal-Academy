import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setApproval } from "./actions";

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  approved: boolean;
  created_at: string;
};

function StudentRow({ s, approve }: { s: Student; approve: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <p className="font-medium">{s.full_name ?? "No name"}</p>
        <p className="text-sm text-gray-600">{s.email ?? "No email"}</p>
        <p className="text-xs text-gray-400">
          Signed up {new Date(s.created_at).toLocaleDateString()}
        </p>
      </div>
      <form action={setApproval}>
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="approved" value={approve ? "true" : "false"} />
        <button
          className={
            approve
              ? "rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              : "rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
          }
        >
          {approve ? "Approve" : "Revoke"}
        </button>
      </form>
    </li>
  );
}

export default async function AdminPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, approved, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  const students = (data ?? []) as Student[];
  const pending = students.filter((s) => !s.approved);
  const approved = students.filter((s) => s.approved);

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Student approvals</h1>
          <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pending ({pending.length})</h2>
          {pending.length === 0 && <p className="text-sm text-gray-500">No students waiting.</p>}
          <ul className="space-y-2">
            {pending.map((s) => <StudentRow key={s.id} s={s} approve={true} />)}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Approved ({approved.length})</h2>
          {approved.length === 0 && <p className="text-sm text-gray-500">No approved students yet.</p>}
          <ul className="space-y-2">
            {approved.map((s) => <StudentRow key={s.id} s={s} approve={false} />)}
          </ul>
        </section>
      </div>
    </main>
  );
}
