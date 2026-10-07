"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AdminFrame } from "@/components/admin-frame";
import { Card, Empty, Loading, Notice, Thumb, fmtDate, inr } from "@/components/ui";
import { useApi } from "@/lib/api";

interface Row {
  id: string;
  name: string;
  origin: string;
  previewAssetId: string | null;
  updatedAt: string;
  owner: string;
  email: string;
  unitInr: number;
  errors: number;
  blockCount: number;
}

export default function Page() {
  return (
    <AdminFrame tab="projects">
      <Projects />
    </AdminFrame>
  );
}

function Projects() {
  const api = useApi();
  const q = useQuery({ queryKey: ["admin", "projects"], queryFn: () => api<Row[]>("/admin/projects"), refetchInterval: 10000 });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Notice>{q.error.message}</Notice>;
  if (!q.data!.length) return <Empty title="No designs yet" body="Every design a user creates shows up here." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
            <th className="px-5 py-3 font-medium">Design</th>
            <th className="px-3 py-3 font-medium">Owner</th>
            <th className="px-3 py-3 font-medium">Started from</th>
            <th className="px-3 py-3 font-medium">Checks</th>
            <th className="px-3 py-3 font-medium">Updated</th>
            <th className="px-5 py-3 text-right font-medium">Prototype</th>
          </tr>
        </thead>
        <tbody>
          {q.data!.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/40">
              <td className="px-5 py-2.5">
                <Link href={`/p/${r.id}`} className="flex items-center gap-3">
                  <Thumb assetId={r.previewAssetId} className="size-10 shrink-0 rounded-lg" />
                  <span>
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-[12.5px] text-ink-3">{r.blockCount} blocks</span>
                  </span>
                </Link>
              </td>
              <td className="px-3">
                {r.owner}
                <span className="block text-[12.5px] text-ink-3">{r.email}</span>
              </td>
              <td className="px-3 text-ink-2 capitalize">{r.origin}</td>
              <td className="px-3">{r.errors ? <span className="text-rose">{r.errors} error{r.errors > 1 ? "s" : ""}</span> : r.blockCount ? <span className="text-leaf-dark">Pass</span> : <span className="text-ink-3">–</span>}</td>
              <td className="px-3 text-ink-2">{fmtDate(r.updatedAt, false)}</td>
              <td className="px-5 text-right tabular-nums">{r.blockCount ? inr(r.unitInr) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
