"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access";
import { parseInputValue } from "@/lib/due";
import type { FormState } from "@/lib/forms";

export async function setDueDates(_previous: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireAccess();
  if (profile.role === "student") return { status: "error", message: "Only staff can change due dates." };

  const id = String(formData.get("assignment_id") ?? "");
  const dueRaw = String(formData.get("due_at") ?? "").trim();
  const closeRaw = String(formData.get("closes_at") ?? "").trim();
  const due = parseInputValue(dueRaw);
  const closes = parseInputValue(closeRaw);
  if ((dueRaw && !due) || (closeRaw && !closes)) return { status: "error", message: "That date could not be read. Please choose it again." };
  if (due && closes && closes < due) return { status: "error", message: "Work cannot stop being accepted before it is due." };

  // The database only lets an admin or the course instructor change this.
  const { data, error } = await supabase.from("assignments").update({ due_at: due, closes_at: closes }).eq("id", id).select("id");
  if (error || !data || data.length === 0) {
    return { status: "error", message: "You can only change due dates for courses you teach." };
  }
  revalidatePath(`/assignments/${id}`);
  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { status: "ok", message: "Saved." };
}
