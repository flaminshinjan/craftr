"use client";

import { COLORS, FINISH, MATERIAL, MATERIAL_CHOICES, STYLE, compile, type DesignConfig, type EnclosureStyle, type Finish } from "@craftr/core";
import clsx from "clsx";
import { ArrowRight, Box, Circle, Download, Maximize2, RectangleVertical, Sparkles, Recycle } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ViewMode, ViewerHandle } from "@/components/enclosure-viewer";
import { Checks, NotReady, ProjectPage } from "@/components/project-parts";
import { PageHead } from "@/components/shell";
import { Button, Notice, Segmented, Thumb } from "@/components/ui";
import { errorText } from "@/lib/api";
import { download, slugify, useProjectAction, useSaveProject } from "@/lib/project";
import type { Project } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });
const COLOR_NAME = ["Cream", "Leaf green", "Tan", "Light grey", "Charcoal"];

export default function Page() {
  return <ProjectPage active="design">{(p, s) => (p.nodes.length ? <Design p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

function Design({ p }: { p: Project }) {
  const save = useSaveProject(p.id);
  const variants = useProjectAction<{ reference?: string }>(p.id, "variants");
  const [design, setDesign] = useState<DesignConfig>(p.design);
  const [mode, setMode] = useState<ViewMode>("solid");
  const viewer = useRef<ViewerHandle>(null);
  const dirty = useRef(false);

  // The same compiler the api runs, so the model follows the sliders with no round trip.
  const compiled = useMemo(() => compile({ nodes: p.nodes, design, spec: p.spec }), [p.nodes, p.spec, design]);
  const { layout } = compiled;

  // Adopt server changes (chat edits, variant picks) unless the user is mid-edit.
  useEffect(() => {
    if (!dirty.current) setDesign(p.design);
  }, [p.design]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      save.mutate({ design });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  const set = (patch: Partial<DesignConfig>) => {
    dirty.current = true;
    setDesign((d) => ({ ...d, ...patch }));
  };
  const round = layout.shape === "round";
  const dims = (round ? (["width", "depth"] as const) : (["width", "height", "depth"] as const)).map((k) => {
    const axis = ({ width: "w", height: "h", depth: "d" } as const)[k];
    const min = layout.minOuter[axis];
    return { k, min, max: Math.max(min + 60, 120), value: design.auto ? layout.outer[axis] : design[k] };
  });

  const exportStl = () => {
    const stl = viewer.current?.exportStl();
    if (!stl) return;
    download(`${slugify(p.name)}-body.stl`, stl.body, "model/stl");
    setTimeout(() => download(`${slugify(p.name)}-lid.stl`, stl.lid, "model/stl"), 300);
  };

  const strip = [...(p.previewAssetId ? [{ assetId: p.previewAssetId, style: p.design.style, color: p.design.color, current: true }] : []), ...p.variants.map((v) => ({ ...v, current: false }))];

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHead
        title={p.name}
        subtitle="Design and customize your enclosure"
        back={`/p/${p.id}`}
        right={
          <>
            <Button onClick={exportStl}>
              <Download className="size-4" /> STL
            </Button>
            <Button variant="dark" loading={variants.isPending} onClick={() => variants.mutate({ reference: viewer.current?.snapshot() ?? undefined })} disabled={p.ai?.images === false} title={p.ai?.images === false ? "Needs an OpenAI key on the api" : "Photographs this device in three other colours"}>
              <Sparkles className="size-4 text-sun" /> Generate variants
            </Button>
          </>
        }
      />
      {variants.isError && <Notice className="mb-4">{errorText(variants.error)}</Notice>}
      {save.isError && <Notice className="mb-4">Could not save: {errorText(save.error)}</Notice>}

      <Segmented<ViewMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: "solid", label: "Enclosure" },
          { value: "xray", label: "3D Model" },
          { value: "exploded", label: "Exploded View" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-7">
          <Group label="Shape">
            <div className="grid grid-cols-3 gap-3">
              {([["box", "Box", "A rounded box"], ["round", "Round", "A round puck"], ["card", "Card", "A flat slab for the back of a phone"]] as const).map(([sh, label, hint]) => {
                const on = (design.shape ?? "box") === sh;
                const I = sh === "box" ? Box : sh === "round" ? Circle : RectangleVertical;
                return (
                  <Option key={sh} active={on} onClick={() => set({ shape: sh, auto: true })} title={hint}>
                    <I className={clsx("size-8", on ? "text-[#4d79d8]" : "text-ink-3")} strokeWidth={1.4} />
                    {label}
                  </Option>
                );
              })}
            </div>
            {(design.shape ?? "box") === "box" && (
              <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-ink-2">
                Lean back on a stand
                <input type="checkbox" checked={!!design.stand} onChange={(e) => set({ stand: e.target.checked })} className="size-5 accent-[#1b1b1a]" />
              </label>
            )}
            {design.shape === "card" && (
              <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-ink-2">
                Card pocket
                <select value={design.pocketCards ?? 0} onChange={(e) => set({ pocketCards: Number(e.target.value) })} className="h-10 rounded-xl border border-line bg-card px-3">
                  <option value={0}>None</option>
                  <option value={1}>1 card</option>
                  <option value={2}>2 cards</option>
                  <option value={3}>3 cards</option>
                </select>
              </label>
            )}
          </Group>
          <Group label="Style">
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(STYLE) as EnclosureStyle[]).map((s) => (
                <Option key={s} active={design.style === s} onClick={() => set({ style: s })} title={STYLE[s].blurb}>
                  <Box className={clsx("size-9", design.style === s ? "text-[#4d79d8]" : "text-ink-3")} strokeWidth={1.4} />
                  {STYLE[s].label}
                </Option>
              ))}
            </div>
          </Group>
          <Group label="Material">
            <div className="grid grid-cols-4 gap-3">
              {[...MATERIAL_CHOICES, ...(MATERIAL_CHOICES.includes(design.material) ? [] : [design.material])].map((m) => (
                <Option key={m} active={design.material === m} onClick={() => set({ material: m })} title={MATERIAL[m].blurb}>
                  {MATERIAL[m].recycled ? <Recycle className={clsx("size-7", design.material === m ? "text-leaf-dark" : "text-ink-3/60")} strokeWidth={1.5} /> : <Box className={clsx("size-7", design.material === m ? "text-ink" : "text-ink-3/60")} strokeWidth={1.5} />}
                  {m}
                </Option>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-3">
              <b className="font-medium text-ink-2">{MATERIAL[design.material].name}.</b> {MATERIAL[design.material].blurb}
            </p>
          </Group>
          <Group label="Finish">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(FINISH) as Finish[]).map((f) => (
                <Option key={f} active={(design.finish ?? "chalk") === f} onClick={() => set({ finish: f })} title={FINISH[f].blurb}>
                  {FINISH[f].label}
                </Option>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-3">{FINISH[design.finish ?? "chalk"].blurb}</p>
          </Group>
          <Group label="Color">
            <div className="flex gap-4">
              {COLORS.map((c, i) => (
                <button key={c} onClick={() => set({ color: c })} aria-label={COLOR_NAME[i]} aria-pressed={design.color === c} title={COLOR_NAME[i]} className={clsx("size-12 rounded-full border-2 p-1 transition", design.color === c ? "border-tan" : "border-transparent")}>
                  <span className="block size-full rounded-full border border-black/10" style={{ background: c }} />
                </button>
              ))}
            </div>
          </Group>
          <Group label="Front panel">
            <div className="flex gap-4">
              {[undefined, "#1B1B1A", "#F7F4EE", ...COLORS.filter((c) => c !== design.color)].map((c) => (
                <button key={c ?? "match"} onClick={() => set({ face: c ?? "" })} aria-label={c ? `Front panel ${c}` : "Same as the body"} aria-pressed={(design.face || undefined) === c} title={c ? undefined : "Same as the body"} className={clsx("size-12 rounded-full border-2 p-1 transition", (design.face || undefined) === c ? "border-tan" : "border-transparent")}>
                  <span className="block size-full rounded-full border border-black/10" style={{ background: c ?? design.color }} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-3">The front panel prints as its own part, so it can be a second colour.</p>
          </Group>
          <Group
            label="Dimensions"
            right={
              <button onClick={() => set({ auto: true })} disabled={design.auto} className="flex items-center gap-1.5 text-[13px] text-ink-2 underline-offset-4 hover:underline disabled:text-ink-3 disabled:no-underline">
                <Maximize2 className="size-3.5" /> {design.auto ? "Fitted to the parts" : "Fit to the parts"}
              </button>
            }
          >
            <div className={clsx("flex flex-col gap-4", layout.card && "hidden")}>
              {dims.map((d) => (
                <label key={d.k} className="grid grid-cols-[64px_1fr_64px] items-center gap-3">
                  <span className="text-ink-2 capitalize">{round && d.k === "width" ? "Diameter" : d.k}</span>
                  <input
                    type="range"
                    min={d.min}
                    max={d.max}
                    value={Math.min(d.max, Math.max(d.min, d.value))}
                    style={{ "--fill": `${((Math.min(d.max, Math.max(d.min, d.value)) - d.min) / (d.max - d.min)) * 100}%` } as React.CSSProperties}
                    onChange={(e) => set({ auto: false, width: layout.outer.w, height: layout.outer.h, depth: layout.outer.d, [d.k]: Number(e.target.value) })}
                  />
                  <span className="text-right tabular-nums">{d.value} mm</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-ink-3">
              {layout.card ? `A card is ${layout.outer.w} × ${layout.outer.h} mm, and ${layout.outer.d} mm thick with these parts.` : "Sliders stop at the smallest size the parts fit in."} {layout.wall} mm walls · about {layout.massG} g assembled.
            </p>
          </Group>
          <Checks checks={compiled.checks.filter((c) => ["fit", "wall", "ports"].includes(c.id))} />
          <Link href={`/p/${p.id}/firmware`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 font-medium text-white">
            Continue to firmware <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-sand/70 lg:min-h-[640px]">
          <EnclosureViewer ref={viewer} layout={layout} color={design.color} face={design.face} finish={design.finish} mode={mode} className="absolute inset-0" />
          <span className="absolute bottom-4 left-4 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">
            {round ? `⌀${layout.outer.w} × ${layout.outer.d}` : `${layout.outer.w} × ${layout.outer.h} × ${layout.outer.d}`} mm · drag to rotate, scroll to zoom
          </span>
        </div>

        {!!strip.length && (
          <div className="scroll-thin flex gap-3 overflow-auto lg:max-h-[640px] lg:w-[132px] lg:flex-col">
            {strip.map((v) => (
              <button
                key={v.assetId}
                disabled={v.current || save.isPending}
                onClick={() => {
                  dirty.current = false;
                  setDesign((d) => ({ ...d, style: v.style, color: v.color }));
                  save.mutate({ design: { style: v.style, color: v.color }, previewAssetId: v.assetId });
                }}
                title={v.current ? "Current look" : `Use this look: ${STYLE[v.style].label}`}
                className={clsx("shrink-0 overflow-hidden rounded-2xl border-2 transition", v.current ? "border-tan" : "border-transparent hover:border-line-2")}
              >
                <Thumb assetId={v.assetId} className="size-[124px]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{label}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Option({ active, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button {...rest} aria-pressed={active} className={clsx("flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-[14px] transition", active ? "border-tan font-semibold shadow-soft" : "border-line text-ink-2 hover:border-line-2")}>
      {children}
    </button>
  );
}
