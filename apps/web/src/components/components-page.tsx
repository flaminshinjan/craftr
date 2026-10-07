"use client";

import { BLOCKS, getBlock, nextNodeId, type BlockDef, type ProjectNode } from "@craftr/core";
import clsx from "clsx";
import { Blocks as BlocksIcon, Check, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/shell";
import { BlockArt, Notice, Spinner, inr } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";
import { useSaveProject } from "@/lib/project";
import type { Project } from "@/lib/types";

const FILTERS: [string, (b: BlockDef) => boolean][] = [
  ["All", () => true],
  ["MCU", (b) => b.category === "mcu"],
  ["Sensors", (b) => b.category === "sensor"],
  ["Connectivity", (b) => b.category === "connectivity"],
  ["Power", (b) => b.category === "power"],
  ["Display", (b) => b.category === "display"],
  ["Audio", (b) => b.category === "audio"],
  ["Other", (b) => ["input", "output", "other"].includes(b.category)],
];
const LABEL: Record<string, string> = { mcu: "MCU", sensor: "Sensors", connectivity: "Connectivity", power: "Power", display: "Display", audio: "Audio", input: "Input", output: "Output", other: "Other" };

/** Adds a block to a design. A new controller replaces the old one, since a device has exactly one. */
export function addBlock(nodes: ProjectNode[], blockId: string): ProjectNode[] {
  const b = getBlock(blockId);
  if (b?.iface === "mcu") {
    const i = nodes.findIndex((n) => getBlock(n.blockId)?.iface === "mcu");
    if (i >= 0) return nodes.map((n, j) => (j === i ? { ...n, blockId } : n));
  }
  const angle = nodes.length * 2.4;
  return [...nodes, { id: nextNodeId(nodes), blockId, x: Math.round(Math.cos(angle) * 320), y: Math.round(Math.sin(angle) * 230) }];
}

export function ComponentsCatalog({ project }: { project?: Project }) {
  const api = useApi();
  const router = useRouter();
  const save = useSaveProject(project?.id ?? "");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const list = useMemo(() => {
    const f = FILTERS.find(([n]) => n === filter)![1];
    const s = q.trim().toLowerCase();
    return BLOCKS.filter((b) => f(b) && (!s || `${b.name} ${b.subtitle} ${b.tags.join(" ")} ${b.description}`.toLowerCase().includes(s)));
  }, [q, filter]);
  const count = (id: string) => project?.nodes.filter((n) => n.blockId === id).length ?? 0;

  const change = async (b: BlockDef, remove = false) => {
    setBusy(b.id);
    setError("");
    try {
      if (!project) {
        // Outside a project, picking a block starts a new build around it.
        const { id } = await api<{ id: string }>("/projects", { body: { blank: true } });
        const nodes = addBlock([{ id: "n1", blockId: "esp32_devkit", x: 0, y: 0 }], b.id);
        await api(`/projects/${id}`, { method: "PATCH", body: { nodes } });
        return router.push(`/p/${id}/blocks`);
      }
      const last = [...project.nodes].reverse().find((n) => n.blockId === b.id);
      await save.mutateAsync({ nodes: remove ? project.nodes.filter((n) => n !== last) : addBlock(project.nodes, b.id) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHead
        title="components"
        subtitle={project ? `${project.nodes.length} block${project.nodes.length === 1 ? "" : "s"} in ${project.name}. Every block here is verified to work with the others.` : "Verified blocks that Craftr knows how to wire, fit and program."}
        right={
          project && (
            <Link href={`/p/${project.id}/blocks`} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 font-medium shadow-soft hover:bg-white">
              <BlocksIcon className="size-4" /> Build with Blocks
            </Link>
          )
        }
      />
      <label className="flex h-13 items-center gap-3 rounded-2xl border border-line bg-card px-5 focus-within:border-line-2">
        <Search className="size-5 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search components..." aria-label="Search components" className="h-12 flex-1 bg-transparent outline-none placeholder:text-ink-3" />
      </label>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {FILTERS.map(([name]) => (
          <button key={name} onClick={() => setFilter(name)} aria-pressed={filter === name} className={clsx("rounded-full border px-5 py-2 transition", filter === name ? "border-transparent bg-sand font-semibold" : "border-line bg-card text-ink-2 hover:border-line-2")}>
            {name}
          </button>
        ))}
      </div>
      {error && <Notice className="mt-4">{error}</Notice>}
      {project && project.compiled.checks.some((c) => c.level === "error") && <Notice className="mt-4">{project.compiled.checks.find((c) => c.level === "error")!.title}. {project.compiled.checks.find((c) => c.level === "error")!.detail}</Notice>}

      {!list.length ? (
        <p className="mt-12 text-center text-ink-3">No blocks match “{q}”. Craftr only offers parts it has verified.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {list.map((b) => {
            const n = count(b.id);
            return (
              <article key={b.id} className={clsx("relative flex flex-col rounded-2xl border bg-card p-5 transition", n ? "border-leaf/40" : "border-line")}>
                <div className="flex h-36 items-center justify-center">
                  <BlockArt blockId={b.id} size={124} />
                </div>
                <h2 className="mt-2 text-[17px] font-semibold">{b.name}</h2>
                <p className="text-ink-2">{b.subtitle}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[12.5px] text-ink-3">
                    {LABEL[b.category]} · {inr(b.priceInr)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {n > 0 && (
                      <>
                        <button onClick={() => change(b, true)} disabled={!!busy || (b.iface === "mcu")} aria-label={`Remove ${b.name}`} title={b.iface === "mcu" ? "A build needs a controller; add a different one to swap it" : undefined} className="flex size-9 items-center justify-center rounded-full bg-sand text-ink-2 hover:bg-line disabled:opacity-40">
                          <Minus className="size-4" />
                        </button>
                        <span className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-leaf-soft px-2 text-[13px] font-semibold text-leaf-dark">
                          <Check className="size-3.5" /> {n}
                        </span>
                      </>
                    )}
                    <button onClick={() => change(b)} disabled={!!busy} aria-label={project ? `Add ${b.name}` : `Start a build with ${b.name}`} className="flex size-10 items-center justify-center rounded-full bg-sand hover:bg-line disabled:opacity-50">
                      {busy === b.id ? <Spinner className="size-4" /> : <Plus className="size-5" />}
                    </button>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
