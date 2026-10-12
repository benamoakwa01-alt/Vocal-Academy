"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import NotificationBell from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";
import { isActive, titleFor, type NavGroup } from "./nav";

type ShellUser = { name: string; email: string; role: string };

// Remembers whether the desktop sidebar is collapsed, without causing hydration mismatches.
const KEY = "pneuma-sidebar-collapsed";
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function setCollapsedValue(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    // storage unavailable: the choice just won't be remembered
  }
  listeners.forEach((l) => l());
}

function Brand({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onNavigate} aria-label="Pneuma Music Academy, dashboard"
      className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D8BC7E] ${collapsed ? "justify-center" : "px-4"}`}>
      <Image src="/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded" />
      {!collapsed && (
        <span className="font-display text-lg font-semibold leading-tight text-[#D8BC7E]">Pneuma Music Academy</span>
      )}
    </Link>
  );
}

function SidebarNav({
  groups, path, collapsed, onNavigate,
}: {
  groups: NavGroup[];
  path: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.label}>
          {collapsed ? (
            <div className="mx-2 mb-2 border-t border-white/10" aria-hidden="true" />
          ) : (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#8D9AB0]">{g.label}</p>
          )}
          <ul className="space-y-1">
            {g.items.map((it) => {
              const active = isActive(it, path);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? it.label : undefined}
                    title={collapsed ? it.label : undefined}
                    className={`relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E] ${collapsed ? "justify-center" : "px-3"} ${active ? "bg-white/10 text-white" : "text-[#C9D1DF] hover:bg-white/5 hover:text-white"}`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#D8BC7E]" aria-hidden="true" />}
                    <Icon name={it.icon} className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials =
    user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm text-[#17253B] hover:bg-gray-100";

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-gray-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101B2D] text-sm font-semibold text-[#D8BC7E]">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-[#17253B]">{user.name}</span>
          <span className="block text-xs capitalize text-[#647084]">{user.role}</span>
        </span>
        <Icon name="chevron-down" className="h-4 w-4 text-[#647084]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-[#17253B]">{user.name}</p>
            <p className="truncate text-xs text-[#647084]">{user.email}</p>
          </div>
          <div className="my-1 border-t border-gray-100" />
          <Link role="menuitem" href="/notifications" onClick={() => setOpen(false)} className={item}>Notifications</Link>
          <button role="menuitem" type="button" onClick={signOut} disabled={signingOut} className={`${item} disabled:opacity-60`}>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ShellFrame({
  groups, user, children,
}: {
  groups: NavGroup[];
  user: ShellUser;
  children: ReactNode;
}) {
  const path = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Mobile drawer: keep focus inside, close on Escape, lock page scroll, return focus on close
  useEffect(() => {
    if (!drawerOpen) return;
    const el = drawerRef.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const btn = menuBtnRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      btn?.focus();
    };
  }, [drawerOpen]);

  // The live classroom is full screen, so it gets no shell.
  if (path.endsWith("/room")) return <>{children}</>;

  const closeDrawer = () => setDrawerOpen(false);
  const title = titleFor(path, user.role);

  return (
    <div className="flex min-h-dvh bg-[#F4F5F7] text-[#17253B]">
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#101B2D] focus:shadow-lg">
        Skip to content
      </a>

      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-[#101B2D] transition-[width] duration-200 motion-reduce:transition-none lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}>
        <Brand collapsed={collapsed} />
        <SidebarNav groups={groups} path={path} collapsed={collapsed} />
        <div className="border-t border-white/10 p-3">
          <button type="button" onClick={() => setCollapsedValue(!collapsed)} aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-10 w-full items-center gap-3 rounded-lg text-sm text-[#C9D1DF] hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E] ${collapsed ? "justify-center" : "px-3"}`}>
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} aria-hidden="true" />
          <aside id="mobile-nav" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#101B2D] shadow-xl">
            <Brand collapsed={false} onNavigate={closeDrawer} />
            <button type="button" onClick={closeDrawer} aria-label="Close navigation"
              className="absolute right-3 top-3 rounded-lg p-2 text-[#C9D1DF] hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8BC7E]">
              <Icon name="x" className="h-5 w-5" />
            </button>
            <SidebarNav groups={groups} path={path} collapsed={false} onNavigate={closeDrawer} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button ref={menuBtnRef} type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"
            aria-expanded={drawerOpen} aria-controls="mobile-nav"
            className="-ml-2 rounded-lg p-2 text-[#17253B] hover:bg-gray-100 lg:hidden">
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <p className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-[#101B2D]">{title}</p>
          <NotificationBell className="text-[#17253B] hover:text-[#101B2D]" />
          <AccountMenu user={user} />
        </header>
        <div id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none [&_main]:min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
