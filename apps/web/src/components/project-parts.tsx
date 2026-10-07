"use client";

import { getBlock, type Check, type Compiled, type ProjectNode } from "@craftr/core";
import clsx from "clsx";
import { Check as CheckIcon, CircleAlert, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useProject } from "@/lib/project";
import type { Project } from "@/lib/types";
import { Shell, type NavKey } from "./shell";
import { Empty, Loading, Notice } from "./ui";
import Link from "next/link";

/** Loads the project in the URL and renders the page inside the workspace shell. */
export function ProjectPage({ active, flush, children }: { active: NavKey; flush?: boolean; children: (project: Project, state: { generating: boolean }) => React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { project, isLoading, error, notFound, generating } = useProject(id);
  return (
    <Shell active={active} projectId={id} flush={flush}>
      {isLoading ? (
        <Loading label="Opening your build" />
      ) : notFound ? (
        <div className="p-8">
          <Empty title="Project not found" body="It may have been deleted, or it belongs to another account." action={<Link href="/projects" className="font-medium underline">See your projects</Link>} />
        </div>
      ) : !project ? (
        <div className="p-8">
          <Notice>{error?.message ?? "Could not load this project."}</Notice>
        </div>
      ) : (
        children(project, { generating })
      )}
    </Shell>
  );
}

/** Shown on pages that need components, while the build is still being generated or is empty. */
export function NotReady({ project, generating }: { project: Project; generating: boolean }) {
  return (
    <Empty
      title={generating ? "Still building" : "Nothing here yet"}
      body={generating ? "Craftr is still putting this product together. This page fills in as soon as the components are chosen." : "This project has no components. Add some to see this page."}
      action={<Link href={generating ? `/p/${project.id}` : `/p/${project.id}/blocks`} className="font-medium underline">{generating ? "Watch progress" : "Build with Blocks"}</Link>}
    />
  );
}

export function Checks({ checks, only }: { checks: Check[]; only?: "problems" }) {
  const list = only ? checks.filter((c) => c.level !== "ok") : checks;
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {list.map((c) => (
        <li key={c.id} className={clsx("flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] leading-snug", c.level === "ok" && "bg-leaf-soft/60 text-ink-2", c.level === "warn" && "bg-sun-soft text-[#7a5a10]", c.level === "error" && "bg-rose-soft text-rose")}>
          {c.level === "ok" ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-leaf" /> : c.level === "warn" ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
          <span>
            <b className="font-semibold">{c.title}.</b> {c.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The wiring as a readable table: which pin on each part goes to which pin on the other. */
export function WiringList({ nodes, compiled, dense }: { nodes: ProjectNode[]; compiled: Compiled; dense?: boolean }) {
  const name = (id: string) => getBlock(nodes.find((n) => n.id === id)?.blockId ?? "")?.name ?? id;
  if (!compiled.edges.length) return <p className="text-ink-3">No connections yet.</p>;
  return (
    <ul className={clsx("flex flex-col", dense ? "gap-2" : "gap-3")}>
      {compiled.edges.map((e) => (
        <li key={e.id} className="rounded-xl border border-line bg-card px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: e.color }} />
            {name(e.from)} <span className="font-normal text-ink-3">→</span> {name(e.to)}
            <span className="ml-auto rounded-md bg-sand px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{e.label}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[12px] text-ink-2">
            {e.pins.map((p, i) => (
              <span key={i}>
                {p.a} → {p.b}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
