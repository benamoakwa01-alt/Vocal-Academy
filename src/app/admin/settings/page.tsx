import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { savePaymentInstructions } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "payment_instructions").maybeSingle();

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Payment details</h1>
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
        </div>
        <p className="text-sm text-gray-600">
          This text is shown to a student right after they enroll. Add your Mobile Money numbers and bank account, with the account name.
        </p>
        {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Saved.</p>}
        <form action={savePaymentInstructions} className="space-y-3 rounded-xl bg-white p-5 shadow">
          <textarea name="value" rows={9} defaultValue={data?.value ?? ""}
            placeholder={"MTN Mobile Money: 024 000 0000\nAccount name: Pneuma Music Academy\n\nBank: ...\nAccount number: ..."}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
          <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">Save</button>
        </form>
      </div>
    </main>
  );
}
