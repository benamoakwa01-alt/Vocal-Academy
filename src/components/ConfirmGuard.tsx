"use client";
import { useEffect } from "react";

// Safety net: asks for confirmation before buttons that remove or end something.
// Buttons that already ask (ConfirmButton) are skipped.
const RISKY = /^(cancel this class|decline|withdraw|suspend|revoke|remove|remove tutor role)$/i;

export default function ConfirmGuard() {
  useEffect(() => {
    function onSubmit(e: SubmitEvent) {
      const b = e.submitter as HTMLElement | null;
      if (!b || b.dataset.hasConfirm) return;
      const label = (b.textContent ?? "").trim();
      if (RISKY.test(label) && !window.confirm(`${label}? Please confirm.`)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
