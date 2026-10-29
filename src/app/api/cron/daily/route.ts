import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyTasks } from "@/lib/jobs";

export async function GET(request: Request) {
  if (!authorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await runDailyTasks(createAdminClient()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
