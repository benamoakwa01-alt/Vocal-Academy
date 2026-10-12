"use client";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-[#17253B] placeholder:text-gray-400 focus-visible:border-[#101B2D]";

type FieldProps = { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, hint, ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[#17253B]">{label}</label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} {...props} />
      {hint && <p id={`${id}-hint`} className="text-xs text-[#647084]">{hint}</p>}
    </div>
  );
}

export function PasswordField({ label, hint, ...props }: Omit<FieldProps, "type">) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[#17253B]">{label}</label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${inputClass} pr-16`} {...props} />
        <button type="button" onClick={() => setShow(!show)} aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-sm font-medium text-[#101B2D] hover:underline">
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-[#647084]">{hint}</p>}
    </div>
  );
}

export function SubmitButton({
  loading, loadingText, children,
}: {
  loading: boolean;
  loadingText: string;
  children: ReactNode;
}) {
  return (
    <button disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#101B2D] font-semibold text-white hover:bg-[#14223A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101B2D] focus-visible:ring-offset-2 disabled:opacity-60">
      {loading ? loadingText : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg p-3 text-sm ${kind === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
      {children}
    </p>
  );
}
