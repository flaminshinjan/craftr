"use client";

import { buildPackage, type Tier } from "@craftr/core";
import clsx from "clsx";
import { ArrowRight, Check, Download, ExternalLink, Factory, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotReady, ProjectPage } from "@/components/project-parts";
import { BlockArt, Button, Card, Thumb, inr } from "@/components/ui";
import { download } from "@/lib/project";
import { useTier } from "@/lib/tier";
import type { Project } from "@/lib/types";

export default function Page() {
  return <ProjectPage active="bom">{(p, s) => (p.nodes.length ? <Bom p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

function Bom({ p }: { p: Project }) {
  const router = useRouter();
  const [tier, setTier] = useTier(p.id);
  const { bom, pricing } = p.compiled;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/p/${p.id}`} className="flex items-center gap-3 text-lg font-semibold lowercase">
          <span aria-hidden>←</span> {p.name}
        </Link>
        <Link href={`/p/${p.id}/design`} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 font-medium shadow-soft">
          Open in Design <ExternalLink className="size-4" />
        </Link>
      </div>
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-[44px] leading-tight font-semibold">BOM & Cost</h1>
          <p className="mt-2 max-w-xl text-[17px] text-ink-3">Here's the bill of materials for your {p.name}. Review costs and get a manufacturing quote to bring your idea to life.</p>
        </div>
        <Thumb assetId={p.previewAssetId} design={p.design} className="hidden h-36 w-80 shrink-0 rounded-2xl md:flex" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-line text-left font-semibold">
              <th className="px-6 py-4" colSpan={2}>Component</th>
              <th className="px-4 py-4 text-center">Qty</th>
              <th className="px-4 py-4 text-right">Unit Price</th>
              <th className="px-6 py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((r) => (
              <tr key={r.key} className="border-b border-line">
                <td className="w-20 py-1.5 pl-6">{r.blockId ? <BlockArt blockId={r.blockId} size={44} /> : <span className="flex size-11 items-center justify-center rounded-xl bg-sand text-ink-3">{r.key === "enclosure" ? <Package className="size-5" /> : <Factory className="size-5" />}</span>}</td>
                <td className="py-3 pr-4">
                  {r.name}
                  <span className="ml-2 text-[13px] text-ink-3">{r.detail}</span>
                </td>
                <td className="px-4 text-center tabular-nums">{r.qty}</td>
                <td className="px-4 text-right tabular-nums">{inr(r.unitInr)}</td>
                <td className="px-6 text-right tabular-nums">{inr(r.totalInr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sand/50">
              <td colSpan={2} className="px-6 py-4">
                <Button size="sm" variant="ghost" onClick={() => { const f = buildPackage(p).find((x) => x.name === "bom.csv")!; download(f.name, f.content, f.mime); }}>
                  <Download className="size-3.5" /> Download CSV
                </Button>
              </td>
              <td colSpan={2} className="px-4 py-5 text-right text-[17px] font-semibold">Estimated Total</td>
              <td className="px-6 py-5 text-right text-[26px] font-semibold tabular-nums">{inr(pricing.bomInr)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <h2 className="mt-9 text-[28px] font-semibold">Manufacturing Options</h2>
      <p className="mt-1 text-ink-3">Get a quote to manufacture your {p.name}. We'll handle sourcing, assembly and testing.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-3">
        {pricing.tiers.map((t) => (
          <TierCard key={t.id} t={t} active={tier === t.id} onPick={() => setTier(t.id)} />
        ))}
      </div>
      <button onClick={() => router.push(`/p/${p.id}/manufacturing`)} className="mt-5 flex h-14 w-full items-center justify-between rounded-2xl bg-ink px-6 text-[16px] font-semibold text-white hover:bg-black">
        <span />
        <span className="flex items-center gap-3">
          <Factory className="size-5" /> Get manufacturing quote
        </span>
        <ArrowRight className="size-5" />
      </button>
    </div>
  );
}

function TierCard({ t, active, onPick }: { t: Tier; active: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} aria-pressed={active} className={clsx("flex gap-4 rounded-2xl border p-4 text-left transition", active ? "border-leaf/40 bg-leaf-soft/50" : "border-line bg-card hover:border-line-2")}>
      <span className={clsx("flex h-28 w-24 shrink-0 flex-wrap content-center items-center justify-center gap-1 rounded-xl", active ? "bg-leaf-soft" : "bg-sand")}>
        {Array.from({ length: t.qty === 1 ? 1 : t.qty === 10 ? 3 : 5 }).map((_, i) => (
          <span key={i} className={clsx("rounded-md border border-black/10 bg-[#F2EBDD]", t.qty === 1 ? "size-12" : "size-7")} />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold">{t.name}</span>
        <span className="block text-[13.5px] text-ink-3">
          {t.qty} unit{t.qty > 1 ? "s" : ""} · {t.leadTime}
        </span>
        <span className="mt-1 block font-semibold tabular-nums">
          {inr(t.unitInr)} <span className="text-[13px] font-normal text-ink-3">per unit</span>
        </span>
        {t.perks.map((perk) => (
          <span key={perk} className="mt-1 flex items-center gap-2 text-[13.5px] text-ink-2">
            <Check className="size-3.5 text-leaf" /> {perk}
          </span>
        ))}
      </span>
    </button>
  );
}
