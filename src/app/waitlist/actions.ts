"use server";
import { createClient } from "@/lib/supabase/server";
import { EMAIL, INSTRUMENTS, type WaitlistState } from "@/lib/waitlist";

export async function joinWaitlist(_previous: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // A field real people never see. If it is filled in, a bot did it, so we quietly pretend it worked.
  if (String(formData.get("website") ?? "")) return { status: "ok", message: "Thank you. You are on the list." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100) || null;
  const other = String(formData.get("other") ?? "").trim().slice(0, 80) || null;
  const interests = formData.getAll("interest").map(String).filter((i) => (INSTRUMENTS as readonly string[]).includes(i));

  if (email.length > 200 || !EMAIL.test(email)) return { status: "error", message: "Please enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").insert({ email, name, interests, other });
  if (error && error.code !== "23505") {
    return { status: "error", message: "We could not save that. Please try again in a moment." };
  }
  return {
    status: "ok",
    message: error
      ? "You are already on the list. We will email you when instrument lessons open."
      : "Thank you. You are on the list, and we will email you first when instrument lessons open.",
  };
}
