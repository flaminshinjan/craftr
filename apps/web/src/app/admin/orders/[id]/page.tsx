"use client";

import { ORDER_STAGES, buildPackage, stageIndex, stageMeta, type OrderStatus } from "@craftr/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Download, EyeOff, FileText, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { AdminFrame, StatusPill } from "@/components/admin-frame";
import { CodeView } from "@/components/code-view";
import type { ViewMode, ViewerHandle } from "@/components/enclosure-viewer";
import { Checks, WiringList } from "@/components/project-parts";
import { BlockArt, Button, Card, Loading, Notice, Segmented, fmtDate, fmtTime, inr } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";
import { download, slugify } from "@/lib/project";
import type { AdminOrder, Partner } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });
const input = "h-10 w-full rounded-xl border border-line bg-card px-3 outline-none focus:border-tan";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const q = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api<AdminOrder>(`/admin/orders/${id}`), refetchInterval: 5000 });
  const partners = useQuery({ queryKey: ["admin", "partners"], queryFn: () => api<Partner[]>("/admin/partners") });
  return (
    <AdminFrame tab="orders" wide>
      {q.isLoading ? <Loading /> : q.isError || !q.data ? <Notice>{q.error?.message ?? "Order not found."}</Notice> : <Detail o={q.data} partners={partners.data ?? []} />}
    </AdminFrame>
  );
}

