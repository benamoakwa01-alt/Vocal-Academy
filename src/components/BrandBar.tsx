"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_ON = [
  "/", "/login", "/signup", "/forgot-password", "/reset-password",
  "/dashboard", "/admin", "/classes", "/lessons", "/assignments", "/courses", "/my-courses", "/grades", "/notifications",
];

export default function BrandBar() {
  const path = usePathname();
  if (HIDDEN_ON.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")))) return null;
  return (
    <header className="flex h-[3.25rem] items-center border-b border-[#D8BC7E]/30 bg-[#101B2D] px-4">
      <Link href="/" className="flex items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
        <Image src="/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9 rounded" />
        <span className="font-serif text-lg tracking-wide text-[#D8BC7E]">Pneuma Music Academy</span>
      </Link>
    </header>
  );
}
