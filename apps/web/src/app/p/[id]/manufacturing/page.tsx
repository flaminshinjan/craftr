"use client";

import { buildPackage, orderTotals } from "@craftr/core";
import clsx from "clsx";
import { ArrowRight, Box, Calendar, Check, Download, FileText, IndianRupee, Pencil, Tag, Weight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import type { ViewerHandle } from "@/components/enclosure-viewer";
import { Checks, NotReady, ProjectPage } from "@/components/project-parts";
import { Card, Chip, Notice, inr } from "@/components/ui";
import { assetUrl } from "@/lib/api";
import { download, slugify } from "@/lib/project";
import { useTier } from "@/lib/tier";
import type { Project } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });

export const FLOW = ["Review", "Quote", "Fabrication", "Testing", "Shipping"];

export function FlowSteps({ at }: { at: number }) {
  return (
    <ol className="mx-auto mb-8 flex max-w-3xl items-start">
      {FLOW.map((s, i) => (
        <li key={s} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-2">
            <span className={clsx("flex size-9 items-center justify-center rounded-full text-sm font-semibold", i < at ? "bg-leaf-soft text-leaf-dark" : i === at ? "bg-leaf-dark text-white" : "bg-sand text-ink-2")}>{i < at ? <Check className="size-4" /> : i + 1}</span>
            <span className={clsx("text-[14px]", i === at ? "font-semibold" : "text-ink-3")}>{s}</span>
          </div>
          {i < FLOW.length - 1 && <span className="mt-[18px] h-px flex-1 bg-line-2" />}
        </li>
      ))}
    </ol>
  );
}

