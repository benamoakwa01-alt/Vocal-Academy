"use client";
import { useSyncExternalStore } from "react";
import { formatRange, formatWhen } from "@/lib/classes";

const subscribe = () => () => {};

// Renders times in the viewer's own timezone, without hydration mismatches.
export default function LocalTime({ iso, end }: { iso: string; end?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <span className="text-gray-400">…</span>;
  return <span>{end ? formatRange(iso, end) : formatWhen(iso)}</span>;
}
