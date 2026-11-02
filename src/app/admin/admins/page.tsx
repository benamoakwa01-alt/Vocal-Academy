import { requireAdmin } from "@/lib/session";
import ConfirmButton from "@/components/ConfirmButton";
import LocalTime from "@/components/LocalTime";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import { makeAdmin, removeAdmin } from "./actions";

type Person = { id: string; full_name: string | null; email: string | null; role?: string; created_at?: string };

const errors: Record<string, string> = {
  choose: "Choose a person first.",
  missing: "That account could not be found.",
  already: "That person is already an administrator.",
  self: "You cannot remove your own admin access. Ask another administrator to do it.",
  last: "There must always be at least one administrator, so the last one cannot be removed.",
  save: "Could not save the change.",
};

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; error?: string; detail?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, user } = await requireAdmin();

  const { data: aData } = await supabase
    .from("profiles").select("id, full_name, email, created_at").eq("role", "admin").order("created_at", { ascending: true });
  const admins = (aData ?? []) as Person[];

  // Search for an existing account by name or email (only safe characters are used)
  const q = (sp.q ?? "").trim().replace(/[^a-zA-Z0-9@._+\- ]/g, "").slice(0, 60);
  const found = new Map<string, Person>();
  if (q.length >= 2) {
    const pattern = `%${q}%`;
    const { data: byEmail } = await supabase.from("profiles").select("id, full_name, email, role").neq("role", "admin").ilike("email", pattern).limit(20);
    const { data: byName } = await supabase.from("profiles").select("id, full_name, email, role").neq("role", "admin").ilike("full_name", pattern).limit(20);
    for (const p of [...(byEmail ?? []), ...(byName ?? [])] as Person[]) found.set(p.id, p);
  }
  const people = [...found.values()].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Administrators" description="People who can manage everything on the platform." />

      {sp.saved && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {sp.saved === "added" ? "Done. They are now an administrator and have been told." : "Done. Their admin access has been removed."}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors[sp.error] ?? "Something went wrong."} {sp.detail ?? ""}
        </p>
      )}

      <Panel title={`Current administrators (${admins.length})`}>
        <ul className="space-y-2">
          {admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <div className="min-w-0">
                <p className="font-medium text-[#17253B]">
                  {a.full_name ?? "No name"}
                  {a.id === user.id && <span className="ml-2 rounded-full bg-[#D8BC7E]/40 px-2 py-0.5 text-xs font-medium text-[#101B2D]">You</span>}
                </p>
                <p className="truncate text-sm text-[#647084]">{a.email}</p>
                {a.created_at && <p className="text-xs text-[#647084]">Joined <LocalTime iso={a.created_at} /></p>}
              </div>
              {a.id !== user.id && admins.length > 1 && (
                <form action={removeAdmin} className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={a.id} />
                  <select name="becomes" defaultValue="tutor" aria-label="They become"
                    className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-[#17253B]">
                    <option value="tutor">Becomes a tutor</option>
                    <option value="student">Becomes a student</option>
                  </select>
                  <ConfirmButton label="Remove admin" message="Remove this person's admin access?" className="text-sm text-red-600 underline" />
                </form>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Add an administrator">
        <p className="mb-3 text-sm text-[#647084]">
          The person must already have an account on the platform (ask them to sign up first). Search for them by name or email.
        </p>
        <form method="get" className="flex flex-col gap-2 sm:flex-row">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or email" aria-label="Search for a person"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]" />
          <button className={`${btnSecondary} sm:shrink-0`}>Search</button>
        </form>

        {q.length >= 2 && people.length === 0 && (
          <p className="mt-3 text-sm text-[#647084]">No matching account. Check the spelling, or ask them to sign up first.</p>
        )}
        {people.length > 0 && (
          <ul className="mt-3 space-y-2">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#17253B]">{p.full_name ?? "No name"} <span className="text-xs font-normal capitalize text-[#647084]">({p.role})</span></p>
                  <p className="truncate text-sm text-[#647084]">{p.email}</p>
                </div>
                <form action={makeAdmin}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <ConfirmButton label="Make admin" message={`Make ${p.full_name ?? p.email} an administrator? They will be able to see and change everything, including payments and student records.`}
                    className={btnPrimary} />
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[#647084]">
          Administrators can see and change everything, including payments, students&apos; records and other admins. Only add people you trust.
        </p>
      </Panel>
    </main>
  );
}
