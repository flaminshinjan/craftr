"use client";

import { stageMeta } from "@craftr/core";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHead, Shell } from "@/components/shell";
import { Empty, Loading, Notice, Thumb, fmtDate, inr } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { OrderSummary } from "@/lib/types";

export default function Orders() {
  const api = useApi();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api<OrderSummary[]>("/orders"), refetchInterval: 8000 });
  return (
    <Shell active="orders">
      <PageHead title="orders" subtitle="Everything you have ordered, with live status." />
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Notice>{q.error.message}</Notice>
      ) : !q.data!.length ? (
        <Empty title="No orders yet" body="When you order a prototype, you can follow it here from confirmation to your door." action={<Link href="/projects" className="font-medium underline">Open a project</Link>} />
      ) : (
        <ul className="flex max-w-4xl flex-col gap-4">
          {q.data!.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center gap-5 rounded-2xl border border-line bg-card p-4 transition hover:shadow-soft">
                <Thumb assetId={o.previewAssetId} className="size-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold">{o.name}</div>
                  <div className="text-[13.5px] text-ink-3">
                    #{o.number} · placed {fmtDate(o.createdAt)} · qty {o.qty}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-medium ${o.status === "cancelled" ? "bg-rose-soft text-rose" : o.status === "delivered" ? "bg-sand text-ink-2" : "bg-leaf-soft text-leaf-dark"}`}>{o.status === "cancelled" ? "Cancelled" : stageMeta(o.status).label}</span>
                  <div className="mt-1 font-semibold tabular-nums">{inr(o.totalInr)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
