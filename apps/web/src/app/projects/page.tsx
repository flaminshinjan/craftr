"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHead, Shell } from "@/components/shell";
import { Empty, Loading, Notice, Thumb, fmtDate, inr } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";

export default function Projects() {
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectSummary[]>("/projects") });
  const del = useMutation({ mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }) });

  return (
    <Shell active="projects">
      <PageHead
        title="projects"
        subtitle="Everything you have built so far."
        right={
          <Link href="/" className="flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-medium text-white">
            <Plus className="size-4" /> New build
          </Link>
        }
      />
      {del.isError && <Notice className="mb-4">{del.error.message}</Notice>}
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <Notice>{q.error.message}</Notice>
      ) : !q.data!.length ? (
        <Empty title="No projects yet" body="Describe an idea on the home page and Craftr will turn it into a buildable device." action={<Link href="/" className="font-medium underline">Start building</Link>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {q.data!.map((p) => (
            <article key={p.id} className="group relative overflow-hidden rounded-2xl border border-line bg-card transition hover:shadow-soft">
              <Link href={`/p/${p.id}`}>
                <Thumb assetId={p.previewAssetId} design={p.design} className="aspect-[4/3] w-full" />
                <div className="p-4">
                  <h2 className="truncate text-[17px] font-semibold">{p.name}</h2>
                  <p className="mt-0.5 text-[13px] text-ink-3">{p.blockCount ? `${p.blockCount} blocks · ${p.outer.w} × ${p.outer.h} × ${p.outer.d} mm · ${inr(p.unitInr)}` : p.gen.error ? "Generation failed" : "In progress"}</p>
                  <p className="mt-2 text-[12px] text-ink-3">Updated {fmtDate(p.updatedAt)}</p>
                </div>
              </Link>
              <button
                aria-label={`Delete ${p.name}`}
                disabled={del.isPending}
                onClick={() => confirm(`Delete "${p.name}"? Orders already placed are kept.`) && del.mutate(p.id)}
                className="absolute top-3 right-3 rounded-lg border border-line bg-card/90 p-2 text-ink-2 opacity-0 transition group-hover:opacity-100 hover:text-rose focus-visible:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
