"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError, useApi } from "./api";
import type { Project } from "./types";

const generating = (p?: Project) => !!p && p.gen.step >= 1 && p.gen.step <= 5 && !p.gen.error;
export function useProject(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["project", id],
    queryFn: () => api<Project>(`/projects/${id}`),
    refetchInterval: (query) => (generating(query.state.data) ? 1500 : false),
  });

  // Kick off (or resume) generation. The api ignores the call when a run is already in flight.
  const kicked = useRef<string | null>(null);
  const p = q.data;
  const stalled = !!p?.gen.startedAt && Date.now() - new Date(p.gen.startedAt).getTime() > 150_000;
  useEffect(() => {
    if (!p || !generating(p)) return;
    if (p.gen.startedAt && !stalled) return;
    const key = `${p.id}:${p.gen.startedAt ?? "new"}`;
    if (kicked.current === key) return;
    kicked.current = key;
    api(`/projects/${p.id}/generate`, { method: "POST" })
      .catch(() => {})
      .finally(() => (qc.invalidateQueries({ queryKey: ["project", id] }), qc.invalidateQueries({ queryKey: ["me"] })));
  }, [p, stalled, api, qc, id]);

  return { ...q, project: q.data, generating: generating(q.data), notFound: q.error instanceof ApiError && q.error.status === 404 };
}

/** Saves part of a project and replaces the cached copy with what the api compiled. */
export function useSaveProject(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; nodes?: Project["nodes"]; design?: Partial<Project["design"]>; previewAssetId?: string }) => api<Project>(`/projects/${id}`, { method: "PATCH", body }),
    onSuccess: (row) => qc.setQueryData<Project>(["project", id], (old) => (old ? { ...old, ...row } : row)),
  });
}

/** Runs one of the project's AI actions (chat, firmware, preview, variants) and stores the result. */
export function useProjectAction<B extends object | void = void>(id: string, path: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: B) => api<Project>(`/projects/${id}/${path}`, { method: "POST", body: body ?? {} }),
    // These actions spend credits, so the balance in the sidebar is refreshed either way.
    onSettled: () => qc.invalidateQueries({ queryKey: ["me"] }),
    onSuccess: (row) => qc.setQueryData<Project>(["project", id], (old) => (old ? { ...old, ...row } : row)),
  });
}

export function download(name: string, content: BlobPart, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.split("/").pop()!;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "craftr";
