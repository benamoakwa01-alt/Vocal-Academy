export const INSTRUMENTS = ["Piano", "Guitar", "Drums", "Violin", "Saxophone"] as const;

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type WaitlistState = { status: "idle" | "ok" | "error"; message: string };

// One CSV cell. Cells that start with = + - @ are prefixed so a spreadsheet never runs them as a formula.
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
