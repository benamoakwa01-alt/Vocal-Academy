import Link from "next/link";
import type { ReactNode } from "react";

// Shared look for buttons, headers, panels and empty states across the internal workspace.
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101B2D] focus-visible:ring-offset-2";
export const btnPrimary = `inline-flex h-10 items-center justify-center rounded-lg bg-[#101B2D] px-4 text-sm font-semibold text-white hover:bg-[#14223A] disabled:opacity-50 ${focus}`;
export const btnSecondary = `inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-[#17253B] hover:bg-gray-50 disabled:opacity-50 ${focus}`;

export function PageHeader({
  title, description, actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[#101B2D] sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-[#647084]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title, action, children, className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          {title && <h2 className="font-semibold text-[#101B2D]">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label, value, hint, href, attention = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  attention?: boolean;
}) {
  return (
    <Link href={href}
      className={`block rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${focus} ${attention ? "border-[#D8BC7E]" : "border-gray-200"}`}>
      <p className="text-sm text-[#647084]">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${attention ? "text-[#8a6d2f]" : "text-[#101B2D]"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[#647084]">{hint}</p>}
    </Link>
  );
}

export function EmptyState({
  title, text, href, cta,
}: {
  title: string;
  text: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
      <p className="font-semibold text-[#101B2D]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#647084]">{text}</p>
      {href && cta && <Link href={href} className={`${btnPrimary} mt-4`}>{cta}</Link>}
    </div>
  );
}
