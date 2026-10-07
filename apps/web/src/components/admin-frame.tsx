"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMe } from "@/lib/api";
import { Shell } from "./shell";
import { Empty, Loading } from "./ui";

const TABS = [
  ["orders", "Orders", "/admin"],
  ["projects", "Projects", "/admin/projects"],
  ["partners", "Partners", "/admin/partners"],
  ["blocks", "Blocks", "/admin/blocks"],
  ["users", "Users", "/admin/users"],
] as const;

export function AdminFrame({ tab, children, wide }: { tab: (typeof TABS)[number][0]; children: React.ReactNode; wide?: boolean }) {
  const { data: me, isLoading } = useMe();
  return (
    <Shell active="admin">
      {isLoading ? (
        <Loading />
      ) : me?.role !== "admin" ? (
        <Empty title="Admins only" body="This area is for the Craftr team. If you should have access, ask an admin to add you on the Users tab." />
      ) : (
        <div className={clsx("mx-auto", wide ? "max-w-[1400px]" : "max-w-[1180px]")}>
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <h1 className="text-[30px] font-semibold">admin</h1>
            <nav className="flex gap-1 rounded-2xl border border-line bg-sand/50 p-1">
              {TABS.map(([key, label, href]) => (
                <Link key={key} href={href} aria-current={tab === key ? "page" : undefined} className={clsx("rounded-xl px-4 py-2 text-[14px]", tab === key ? "bg-card font-semibold shadow-soft" : "text-ink-2 hover:text-ink")}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {children}
        </div>
      )}
    </Shell>
  );
}

export const StatusPill = ({ status, label }: { status: string; label: string }) => (
  <span className={clsx("inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap", status === "cancelled" ? "bg-rose-soft text-rose" : status === "delivered" ? "bg-sand text-ink-2" : status === "confirmed" ? "bg-sun-soft text-[#7a5a10]" : "bg-leaf-soft text-leaf-dark")}>{label}</span>
);
