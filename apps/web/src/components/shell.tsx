"use client";

import { AuthLink } from "@/components/auth-link";
import { UserButton, useAuth } from "@clerk/nextjs";
import clsx from "clsx";
import { Box, ChevronDown, Coins, Cpu, Factory, Folder, Hammer, Menu, Package, Plus, ReceiptText, Settings, Shapes, ShieldCheck, X, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/api";

/** Billing shows only where it is switched on, so the web app can ship ahead of the billing api. */
const BILLING = process.env.NEXT_PUBLIC_BILLING === "1";
const LAST_KEY = "craftr:last-project";
export const rememberProject = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {}
};

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image src="/brand/sunflower-sm.png" alt="" width={size} height={size} priority />
      <span className="font-display text-[22px] font-semibold tracking-tight">Craftr</span>
    </Link>
  );
}

export function NewButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)} aria-haspopup="menu" aria-expanded={open} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 font-medium shadow-soft hover:bg-white">
        <Plus className="size-4" /> New <ChevronDown className="size-4 text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="pop absolute right-0 z-30 mt-2 w-56 rounded-xl border border-line bg-card p-1.5 shadow-lift">
          {[
            ["/", "Describe an idea"],
            ["/proven", "Start from a proven build"],
            ["/?blocks=1", "Build with blocks"],
          ].map(([href, label]) => (
            <Link key={href} href={href} role="menuitem" className="block rounded-lg px-3 py-2 hover:bg-sand">
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Avatar() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="size-10 rounded-full bg-sand" />;
  if (!isSignedIn)
    return (
      <AuthLink mode="sign-in" className="flex h-11 items-center rounded-xl bg-ink px-4 font-medium text-white">
        Sign in
      </AuthLink>
    );
  return <UserButton appearance={{ elements: { avatarBox: { width: 40, height: 40 } } }} />;
}

export type NavKey = "build" | "components" | "design" | "firmware" | "bom" | "assembly" | "manufacturing" | "orders" | "projects" | "billing" | "settings" | "admin";

/** The workspace frame: sidebar on the left, page on the right. Project links follow the open project, or the last one you opened. */
export function Shell({ active, projectId, children, flush }: { active: NavKey; projectId?: string; children: React.ReactNode; flush?: boolean }) {
  const { data: me } = useMe();
  const pathname = usePathname();
  const [last, setLast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (projectId) rememberProject(projectId);
    else {
      try {
        setLast(localStorage.getItem(LAST_KEY));
      } catch {}
    }
  }, [projectId]);
  useEffect(() => setOpen(false), [pathname]);

  const pid = projectId ?? last;
  const p = (suffix: string) => (pid ? `/p/${pid}${suffix}` : "/projects");
  const top: [NavKey, string, string, typeof Box][] = [
    ["build", "Build", pid ? `/p/${pid}` : "/", Hammer],
    ["components", "Components", pid ? `/p/${pid}/components` : "/components", Box],
    ["design", "Design", p("/design"), Shapes],
    ["firmware", "Firmware", p("/firmware"), Cpu],
    ["bom", "BOM & Cost", p("/bom"), ReceiptText],
    ["assembly", "Assembly", p("/assembly"), Wrench],
    ["manufacturing", "Manufacturing", p("/manufacturing"), Factory],
  ];
  const bottom: [NavKey, string, string, typeof Box][] = [
    ["orders", "Orders", "/orders", Package],
    ["projects", "Projects", "/projects", Folder],
    ...(BILLING ? ([["billing", "Billing", "/billing", Coins]] as [NavKey, string, string, typeof Box][]) : []),
    ["settings", "Settings", "/settings", Settings],
    ...(me?.role === "admin" ? ([["admin", "Admin", "/admin", ShieldCheck]] as [NavKey, string, string, typeof Box][]) : []),
  ];
  const item = ([key, label, href, I]: [NavKey, string, string, typeof Box]) => (
    <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={clsx("flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 transition", active === key ? "bg-sand font-semibold text-ink" : "text-ink-2 hover:bg-sand/60 hover:text-ink")}>
      <I className="size-[19px]" strokeWidth={active === key ? 2.2 : 1.8} /> {label}
    </Link>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <aside className={clsx("fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-paper px-3 py-5 transition-transform lg:static lg:translate-x-0", open ? "translate-x-0 shadow-lift" : "-translate-x-full")}>
        <div className="mb-7 flex items-center justify-between px-2.5">
          <Logo />
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-2 lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">{top.map(item)}</nav>
        <div className="mx-2.5 my-5 border-t border-line" />
        <nav className="flex flex-col gap-1">{bottom.map(item)}</nav>
        {BILLING && me && me.credits != null && (
          <Link href="/billing" className="mt-auto flex items-center justify-between rounded-xl border border-line bg-card px-3.5 py-3 text-[13.5px] hover:border-line-2">
            <span className="flex items-center gap-2 text-ink-2">
              <Coins className="size-4 text-sun" /> Credits
            </span>
            <b className="font-semibold tabular-nums">{me.role === "admin" ? "Unlimited" : me.credits.toLocaleString("en-IN")}</b>
          </Link>
        )}
      </aside>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo size={28} />
          <Avatar />
        </div>
        <main className={clsx("scroll-thin min-h-0 flex-1 overflow-y-auto", !flush && "px-5 py-6 lg:px-10 lg:py-8")}>{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, subtitle, back, right }: { title: React.ReactNode; subtitle?: React.ReactNode; back?: string; right?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <Link href={back} aria-label="Back" className="mt-1.5 rounded-lg p-1.5 text-ink-2 hover:bg-sand">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[34px] leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}