function Detail({ o, partners }: { o: AdminOrder; partners: Partner[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const s = o.snapshot;
  const viewer = useRef<ViewerHandle>(null);
  const [mode, setMode] = useState<ViewMode>("xray");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [minutes, setMinutes] = useState("");
  const [ship, setShip] = useState({ carrier: o.carrier ?? "", trackingNumber: o.trackingNumber ?? "", etaFrom: o.etaFrom.slice(0, 10), etaTo: o.etaTo.slice(0, 10) });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const act = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method?: string; body: unknown }) => api(`/admin/orders/${o.id}${path}`, { method: method ?? "POST", body }),
    onSuccess: refresh,
  });
  const patch = (body: unknown) => act.mutate({ path: "", method: "PATCH", body });
  const setStage = (status: OrderStatus) => act.mutate({ path: "/stage", body: { status, note: stageNote } }, { onSuccess: () => (setStageNote(""), refresh()) });

  const at = stageIndex(o.status);
  const next = o.status !== "cancelled" && at < ORDER_STAGES.length - 1 ? ORDER_STAGES[at + 1] : null;
  const files = buildPackage(s);
  const stl = () => {
    const out = viewer.current?.exportStl();
    if (!out) return;
    download(`${o.number}-${slugify(s.name)}-body.stl`, out.body, "model/stl");
    setTimeout(() => download(`${o.number}-${slugify(s.name)}-lid.stl`, out.lid, "model/stl"), 300);
  };
  const byType = (t: Partner["type"]) => partners.filter((p) => p.type === t && (p.active || p.id === o.designerId || p.id === o.printerId));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin" aria-label="Back to orders" className="rounded-lg p-1.5 text-ink-2 hover:bg-sand">
          <ArrowLeft className="size-5" />
        </Link>
        <h2 className="text-2xl font-semibold">
          #{o.number} · {s.name}
        </h2>
        <StatusPill status={o.status} label={o.status === "cancelled" ? "Cancelled" : stageMeta(o.status).label} />
        <span className="text-ink-3">
          {o.qty} unit{o.qty > 1 ? "s" : ""} · {inr(o.totalInr)} · placed {fmtDate(o.createdAt)}
        </span>
      </div>
      {act.isError && <Notice className="mb-4">{errorText(act.error)}</Notice>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Design package */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Design package</h3>
              <Segmented<ViewMode> value={mode} onChange={setMode} className="[&>button]:px-3 [&>button]:py-1.5" options={[{ value: "solid", label: "Enclosure" }, { value: "xray", label: "Inside" }, { value: "exploded", label: "Exploded" }]} />
            </div>
            <div className="relative mt-3 h-[380px] overflow-hidden rounded-2xl bg-sand/70">
              <EnclosureViewer ref={viewer} layout={s.compiled.layout} color={s.design.color} face={s.design.face} mode={mode} className="absolute inset-0" />
              <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">
                {s.compiled.layout.outer.w} × {s.compiled.layout.outer.h} × {s.compiled.layout.outer.d} mm · {s.design.material} · {s.design.style} · {s.compiled.layout.wall} mm walls · ~{s.compiled.layout.massG} g
              </span>
            </div>
            <p className="mt-3 text-[13px] text-ink-3">Frozen at checkout (design v1.{s.version - 1}). Later edits to the customer's project do not change this order.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="dark" onClick={stl}>
                <Download className="size-3.5" /> STL (body + lid)
              </Button>
              {files.map((f) => (
                <Button key={f.name} size="sm" onClick={() => download(`${o.number}-${f.name.split("/").pop()}`, f.content, f.mime)}>
                  <FileText className="size-3.5" /> {f.name.split("/").pop()}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-semibold">Parts to source</h3>
            <table className="mt-2 w-full text-[14px]">
              <tbody>
                {s.compiled.bom.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="w-12 py-1.5">{r.blockId && <BlockArt blockId={r.blockId} size={34} />}</td>
                    <td className="py-2">
                      {r.name} <span className="text-[12.5px] text-ink-3">{r.detail}</span>
                    </td>
                    <td className="px-3 text-right tabular-nums">× {r.qty * o.qty}</td>
                    <td className="text-right tabular-nums">{inr(r.totalInr * o.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right text-[13.5px] text-ink-2">
              Parts cost {inr(s.compiled.pricing.bomInr * o.qty)} · customer paid {inr(o.subtotalInr)} before shipping and tax
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold">Wiring</h3>
            <WiringList nodes={s.nodes} compiled={s.compiled} dense />
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold">Checks at checkout</h3>
            <Checks checks={s.compiled.checks} />
          </Card>

          {s.firmware && (
            <Card className="overflow-hidden">
              <details>
                <summary className="cursor-pointer px-5 py-4 text-lg font-semibold">
                  Firmware · {s.firmware.files[0].name} <span className="text-[13px] font-normal text-ink-3">({s.firmware.source === "ai" ? "written by Claude" : "driver baseline"})</span>
                </summary>
                <div className="h-[420px] border-t border-line">
                  <CodeView code={s.firmware.files[0].content} language={s.firmware.language === "arduino" ? "c" : "python"} />
                </div>
              </details>
            </Card>
          )}
        </div>

        {/* Operations */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h3 className="text-lg font-semibold">Stage</h3>
            <p className="mt-0.5 text-[13px] text-ink-3">The customer's tracking page updates within a few seconds of any change here.</p>
            <ol className="mt-3 flex flex-wrap gap-1.5">
              {ORDER_STAGES.map((st, i) => (
                <li key={st.id}>
                  <button disabled={act.isPending || st.id === o.status} onClick={() => confirm(`Move this order to "${st.label}"? The customer will see it.`) && setStage(st.id)} className={clsx("rounded-lg px-2.5 py-1.5 text-[12.5px]", st.id === o.status ? "bg-leaf-dark font-semibold text-white" : i < at ? "bg-leaf-soft text-leaf-dark" : "bg-sand text-ink-2 hover:bg-line")}>
                    {st.label}
                  </button>
                </li>
              ))}
            </ol>
            <textarea value={stageNote} onChange={(e) => setStageNote(e.target.value)} rows={2} placeholder="Optional message for the customer with the next stage change" className={clsx(input, "mt-3 h-auto py-2")} />
            <div className="mt-3 flex gap-2">
              {next && (
                <Button variant="dark" className="flex-1" loading={act.isPending} onClick={() => setStage(next.id)}>
                  Move to: {next.label} <ArrowRight className="size-4" />
                </Button>
              )}
              {o.status !== "cancelled" && o.status !== "delivered" && (
                <Button className="text-rose" disabled={act.isPending} onClick={() => confirm("Cancel this order? The customer will see it as cancelled.") && setStage("cancelled")}>
                  Cancel order
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-semibold">Handoff</h3>
            <p className="mt-0.5 text-[13px] text-ink-3">The customer is told a handoff happened, never who it went to.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[13px] font-medium">
                Designer
                <select value={o.designerId ?? ""} disabled={act.isPending} onChange={(e) => patch({ designerId: e.target.value || null })} className={clsx(input, "mt-1")}>
                  <option value="">Not assigned</option>
                  {byType("designer").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-medium">
                Print partner
                <select value={o.printerId ?? ""} disabled={act.isPending} onChange={(e) => patch({ printerId: e.target.value || null })} className={clsx(input, "mt-1")}>
                  <option value="">Not assigned</option>
                  {byType("printer").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            {partners.filter((p) => (p.id === o.designerId || p.id === o.printerId) && p.phone).map((p) => (
              <p key={p.id} className="mt-3 text-[13px] text-ink-2">
                {p.name}: <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-ink underline">Call {p.phone}</a>
              </p>
            ))}
            {!partners.length && (
              <p className="mt-3 text-[13px] text-ink-2">
                No partners yet. <Link href="/admin/partners" className="underline">Add a designer or print partner</Link>.
              </p>
            )}
            <form
              className="mt-4 flex items-end gap-2 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                act.mutate({ path: "", method: "PATCH", body: { addMinutes: Number(minutes) } }, { onSuccess: () => (setMinutes(""), refresh()) });
              }}
            >
              <label className="flex-1 text-[13px] font-medium">
                Log engineering time (minutes)
                <input type="number" min={1} max={600} required value={minutes} onChange={(e) => setMinutes(e.target.value)} className={clsx(input, "mt-1")} />
              </label>
              <Button type="submit" disabled={act.isPending}>Log</Button>
              <span className="pb-2.5 text-[13px] text-ink-2">{o.humanMinutes} min so far</span>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-semibold">Customer & shipping</h3>
            <p className="mt-2 text-[14px]">
              <b className="font-semibold">{o.customer.name}</b> · {o.customer.email}
              <br />
              {o.shipping.fullName}, {o.shipping.phone}
              <br />
              {o.shipping.address}, {o.shipping.city}, {o.shipping.state} {o.shipping.pin}
            </p>
            <form
              className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                patch(ship);
              }}
            >
              <label className="text-[13px] font-medium">
                Courier
                <input value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} placeholder="Delhivery" className={clsx(input, "mt-1")} />
              </label>
              <label className="text-[13px] font-medium">
                Tracking number
                <input value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} className={clsx(input, "mt-1")} />
              </label>
              <label className="text-[13px] font-medium">
                Delivery from
                <input type="date" required value={ship.etaFrom} onChange={(e) => setShip({ ...ship, etaFrom: e.target.value })} className={clsx(input, "mt-1")} />
              </label>
              <label className="text-[13px] font-medium">
                Delivery to
                <input type="date" required value={ship.etaTo} onChange={(e) => setShip({ ...ship, etaTo: e.target.value })} className={clsx(input, "mt-1")} />
              </label>
              <Button type="submit" className="sm:col-span-2" disabled={act.isPending}>Save shipping details</Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-semibold">Notes & history</h3>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                act.mutate({ path: "/notes", body: { note, internal } }, { onSuccess: () => (setNote(""), refresh()) });
              }}
            >
              <textarea required value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={internal ? "Internal note, only the team sees this" : "Update for the customer"} className={clsx(input, "h-auto py-2")} />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="size-4 accent-ink" /> Internal only
                </label>
                <Button type="submit" size="sm" variant="dark" disabled={act.isPending}>{internal ? "Add note" : "Send to customer"}</Button>
              </div>
            </form>
            <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
              {[...o.events].reverse().map((e) => (
                <li key={e.id} className={clsx("rounded-xl px-3 py-2 text-[13.5px]", e.internal ? "bg-sun-soft/70" : "bg-sand/50")}>
                  <div className="flex items-center gap-2">
                    {e.internal ? <Lock className="size-3.5 text-[#7a5a10]" /> : null}
                    <span className="font-semibold">{e.title}</span>
                    {e.internal && <span className="flex items-center gap-1 text-[11.5px] text-[#7a5a10]"><EyeOff className="size-3" /> hidden from customer</span>}
                    <span className="ml-auto shrink-0 text-[12px] text-ink-3">
                      {e.actorName} · {fmtDate(e.createdAt, false)}, {fmtTime(e.createdAt)}
                    </span>
                  </div>
                  {e.note && <p className="mt-0.5 text-ink-2">{e.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
