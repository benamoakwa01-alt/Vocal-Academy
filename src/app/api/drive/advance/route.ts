import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordingAccessLink } from "@/lib/daily";
import { driveConfigured } from "@/lib/drive";
import { advance } from "@/lib/drive-advance";
import { supabaseStore } from "@/lib/drive-copy";

// Each call does up to about 40 seconds of the copying, then says how far it got
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ state: "error", percent: 0, error: "Please log in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { recordingId?: unknown };
  const id = typeof body.recordingId === "string" ? body.recordingId : "";

  // The database only returns the recording to people who are allowed to see it.
  const { data: rec } = id ? await supabase.from("recordings").select("id").eq("id", id).maybeSingle() : { data: null };
  if (!rec) return NextResponse.json({ state: "error", percent: 0, error: "Not found." }, { status: 404 });
  if (!driveConfigured()) return NextResponse.json({ state: "off", percent: 0 });

  try {
    const status = await advance(supabaseStore(createAdminClient()), id, { budgetMs: 40000, link: recordingAccessLink });
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ state: "error", percent: 0, error: e instanceof Error ? e.message : String(e) });
  }
}
