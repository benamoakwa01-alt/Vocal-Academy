"use client";
import { useActionState } from "react";
import { joinWaitlist } from "@/app/waitlist/actions";
import { INSTRUMENTS, type WaitlistState } from "@/lib/waitlist";

const initial: WaitlistState = { status: "idle", message: "" };
const field = "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-[#17253B]";

export default function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, initial);

  if (state.status === "ok") {
    return <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#17253B]">Your name (optional)
          <input name="name" autoComplete="name" className={field} />
        </label>
        <label className="block text-sm font-medium text-[#17253B]">Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-[#17253B]">Which instruments interest you?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INSTRUMENTS.map((i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-[#17253B] has-[:checked]:border-[#101B2D] has-[:checked]:bg-[#101B2D] has-[:checked]:text-white">
              <input type="checkbox" name="interest" value={i} className="sr-only" /> {i}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm text-[#17253B]">Something else?
          <input name="other" maxLength={80} placeholder="For example: trumpet" className={`${field} sm:max-w-xs`} />
        </label>
      </fieldset>

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {state.status === "error" && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      <button disabled={pending}
        className="inline-flex h-11 items-center rounded-lg bg-[#101B2D] px-6 font-semibold text-white hover:bg-[#14223A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101B2D] focus-visible:ring-offset-2 disabled:opacity-60">
        {pending ? "Joining..." : "Join the waitlist"}
      </button>
      <p className="text-xs text-[#647084]">We will only use your email to tell you about instrument lessons.</p>
    </form>
  );
}
