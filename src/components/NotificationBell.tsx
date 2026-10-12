"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell({ className = "text-[#ead39e] hover:text-white" }: { className?: string }) {
  const path = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const { count: n } = await createClient()
        .from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (active) setCount(path === "/notifications" ? 0 : n ?? 0);
    }
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [path]);

  return (
    <Link href="/notifications" aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className={`relative rounded-lg p-2 hover:bg-gray-100/10 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
