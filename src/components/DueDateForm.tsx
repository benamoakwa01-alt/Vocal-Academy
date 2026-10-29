"use client";
import { useActionState } from "react";
import { setDueDates } from "@/app/assignments/due-actions";
import type { FormState } from "@/lib/forms";

const initial: FormState = { status: "idle", message: "" };
const field = "mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#17253B]";

export default function DueDateForm({ assignmentId, dueAt, closesAt }: { assignmentId: string; dueAt: string; closesAt: string }) {
  const [state, action, pending] = useActionState(setDueDates, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Due date and time (Ghana time)
          <input name="due_at" type="datetime-local" defaultValue={dueAt} className={field} />
        </label>
        <label className="block text-sm">Stop accepting work after (optional)
          <input name="closes_at" type="datetime-local" defaultValue={closesAt} className={field} />
        </label>
      </div>
      <p className="text-xs text-[#647084]">
        Work handed in after the due time is marked late. Work cannot be handed in after the stop time. Leave a box empty for none.
      </p>
      {state.status !== "idle" && (
        <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>
          {state.message}
        </p>
      )}
      <button disabled={pending}
        className="inline-flex h-10 items-center rounded-lg bg-[#101B2D] px-4 text-sm font-semibold text-white hover:bg-[#14223A] disabled:opacity-60">
        {pending ? "Saving..." : "Save dates"}
      </button>
    </form>
  );
}
