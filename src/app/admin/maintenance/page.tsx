import { requireAdmin } from "@/lib/session";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import { runNow } from "./actions";

const names: Record<string, string> = {
  recordings: "Recording check", preview: "Preview of the daily tasks (nothing was changed)", daily: "Daily tasks",
};

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ which?: string; r?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();

  const setting = (name: string) => Boolean(process.env[name]);
  const checks: [string, string, boolean][] = [
    ["Supabase secret key", "SUPABASE_SECRET_KEY", setting("SUPABASE_SECRET_KEY")],
    ["Scheduled-job password", "CRON_SECRET", setting("CRON_SECRET")],
    ["Daily key", "DAILY_API_KEY", setting("DAILY_API_KEY")],
    ["Email sender", "GMAIL_USER", setting("GMAIL_USER")],
  ];

  const head = { count: "exact" as const, head: true };
  const total = (await supabase.from("recordings").select("id", head).is("purged_at", null)).count ?? 0;
  const trash = (await supabase.from("recordings").select("id", head).not("deleted_at", "is", null).is("purged_at", null)).count ?? 0;
  const held = (await supabase.from("recordings").select("id", head).eq("keep", true).is("purged_at", null)).count ?? 0;
  const gone = (await supabase.from("recordings").select("id", head).not("purged_at", "is", null)).count ?? 0;

  let result: unknown = null;
  if (sp.r) {
    try { result = JSON.parse(sp.r); } catch { result = null; }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Automatic tasks" description="What runs by itself, and a way to run it now to see what it does." />

      <Panel title="Is everything set up?">
        <ul className="space-y-2 text-sm">
          {checks.map(([label, name, ok]) => (
            <li key={name} className="flex items-center justify-between gap-3">
              <span>{label} <span className="text-xs text-[#647084]">({name})</span></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{ok ? "Set" : "Missing"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#647084]">This shows only whether each value exists on the server, never the value itself.</p>
      </Panel>

      <Panel title="Recordings at a glance">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-[#647084]">Stored</dt><dd className="text-2xl font-semibold text-[#101B2D]">{total}</dd></div>
          <div><dt className="text-[#647084]">In the trash</dt><dd className="text-2xl font-semibold text-[#101B2D]">{trash}</dd></div>
          <div><dt className="text-[#647084]">On hold</dt><dd className="text-2xl font-semibold text-[#101B2D]">{held}</dd></div>
          <div><dt className="text-[#647084]">Deleted</dt><dd className="text-2xl font-semibold text-[#101B2D]">{gone}</dd></div>
        </dl>
      </Panel>

      <Panel title="Run something now">
        <div className="space-y-4">
          <form action={runNow} className="space-y-1">
            <input type="hidden" name="which" value="recordings" />
            <button className={btnSecondary}>Check for new recordings</button>
            <p className="text-xs text-[#647084]">Finds recordings of recent classes, and closes classes that were never ended.</p>
          </form>
          <form action={runNow} className="space-y-1">
            <input type="hidden" name="which" value="preview" />
            <button className={btnSecondary}>Preview the daily tasks</button>
            <p className="text-xs text-[#647084]">Shows what would be removed, warned about or emailed. Changes nothing.</p>
          </form>
          <form action={runNow} className="space-y-1">
            <input type="hidden" name="which" value="daily" />
            <button className={btnPrimary}>Run the daily tasks now</button>
            <p className="text-xs text-[#647084]">Applies the recording retention rules, sends due-date reminders and the tutor email.</p>
          </form>
        </div>
      </Panel>

      {result !== null && (
        <Panel title={names[sp.which ?? ""] ?? "Result"}>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[#17253B]">{JSON.stringify(result, null, 2)}</pre>
        </Panel>
      )}
    </main>
  );
}
