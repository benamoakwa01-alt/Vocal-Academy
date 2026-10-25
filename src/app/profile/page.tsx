import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";

export default async function ProfileIndex() {
  const { user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  redirect(`/profile/${user.id}`);
}