export default function Page() {
  return <ProjectPage active="manufacturing">{(p, s) => (p.nodes.length ? <Manufacturing p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

const INCLUDED = [
  ["Wiring & soldering", "Every module wired to the controller, as in your wiring diagram"],
  ["3D printed enclosure", "Printed in your selected material, colour and size"],
  ["Component sourcing", "We source all required components from trusted suppliers"],
  ["Device assembly", "Complete hardware assembly and enclosure fitting"],
  ["Firmware flashing", "Your firmware is flashed and tested on each unit"],
  ["Basic functional testing", "Power on, sensor readout and connectivity check"],
  ["Shipping across India", "Safe and reliable delivery to your location"],
];

function Manufacturing({ p }: { p: Project }) {
  const [tierId] = useTier(p.id);
  const viewer = useRef<ViewerHandle>(null);
  const { pricing, layout, checks } = p.compiled;
  const tier = pricing.tiers.find((t) => t.id === tierId) ?? pricing.tiers[0];
  const totals = orderTotals(tier.unitInr, tier.qty);
  const errors = checks.filter((c) => c.level === "error");
  const files = buildPackage(p);

  const stl = () => {
    const out = viewer.current?.exportStl();
    if (!out) return;
    download(`${slugify(p.name)}-body.stl`, out.body, "model/stl");
    setTimeout(() => download(`${slugify(p.name)}-lid.stl`, out.lid, "model/stl"), 300);
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <FlowSteps at={0} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-[30px] font-semibold">Your product</h1>
            <Link href={`/p/${p.id}/design`} className="flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-3.5 text-[14px] font-medium shadow-soft">
              <Pencil className="size-3.5" /> Edit design
            </Link>
          </div>
          <div className="relative mt-4 aspect-[7/5] overflow-hidden rounded-2xl bg-sand/70">
            {p.previewAssetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(p.previewAssetId)} alt={`Render of ${p.name}`} className="size-full object-cover" />
            ) : null}
            {/* Kept mounted (hidden behind the render when there is one) so the STL can be exported. */}
            <EnclosureViewer ref={viewer} layout={layout} color={p.design.color} face={p.design.face} finish={p.design.finish} spin className={clsx("absolute inset-0", p.previewAssetId && "pointer-events-none opacity-0")} />
          </div>
          <h2 className="mt-5 text-[26px] font-semibold">{p.name}</h2>
          <p className="mt-1 text-[16px] text-ink-3">{p.description}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Fact icon={<Tag className="size-5" />} label="Version" value={`v1.${p.version - 1}`} />
            <Fact icon={<Box className="size-5" />} label="Size" value={`${layout.outer.w} × ${layout.outer.h} × ${layout.outer.d} mm`} />
            <Fact icon={<Weight className="size-5" />} label="Weight" value={`~${layout.massG} g`} />
          </div>
          <h3 className="mt-6 border-t border-line pt-5 font-semibold">Key features</h3>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {p.features.map((f) => (
              <Chip key={f.label} icon={f.icon}>
                {f.label}
              </Chip>
            ))}
          </div>
          <h3 className="mt-6 border-t border-line pt-5 font-semibold">Manufacturing package</h3>
          <p className="mt-1 text-[13.5px] text-ink-3">The exact files our designer and print partner receive with your order.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={stl} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[13.5px] hover:bg-white">
              <Download className="size-3.5" /> enclosure.stl (body + lid)
            </button>
            {files.map((f) => (
              <button key={f.name} onClick={() => download(f.name, f.content, f.mime)} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[13.5px] hover:bg-white">
                <FileText className="size-3.5" /> {f.name.split("/").pop()}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <h2 className="text-[26px] font-semibold">Included</h2>
            <ul className="mt-3">
              {INCLUDED.map(([title, body]) => (
                <li key={title} className="flex items-center gap-4 border-b border-line py-3.5 last:border-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-dark">
                    <Check className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[16px] font-medium">{title}</span>
                    <span className="block text-[13.5px] text-ink-3">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-semibold">{tier.name} quote</h2>
              <Link href={`/p/${p.id}/bom`} className="rounded-lg bg-sand px-3 py-1.5 text-[13.5px] font-medium hover:bg-line">
                For {tier.qty} unit{tier.qty > 1 ? "s" : ""} · change
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 divide-x divide-line">
              <div className="flex gap-4 pr-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-dark">
                  <IndianRupee className="size-5" />
                </span>
                <div>
                  <div className="text-[13.5px] text-ink-3">Total cost ({tier.qty} unit{tier.qty > 1 ? "s" : ""})</div>
                  <div className="text-[30px] leading-tight font-semibold tabular-nums">{inr(totals.subtotal)}</div>
                  <div className="mt-1 text-[13px] text-ink-3">Includes parts, assembly and testing. Shipping {inr(totals.shipping)} and GST {inr(totals.tax)} are added at checkout.</div>
                </div>
              </div>
              <div className="flex gap-4 pl-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sun-soft text-[#b07d08]">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <div className="text-[13.5px] text-ink-3">Estimated delivery</div>
                  <div className="text-[30px] leading-tight font-semibold">{tier.leadTime}</div>
                  <div className="mt-1 text-[13px] text-ink-3">After order confirmation</div>
                </div>
              </div>
            </div>
          </Card>

          {errors.length > 0 && (
            <Notice>
              <p className="mb-2 font-semibold">This design can't be built yet. Fix {errors.length === 1 ? "this" : "these"} first:</p>
              <Checks checks={errors} />
            </Notice>
          )}
          <Link
            href={`/p/${p.id}/checkout`}
            aria-disabled={errors.length > 0}
            className={clsx("flex h-16 items-center justify-between rounded-2xl bg-ink px-7 text-[19px] font-semibold text-white hover:bg-black", errors.length > 0 && "pointer-events-none opacity-40")}
          >
            <span />
            Confirm & proceed
            <ArrowRight className="size-5" />
          </Link>
          <details className="rounded-2xl border border-line bg-card px-5 py-4">
            <summary className="cursor-pointer font-medium">Checks Craftr ran on this design ({checks.filter((c) => c.level === "ok").length} of {checks.length} pass)</summary>
            <div className="mt-3">
              <Checks checks={checks} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="text-ink-2">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] text-ink-3">{label}</span>
        <span className="block truncate text-[14.5px] font-medium">{value}</span>
      </span>
    </div>
  );
}
