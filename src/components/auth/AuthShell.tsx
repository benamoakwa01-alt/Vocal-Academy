import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import StaveDivider from "@/components/StaveDivider";

export default function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-[#F4F5F7] md:grid-cols-2">
      <div className="relative isolate hidden flex-col justify-between overflow-hidden bg-[#101B2D] p-10 text-white md:flex">
        <Image src="/images/vocal-performance.jpg" alt="" fill sizes="50vw" className="-z-20 object-cover object-[65%_center]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(180deg, rgba(16,27,45,0.9) 0%, rgba(16,27,45,0.62) 50%, rgba(16,27,45,0.92) 100%)" }} />
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
          <Image src="/logo-mark.png" alt="" width={48} height={48} className="h-12 w-12 rounded" />
          <span className="font-display text-2xl font-semibold text-[#D8BC7E]">Pneuma Music Academy</span>
        </Link>
        <div className="space-y-4">
          <p className="font-display text-4xl font-semibold leading-tight">
            Nurturing voices. Building musicians. Shaping futures.
          </p>
          <p className="max-w-sm text-[#C9D1DF]">
            Live classes, recorded lessons and personal feedback from your tutor.
          </p>
        </div>
        <StaveDivider />
      </div>

      <div className="flex flex-col">
        <div className="flex h-14 items-center bg-[#101B2D] px-4 md:hidden">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
            <Image src="/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded" />
            <span className="font-display text-lg font-semibold text-[#D8BC7E]">Pneuma Music Academy</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#101B2D]">{title}</h1>
              {subtitle && <p className="mt-1 text-[#647084]">{subtitle}</p>}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
            {footer && <div className="text-center text-sm text-[#647084]">{footer}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
