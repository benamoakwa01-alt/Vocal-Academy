import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getNow } from "@/lib/classes";
import { syncClassRecordings } from "@/lib/recordings";
import { tutorNames } from "@/lib/people";
import { endClass } from "@/app/classes/actions";
import ConfirmButton from "@/components/ConfirmButton";
import LocalTime from "@/components/LocalTime";
import { PageHeader, Panel, btnPrimary, btnSecondary } from "@/components/ui";
import { approveHere, checkOne, syncAll } from "./actions";

type Cls = {
  id: string; title: string; starts_at: string; ends_at: string; status: string;
  course_id: string | null; tutor_id: string | null;
};
type Rec = { id: string; class_id: string; status: string; duration_seconds: number | null; expected_seconds: number | null };

const FILTERS = [
  ["ready", "Published"], ["review", "Needs approval"], ["processing", "Processing"],
  ["failed", "Failed"], ["missing", "No recording found"], ["notended", "Not ended in the app"],
];
const select = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";
const mins = (s: number | null) => (s === null ? "?" : `${Math.round(s / 60)} min`);

function summarise(c: Cls, recs: Rec[], now: number) {
  const mine = recs.filter((r) => r.class_id === c.id);
  const has = (s: string) => mine.some((r) => r.status === s);
  if (has("ready")) return "ready";
  if (has("review")) return "review";
  if (has("processing")) return "processing";
  if (has("failed")) return "failed";
  if (c.status === "live") return "notended";
  if (now > new Date(c.ends_at).getTime() + 15 * 60000) return "missing";
  return "waiting";
}

const badge: Record<string, { text: string; cls: string }> = {
  ready: { text: "Published", cls: "bg-green-100 text-green-800" },
  review: { text: "Needs approval", cls: "bg-amber-100 text-amber-800" },
  processing: { text: "Processing", cls: "bg-blue-100 text-blue-800" },
  failed: { text: "Failed", cls: "bg-red-100 text-red-700" },
  missing: { text: "No recording found", cls: "bg-red-100 text-red-700" },
  notended: { text: "Not ended in the app", cls: "bg-amber-100 text-amber-800" },
  waiting: { text: "Waiting", cls: "bg-gray-100 text-gray-700" },
};

