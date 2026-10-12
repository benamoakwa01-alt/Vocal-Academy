import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import ShellFrame from "./ShellFrame";
import { navFor } from "./nav";

// Wraps every signed-in page. Signed-out visitors are sent to the login page by requireUser.
export default async function AppShell({ children }: { children: ReactNode }) {
  const { user, profile } = await requireUser();
  return (
    <ShellFrame
      groups={navFor(profile.role)}
      user={{ name: profile.full_name ?? user.email ?? "Account", email: user.email ?? "", role: profile.role }}
    >
      {children}
    </ShellFrame>
  );
}
