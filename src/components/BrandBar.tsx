"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BrandBar() {
  const path = usePathname();
  if (path === "/" || path.endsWith("/room")) return null;
  return (
    <header className="flex h-[3.25rem] items-center border-b border-[#bfa26b]/30 bg-[#0b1423] px-4">
      <Link href="/dashboard" className="flex items-center gap-3">
        <Image src="/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9 rounded" />
        <span className="font-serif text-lg tracking-wide text-[#ead39e]">Pneuma Music Academy</span>
      </Link>
    </header>
  );
}
