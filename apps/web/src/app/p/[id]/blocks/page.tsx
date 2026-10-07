"use client";

import { BLOCKS, BLOCK_GROUPS, arrange, compile, getBlock, type BlockDef, type ProjectNode } from "@craftr/core";
import clsx from "clsx";
import { ArrowLeft, Box, ChevronDown, ExternalLink, List, Minus, Pencil, Plus, Redo2, Save, ScanSearch, Search, Trash2, Undo2, Wand2, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBlock } from "@/components/components-page";
import { Checks, ProjectPage, WiringList } from "@/components/project-parts";
import { BlockArt, Button, Notice, Segmented, inr } from "@/components/ui";
import { errorText } from "@/lib/api";
import { useSaveProject } from "@/lib/project";
import type { Project } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });
const NODE = 116;

export default function Page() {
  return (
    <ProjectPage active="build" flush>
      {(p) => <Canvas key={p.id} p={p} />}
    </ProjectPage>
  );
}

function Canvas({ p }: { p: Project }) {
  const save = useSaveProject(p.id);
  const [nodes, setNodesRaw] = useState<ProjectNode[]>(p.nodes);
  const [past, setPast] = useState<ProjectNode[][]>([]);
  const [future, setFuture] = useState<ProjectNode[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(p.nodes.find((n) => getBlock(n.blockId)?.iface === "mcu")?.id ?? null);
  const [view, setView] = useState<"canvas" | "wiring" | "3d">("canvas");
  const [name, setName] = useState(p.name);
  const [renaming, setRenaming] = useState(false);
  const [search, setSearch] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [cam, setCam] = useState({ x: 0, y: 0, z: 0.8 });
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean; before: ProjectNode[] } | null>(null);

  const compiled = useMemo(() => compile({ nodes, design: p.design, spec: p.spec }), [nodes, p.design, p.spec]);
  const sel = nodes.find((n) => n.id === selected);
  const selBlock = sel ? getBlock(sel.blockId) : undefined;

  const commit = useCallback(
    (next: ProjectNode[], before = nodes) => {
      setPast((h) => [...h.slice(-40), before]);
      setFuture([]);
      setNodesRaw(next);
      setDirty(true);
    },
    [nodes],
  );
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [nodes, ...f]);
    setNodesRaw(past[past.length - 1]);
    setPast((h) => h.slice(0, -1));
    setDirty(true);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((h) => [...h, nodes]);
    setNodesRaw(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  };

  const fit = useCallback(() => {
    const el = board.current;
    if (!el || !nodes.length) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const w = Math.max(...xs) - Math.min(...xs) + NODE * 2.4;
    const h = Math.max(...ys) - Math.min(...ys) + NODE * 2.6;
    const z = Math.min(1.2, Math.max(0.35, Math.min(el.clientWidth / w, el.clientHeight / h)));
    setCam({ z, x: -((Math.max(...xs) + Math.min(...xs)) / 2) * z, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * z });
  }, [nodes]);
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSave = () =>
    save.mutate(
      { nodes, name: name.trim() || p.name },
      {
        onSuccess: (row) => {
          setDirty(false);
          setNodesRaw(row.nodes);
        },
      },
    );

  const add = (b: BlockDef) => {
    const next = addBlock(nodes, b.id);
    commit(next);
    setSelected(next.find((n) => !nodes.some((o) => o.id === n.id))?.id ?? next.find((n) => n.blockId === b.id)?.id ?? null);
  };
  const remove = (id: string) => {
    commit(nodes.filter((n) => n.id !== id));
    setSelected(null);
  };

  const down = (e: React.PointerEvent, id: string | null) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const n = nodes.find((x) => x.id === id);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: n ? n.x : cam.x, oy: n ? n.y : cam.y, moved: false, before: nodes };
    e.stopPropagation();
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    if (d.id) setNodesRaw((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: Math.round(d.ox + dx / cam.z), y: Math.round(d.oy + dy / cam.z) } : n)));
    else setCam((c) => ({ ...c, x: d.ox + dx, y: d.oy + dy }));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.id && d.moved) {
      setPast((h) => [...h.slice(-40), d.before]);
      setFuture([]);
      setDirty(true);
    } else if (d.id) setSelected(d.id);
    else if (!d.moved) setSelected(null);
  };
  const zoom = (f: number) => setCam((c) => ({ ...c, z: Math.min(1.6, Math.max(0.3, Math.round(c.z * f * 100) / 100)) }));

  const groups = BLOCK_GROUPS.map((g) => ({ g, items: BLOCKS.filter((b) => b.group === g && (!search.trim() || `${b.name} ${b.subtitle} ${b.tags.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()))) })).filter((x) => x.items.length);
  const pos = (id: string) => nodes.find((n) => n.id === id);
  const problems = compiled.checks.filter((c) => c.level !== "ok");

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <Link href={`/p/${p.id}`} aria-label="Back to build" className="rounded-lg p-1.5 text-ink-2 hover:bg-sand">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold">Build with Blocks</h1>
          {renaming ? (
            <input autoFocus value={name} maxLength={80} onChange={(e) => (setName(e.target.value), setDirty(true))} onBlur={() => setRenaming(false)} onKeyDown={(e) => e.key === "Enter" && setRenaming(false)} aria-label="Project name" className="w-64 rounded-md border border-line bg-card px-2 py-0.5 text-ink-2 outline-none" />
          ) : (
            <button onClick={() => setRenaming(true)} className="flex items-center gap-2 text-ink-2 hover:text-ink">
              {name} <Pencil className="size-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-line bg-card shadow-soft">
            <button onClick={undo} disabled={!past.length} aria-label="Undo" className="p-3 disabled:opacity-30">
              <Undo2 className="size-4" />
            </button>
            <button onClick={redo} disabled={!future.length} aria-label="Redo" className="border-l border-line p-3 disabled:opacity-30">
              <Redo2 className="size-4" />
            </button>
          </div>
          <Button onClick={() => (commit(arrange(nodes)), setTimeout(fit, 0))}>
            <Wand2 className="size-4" /> Auto-arrange
          </Button>
          <Button variant="dark" onClick={onSave} loading={save.isPending} disabled={!dirty}>
            <Save className="size-4" /> {dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </header>
      {save.isError && <Notice className="mx-5 mt-3">Could not save: {errorText(save.error)}</Notice>}

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="scroll-thin hidden w-[272px] shrink-0 overflow-y-auto border-r border-line p-3.5 md:block">
          <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-3">
            <Search className="size-4 text-ink-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blocks..." aria-label="Search blocks" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-3" />
          </label>
          {groups.map(({ g, items }) => (
            <section key={g} className="mb-3">
              <button onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))} aria-expanded={!closed[g]} className="flex w-full items-center justify-between px-1 py-2 text-[15px] font-semibold">
                {g} <ChevronDown className={clsx("size-4 text-ink-3 transition", closed[g] && "-rotate-90")} />
              </button>
              {!closed[g] && (
                <ul className="flex flex-col gap-1.5">
                  {items.map((b) => (
                    <li key={b.id}>
                      <button onClick={() => add(b)} title={b.description} className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-2 text-left transition hover:border-line-2 hover:shadow-soft">
                        <BlockArt blockId={b.id} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{b.name}</span>
                          <span className="block truncate text-[12px] text-ink-3">{b.subtitle}</span>
                        </span>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sand">
                          <Plus className="size-3.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </aside>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          <div className="absolute top-3.5 right-3.5 z-10">
            <Segmented
              value={view}
              onChange={setView}
              className="bg-card shadow-soft [&>button]:px-3.5"
              options={[
                { value: "canvas", label: <><ScanSearch className="size-4" /> Blocks</> },
                { value: "wiring", label: <><List className="size-4" /> Schematic</> },
                { value: "3d", label: <><Box className="size-4" /> 3D</> },
              ]}
            />
          </div>

          {view === "canvas" ? (
            <div ref={board} className="dot-grid absolute inset-0 touch-none overflow-hidden" style={{ cursor: drag.current && !drag.current.id ? "grabbing" : "grab" }} onPointerDown={(e) => down(e, null)} onPointerMove={move} onPointerUp={up} onWheel={(e) => zoom(e.deltaY < 0 ? 1.08 : 0.93)}>
              <div className="absolute top-1/2 left-1/2" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}>
                <svg className="pointer-events-none absolute overflow-visible" width="1" height="1">
                  {compiled.edges.map((e) => {
                    const a = pos(e.from);
                    const b = pos(e.to);
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2;
                    const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
                    return (
                      <g key={e.id} opacity={selected && e.from !== selected && e.to !== selected ? 0.3 : 1}>
                        <path d={d} stroke="#00000018" strokeWidth={e.kind === "power" ? 13 : 10} fill="none" strokeLinecap="round" />
                        <path d={d} stroke={e.color} strokeWidth={e.kind === "power" ? 9 : 6} fill="none" strokeLinecap="round" />
                      </g>
                    );
                  })}
                </svg>
                {nodes.map((n) => {
                  const b = getBlock(n.blockId);
                  if (!b) return null;
                  const big = b.iface === "mcu";
                  const s = big ? NODE * 1.5 : NODE;
                  return (
                    <div key={n.id} className="absolute" style={{ left: n.x - s / 2, top: n.y - s / 2, width: s }}>
                      <button onPointerDown={(e) => down(e, n.id)} onPointerMove={move} onPointerUp={up} aria-label={`${b.name}, ${b.subtitle}`} aria-pressed={selected === n.id} className={clsx("block cursor-grab touch-none rounded-[28%] transition-shadow active:cursor-grabbing", selected === n.id && "ring-[3px] ring-[#8aa6f5] ring-offset-4 ring-offset-paper")}>
                        <BlockArt blockId={b.id} size={s} className="pointer-events-none drop-shadow-[0_14px_14px_rgba(70,50,20,0.16)]" />
                      </button>
                      <div className="pointer-events-none absolute top-full left-1/2 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-line bg-card px-3 py-1.5 whitespace-nowrap shadow-soft">
                        <span className="size-2 rounded-full" style={{ background: b.color }} />
                        <span>
                          <span className="block text-[12.5px] leading-tight font-semibold">{b.name}</span>
                          <span className="block text-[11px] leading-tight text-ink-3">{b.role}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!nodes.length && <p className="absolute inset-0 flex items-center justify-center text-ink-3">Add a block from the left to start.</p>}
            </div>
          ) : view === "wiring" ? (
            <div className="scroll-thin absolute inset-0 overflow-y-auto p-5 pt-20">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
                <WiringList nodes={nodes} compiled={compiled} />
                <Checks checks={compiled.checks} />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-sand/60">
              <EnclosureViewer layout={compiled.layout} color={p.design.color} mode="xray" className="size-full" />
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">
                {compiled.layout.outer.w} × {compiled.layout.outer.h} × {compiled.layout.outer.d} mm
              </span>
            </div>
          )}

          {view === "canvas" && (
            <>
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-line bg-card shadow-soft">
                  <button onClick={() => zoom(0.87)} aria-label="Zoom out" className="p-3">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-12 text-center text-[13px] tabular-nums">{Math.round(cam.z * 100)}%</span>
                  <button onClick={() => zoom(1.15)} aria-label="Zoom in" className="p-3">
                    <Plus className="size-4" />
                  </button>
                </div>
                <button onClick={fit} aria-label="Fit to screen" className="rounded-xl border border-line bg-card p-3 shadow-soft">
                  <ScanSearch className="size-4" />
                </button>
              </div>
              <div className="absolute right-4 bottom-4 z-10 max-w-sm rounded-xl border border-line bg-card px-3.5 py-2.5 text-[13px] shadow-soft">
                {problems.length ? (
                  <button onClick={() => setView("wiring")} className={clsx("text-left", problems.some((c) => c.level === "error") ? "text-rose" : "text-[#7a5a10]")}>
                    <b>{problems[0].title}.</b> {problems.length > 1 ? `+${problems.length - 1} more. ` : ""}See details
                  </button>
                ) : (
                  <span className="text-leaf-dark">All checks pass · {inr(compiled.pricing.unitInr)} prototype · {compiled.power.batteryLabel}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Inspector */}
        {sel && selBlock && (
          <aside className="scroll-thin hidden w-[320px] shrink-0 overflow-y-auto border-l border-line p-4 lg:block">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">{selBlock.name}</h2>
                <p className="text-ink-2">{selBlock.role}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-2 hover:bg-sand">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-3 flex h-48 items-center justify-center rounded-2xl bg-sand/70">
              <BlockArt blockId={selBlock.id} size={150} />
            </div>
            <p className="mt-3 text-[13.5px] text-ink-2">{selBlock.description}</p>

            <label className="mt-4 block text-[13px] font-semibold">
              Model
              <select
                value={sel.blockId}
                onChange={(e) => commit(nodes.map((n) => (n.id === sel.id ? { ...n, blockId: e.target.value } : n)))}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 font-normal"
              >
                {BLOCKS.filter((b) => (selBlock.iface === "mcu" ? b.iface === "mcu" : b.category === selBlock.category && b.group === selBlock.group)).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.subtitle})
                  </option>
                ))}
              </select>
            </label>

            <dl className="mt-4 flex flex-col gap-2 text-[13px]">
              {[...selBlock.specs, ["Dimensions", `${selBlock.size.w} × ${selBlock.size.d} × ${selBlock.size.h} mm`], ["Weight", `${selBlock.massG} g`], ["Price", `${inr(selBlock.priceInr)} (est.)`]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>

            {selBlock.iface !== "mcu" && (
              <Button className="mt-4 w-full text-rose" onClick={() => remove(sel.id)}>
                <Trash2 className="size-4" /> Remove from build
              </Button>
            )}

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Pins</h3>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selBlock.name} ${selBlock.subtitle} datasheet`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-[#3567d6]">
                Find datasheet <ExternalLink className="size-3.5" />
              </a>
            </div>
            <ul className="mt-2 overflow-hidden rounded-xl border border-line text-[12.5px]">
              {selBlock.pins.map((pin) => {
                const used = compiled.edges.flatMap((e) => (e.from === sel.id ? e.pins.filter((x) => x.a === pin.name).map((x) => x.b) : e.to === sel.id ? e.pins.filter((x) => x.b === pin.name).map((x) => x.a) : []));
                return (
                  <li key={pin.name} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span className={clsx("size-2.5 shrink-0 rounded-sm", pin.kind === "power" ? "bg-[#e05c55]" : pin.kind === "gnd" ? "bg-ink" : pin.kind === "analog" ? "bg-leaf" : pin.kind === "bus" ? "bg-[#3b82c4]" : "bg-tan")} />
                    <span className="w-14 shrink-0 font-mono">{pin.name}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">{pin.desc}</span>
                    {!!used.length && <span className="shrink-0 font-mono text-leaf-dark">{[...new Set(used)].join(", ")}</span>}
                  </li>
                );
              })}
              {!selBlock.pins.length && <li className="px-3 py-2 text-ink-3">No electrical pins.</li>}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
