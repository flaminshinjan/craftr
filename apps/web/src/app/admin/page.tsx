"use client";

import { ORDER_STAGES, stageMeta } from "@craftr/core";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { AdminFrame, StatusPill } from "@/components/admin-frame";
import { Card, Empty, Loading, Notice, Thumb, fmtDate, inr } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { OrderSummary } from "@/lib/types";

interface Overview {
  orders: { total: number; open: number; delivered: number; revenue: number; minutes: number; untouched: number };
  byStatus: Record<string, number>;
  projects: number;
  users: number;
}

export default function AdminHome() {
  return (
    <AdminFrame tab="orders">
      <Orders />
    </AdminFrame>
  );
}

function Orders() {
  const api = useApi();
  const [filter, setFilter] = useState("open");
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<Overview>("/admin/overview"), refetchInterval: 6000 });
  const q = useQuery({ queryKey: ["admin", "orders"], queryFn: () => api<OrderSummary[]>("/admin/orders"), refetchInterval: 5000 });
  const o = overview.data?.orders;
  const rows = (q.data ?? []).filter((r) => (filter === "open" ? !["delivered", "cancelled"].includes(r.status) : filter === "all" ? true : r.status === filter));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Open orders" value={o?.open ?? "–"} />
        <Stat label="Delivered" value={o?.delivered ?? "–"} />
        <Stat label="Order value" value={o ? inr(o.revenue) : "–"} hint="Test payments included" />
        <Stat label="Human minutes / order" value={o ? (o.total ? Math.round(o.minutes / o.total) : 0) : "–"} hint="Engineering time logged. Lower is better." />
        <Stat label="Designs · users" value={overview.data ? `${overview.data.projects} · ${overview.data.users}` : "–"} />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        {[["open", "Open"], ...ORDER_STAGES.map((s) => [s.id, s.label]), ["cancelled", "Cancelled"], ["all", "All"]].map(([id, label]) => {
          const n = id === "open" ? o?.open : id === "all" ? o?.total : overview.data?.byStatus[id];
          return (
            <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id} className={clsx("rounded-full border px-3.5 py-1.5 text-[13.5px]", filter === id ? "border-transparent bg-ink text-white" : "border-line bg-card text-ink-2 hover:border-line-2")}>
              {label}
              {!!n && <span className="ml-1.5 opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Notice>{q.error.message}</Notice>
      ) : !rows.length ? (
        <Empty title="Nothing in this view" body="Orders appear here the moment a customer checks out." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Handoff</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/40">
                  <td className="px-5 py-3">
                    <Link href={`/admin/orders/${r.id}`} className="flex items-center gap-3">
                      <Thumb assetId={r.previewAssetId} className="size-11 shrink-0 rounded-lg" />
                      <span>
                        <span className="block font-semibold">{r.name}</span>
                        <span className="block text-[12.5px] text-ink-3">
                          #{r.number} · {fmtDate(r.createdAt, false)} · qty {r.qty}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3">
                    {r.customer?.name}
                    <span className="block text-[12.5px] text-ink-3">{r.customer?.email}</span>
                  </td>
                  <td className="px-3">
                    <StatusPill status={r.status} label={r.status === "cancelled" ? "Cancelled" : stageMeta(r.status).label} />
                  </td>
                  <td className="px-3 text-[13px] text-ink-2">
                    {r.designerId ? "Designer ✓" : "No designer"} · {r.printerId ? "Printer ✓" : "No printer"}
                  </td>
                  <td className="px-3 whitespace-nowrap text-ink-2">{fmtDate(r.etaTo, false)}</td>
                  <td className="px-5 text-right font-medium tabular-nums">{inr(r.totalInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="px-5 py-4" title={hint}>
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="mt-1 text-[26px] leading-tight font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-3">{hint}</div>}
    </Card>
  );
}