export default async function AdminRecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; status?: string; checked?: string; failed?: string; detail?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const now = getNow();
  const since = new Date(now - 90 * 86400000).toISOString();

  // Finished classes, plus classes still marked live whose time is over (recorded but never ended)
  const { data: clsData } = await supabase
    .from("classes").select("id, title, starts_at, ends_at, status, course_id, tutor_id")
    .in("status", ["completed", "live"]).gte("ends_at", since)
    .order("starts_at", { ascending: false }).limit(100);
  const candidates = ((clsData ?? []) as Cls[]).filter(
    (c) => c.status === "completed" || new Date(c.ends_at).getTime() < now
  );
  const ids = candidates.map((c) => c.id);

  const { data: sessions } = ids.length
    ? await supabase.from("live_sessions").select("class_id").in("class_id", ids).not("room_name", "is", null)
    : { data: [] };
  const held = new Set(((sessions ?? []) as { class_id: string }[]).map((s) => s.class_id));
  const classes = candidates.filter((c) => held.has(c.id));

  async function loadRecs() {
    if (!classes.length) return [] as Rec[];
    const { data } = await supabase
      .from("recordings").select("id, class_id, status, duration_seconds, expected_seconds")
      .in("class_id", classes.map((c) => c.id));
    return (data ?? []) as Rec[];
  }
  let recs = await loadRecs();

  // Ask Daily about anything that has no usable recording yet
  const needsSync = classes
    .filter((c) => !recs.some((r) => r.class_id === c.id && (r.status === "ready" || r.status === "review")))
    .slice(0, 8);
  let providerFailures = 0;
  let firstFailure: string | null = null;
  if (needsSync.length) {
    const results = await Promise.all(needsSync.map((c) => syncClassRecordings(supabase, c.id)));
    providerFailures = results.filter((r) => !r.ok && r.reason !== "no-room").length;
    const bad = results.find((r) => !r.ok && r.reason !== "no-room");
    firstFailure = bad && !bad.ok ? bad.detail : null;
    recs = await loadRecs();
  }

  const courseIds = [...new Set(classes.map((c) => c.course_id).filter((x): x is string => !!x))];
  const { data: cData } = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [] };
  const titleOf = new Map(((cData ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
  const names = await tutorNames(supabase, classes.map((c) => c.tutor_id));

  const decorated = classes.map((c) => ({ c, state: summarise(c, recs, now) }));
  const shown = decorated.filter(({ c, state }) =>
    (!sp.course || (sp.course === "none" ? !c.course_id : c.course_id === sp.course)) &&
    (!sp.status || state === sp.status)
  );

  const groups = new Map<string, typeof shown>();
  for (const row of shown) {
    const key = row.c.course_id ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const filtered = !!(sp.course || sp.status);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Recordings" description="Every class that was held, grouped by course."
        actions={<form action={syncAll}><button className={btnPrimary}>Check Daily now</button></form>} />

      {sp.checked !== undefined && (
        <p role="status" className={`rounded-lg p-3 text-sm ${Number(sp.failed) > 0 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
          Checked Daily for {sp.checked} {Number(sp.checked) === 1 ? "class" : "classes"}.
          {Number(sp.failed) > 0 && ` ${sp.failed} could not be checked.${sp.detail ? ` Reason: ${sp.detail}` : ""}`}
        </p>
      )}
      {providerFailures > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          We could not check {providerFailures} {providerFailures === 1 ? "class" : "classes"}{firstFailure ? ` (${firstFailure})` : ""}. Check that
          DAILY_API_KEY and DAILY_DOMAIN are set correctly where the site runs (Vercel, or .env.local on your Codespace), then try again.
        </p>
      )}

      <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="block text-sm">Course
          <select name="course" defaultValue={sp.course ?? ""} className={`${select} mt-1`}>
            <option value="">All courses</option>
            {[...titleOf.entries()].map(([id, t]) => <option key={id} value={id}>{t}</option>)}
            <option value="none">Individual classes</option>
          </select>
        </label>
        <label className="block text-sm">Recording
          <select name="status" defaultValue={sp.status ?? ""} className={`${select} mt-1`}>
            <option value="">Any</option>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className={btnPrimary}>Apply</button>
          {filtered && <Link href="/admin/recordings" className={btnSecondary}>Clear</Link>}
        </div>
      </form>

      {classes.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-[#647084]">
          No classes have been held in the app yet. A class appears here after the tutor starts it and its time is over.
        </p>
      )}
      {classes.length > 0 && shown.length === 0 && (
        <p className="text-sm text-[#647084]">No classes match these filters.</p>
      )}

      {[...groups.entries()].map(([key, rows]) => (
        <Panel key={key} title={key === "none" ? "Individual classes" : titleOf.get(key) ?? "Course"}>
          <ul className="space-y-3">
            {rows.map(({ c, state }) => {
              const mine = recs.filter((r) => r.class_id === c.id);
              const b = badge[state];
              return (
                <li key={c.id} className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/classes/${c.id}`} className="font-medium text-[#101B2D] underline-offset-2 hover:underline">{c.title}</Link>
                      <p className="text-sm text-[#647084]">
                        <LocalTime iso={c.starts_at} />{c.tutor_id && names[c.tutor_id] ? ` · ${names[c.tutor_id]}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${b.cls}`}>{b.text}</span>
                  </div>

                  {mine.length > 0 && (
                    <ul className="space-y-2">
                      {mine.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                          <span>
                            Recording · {mins(r.duration_seconds)}
                            {r.status === "review" && <span className="text-amber-700"> · scheduled {mins(r.expected_seconds)}</span>}
                            <span className="text-[#647084]"> · {badge[r.status]?.text ?? r.status}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            {(r.status === "ready" || r.status === "review") && (
                              <Link href={`/classes/${c.id}/recordings/${r.id}`} className={`${btnPrimary} h-9`}>Watch</Link>
                            )}
                            {r.status === "review" && (
                              <form action={approveHere}>
                                <input type="hidden" name="id" value={r.id} />
                                <button className={`${btnSecondary} h-9`}>Approve</button>
                              </form>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {state === "missing" && (
                    <p className="text-sm text-[#647084]">
                      Daily has no recording for this class. The tutor may not have pressed Record. Use Check again if you know it was recorded.
                    </p>
                  )}
                  {state === "notended" && (
                    <p className="text-sm text-[#647084]">
                      The lesson time is over but it was never ended in the app. End it so students see it as completed.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <form action={checkOne}>
                      <input type="hidden" name="class_id" value={c.id} />
                      <button className={`${btnSecondary} h-9`}>Check again</button>
                    </form>
                    {c.status === "live" && (
                      <form action={endClass}>
                        <input type="hidden" name="class_id" value={c.id} />
                        <ConfirmButton label="Mark as ended" message="Mark this class as ended?"
                          className={`${btnSecondary} h-9`} />
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}
    </main>
  );
}
