"use client";

import { ORDER_STAGES, stageIndex, stageMeta } from "@craftr/core";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Bookmark, Calendar, Check, MapPin, MessageSquareText, Settings, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell } from "@/components/shell";
import { Card, Loading, Notice, Thumb, fmtDate, fmtTime, inr } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { Order } from "@/lib/types";

// "Delivered" is the end state, not a step the customer waits on.
const STEPS = ORDER_STAGES.filter((s) => s.id !== "delivered");

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  // Polled so that changes made by the Craftr team show up without a refresh.
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`), refetchInterval: 4000 });
  return (
    <Shell active="orders">
      {q.isLoading ? <Loading label="Loading your order" /> : q.isError || !q.data ? <Notice>{q.error?.message ?? "Order not found."}</Notice> : <Tracking o={q.data} />}
    </Shell>
  );
}

function Tracking({ o }: { o: Order }) {
  const cancelled = o.status === "cancelled";
  const at = cancelled ? -1 : stageIndex(o.status);
  const delivered = o.status === "delivered";
  const meta = stageMeta(o.status);
  const entered = (stage: string) => [...o.events].reverse().find((e) => e.type === "stage" && e.stage === stage);
  const updates = o.events.filter((e) => e.type !== "stage");
  const s = o.snapshot;

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[44px] leading-tight font-semibold">your order</h1>
          <p className="mt-1 text-[17px] text-ink-3">Here's the latest updates on your {s.name}.</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-5 py-3">
          <div className="font-semibold">Order #{o.number}</div>
          <div className="text-[13.5px] text-ink-3">Placed on {fmtDate(o.createdAt)}</div>
        </div>
      </header>

      <Card className="flex flex-col items-center gap-8 p-8 md:flex-row">
        <Thumb assetId={s.previewAssetId} design={s.design} className="size-64 shrink-0 rounded-3xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] text-ink-3">{s.name}</div>
          <div className="mt-2 flex items-center gap-4">
            <span className={clsx("flex size-13 items-center justify-center rounded-2xl", cancelled ? "bg-rose-soft text-rose" : "bg-leaf-soft text-leaf-dark")}>{cancelled ? <XCircle className="size-7" /> : delivered ? <Check className="size-7" /> : <Settings className="size-7" />}</span>
            <h2 className={clsx("text-[38px] leading-tight font-semibold", cancelled ? "text-rose" : "text-leaf-dark")}>{cancelled ? "Cancelled" : meta.headline}</h2>
          </div>
          <p className="mt-3 max-w-md text-[16px] text-ink-2">{cancelled ? "This order was cancelled. If that's a surprise, get in touch and we'll sort it out." : (entered(o.status)?.note || meta.active)}</p>
          {!cancelled && (
            <ol className="mt-7 flex" aria-label="Order progress">
              {STEPS.map((st, i) => {
                const done = i < at || delivered;
                const now = i === at && !delivered;
                return (
                  <li key={st.id} className="relative flex flex-1 flex-col items-center gap-2 text-center">
                    {i > 0 && <span className={clsx("absolute top-[13px] right-1/2 h-1 w-full -translate-x-3.5 rounded-full", done || now ? "bg-leaf" : "bg-line")} style={{ width: "calc(100% - 28px)" }} />}
                    <span className={clsx("relative z-10 flex size-7 items-center justify-center rounded-full", done ? "bg-leaf text-white" : now ? "bg-leaf-dark text-white ring-4 ring-leaf-soft" : "bg-line-2")} aria-current={now ? "step" : undefined}>
                      {done ? <Check className="size-4" /> : now ? <Settings className="size-4" /> : null}
                    </span>
                    <span className={clsx("px-1 text-[12.5px] leading-tight", now ? "font-semibold" : "text-ink-2")}>{st.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Card>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Order details</h2>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line p-3">
            <Thumb assetId={s.previewAssetId} design={s.design} className="size-20 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold">{s.name}</div>
              <p className="line-clamp-2 text-[13.5px] text-ink-3">{s.description}</p>
            </div>
            <div className="text-right text-[14px]">
              <div className="text-ink-3">Qty {o.qty}</div>
              <div className="font-semibold tabular-nums">{inr(o.unitInr)}</div>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[28px_140px_1fr] gap-y-4 text-[15px]">
            <Bookmark className="size-5 text-ink-2" />
            <dt className="text-ink-2">Order number</dt>
            <dd>#{o.number}</dd>
            <Calendar className="size-5 text-ink-2" />
            <dt className="text-ink-2">Order date</dt>
            <dd>{fmtDate(o.createdAt)}</dd>
            <MapPin className="size-5 text-ink-2" />
            <dt className="text-ink-2">Shipping to</dt>
            <dd>
              {o.shipping.fullName}
              <br />
              {o.shipping.address}
              <br />
              {o.shipping.city}, {o.shipping.state} {o.shipping.pin}
            </dd>
            {o.trackingNumber && (
              <>
                <Truck className="size-5 text-ink-2" />
                <dt className="text-ink-2">Tracking</dt>
                <dd>
                  {o.carrier ? `${o.carrier}: ` : ""}
                  <span className="font-mono">{o.trackingNumber}</span>
                </dd>
              </>
            )}
          </dl>
          <dl className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-[14px]">
            {[["Product", o.subtotalInr], ["Shipping", o.shippingInr], ["GST", o.taxInr]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-ink-2">
                <dt>{k}</dt>
                <dd className="tabular-nums">{inr(v as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between text-[16px] font-semibold">
              <dt>Total {o.paymentStatus === "simulated" && <span className="ml-1 rounded-md bg-sun-soft px-1.5 py-0.5 text-[11px] font-medium text-[#7a5a10]">test payment</span>}</dt>
              <dd className="tabular-nums">{inr(o.totalInr)}</dd>
            </div>
          </dl>
          {o.projectId && (
            <Link href={`/p/${o.projectId}`} className="mt-4 inline-block text-[14px] text-ink-2 underline underline-offset-4">
              Open the project
            </Link>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Tracking progress</h2>
          <ol className="mt-4">
            {ORDER_STAGES.filter((st) => st.id !== "delivered" || delivered).map((st, i, all) => {
              const done = i < at || (delivered && st.id !== "delivered") || (st.id === "delivered" && delivered);
              const now = i === at && !delivered && !cancelled;
              const ev = entered(st.id);
              return (
                <li key={st.id} className={clsx("relative flex gap-4 rounded-xl px-3 py-3", now && "bg-leaf-soft/70")}>
                  {i < all.length - 1 && <span className={clsx("absolute top-10 left-[25px] h-[calc(100%-28px)] w-0.5", done ? "bg-leaf" : "bg-line")} />}
                  <span className={clsx("relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", done ? "bg-leaf text-white" : now ? "bg-leaf-dark text-white" : "bg-line-2")}>{done ? <Check className="size-4" /> : now ? <Settings className="size-4" /> : null}</span>
                  <div className="min-w-0 flex-1">
                    <div className={clsx("font-semibold", !done && !now && "text-ink-2")}>{st.label}</div>
                    <div className="text-[13px] text-ink-3">{done ? st.done : now ? (ev?.note || st.active) : st.active}</div>
                  </div>
                  <div className="shrink-0 text-right text-[13px] text-ink-2">
                    {now ? <span className="font-semibold text-leaf-dark">In progress</span> : done && ev ? (<>{fmtDate(ev.createdAt)}<br />{fmtTime(ev.createdAt)}</>) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {updates.length > 0 && (
            <>
              <h3 className="mt-5 border-t border-line pt-4 font-semibold">Updates from Craftr</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {[...updates].reverse().map((e) => (
                  <li key={e.id} className="flex gap-3 text-[14px]">
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    <div>
                      <span className="font-medium">{e.title}</span> <span className="text-[12.5px] text-ink-3">· {fmtDate(e.createdAt, false)}, {fmtTime(e.createdAt)}</span>
                      {e.note && <p className="text-ink-2">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {!cancelled && (
        <div className="mt-5 flex items-center gap-6 rounded-2xl border border-leaf/20 bg-leaf-soft/60 px-7 py-5">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-dark">
            <Truck className="size-7" />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-leaf-dark">{delivered ? "Delivered" : "Estimated delivery"}</div>
            <div className="text-[26px] leading-tight font-semibold text-leaf-dark">
              {fmtDate(o.etaFrom, false)} – {fmtDate(o.etaTo)}
            </div>
            <div className="text-[14px] text-ink-2">{o.trackingNumber ? `Shipped with ${o.carrier ?? "courier"}, tracking ${o.trackingNumber}.` : "We'll share tracking details once your order ships."}</div>
          </div>
        </div>
      )}
    </div>
  );
}
