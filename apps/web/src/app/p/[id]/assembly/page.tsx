"use client";

import { assemblyGuide } from "@craftr/core";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ViewMode } from "@/components/enclosure-viewer";
import { NotReady, ProjectPage } from "@/components/project-parts";
import { Card, Segmented } from "@/components/ui";
import type { Project } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });

const KIND: Record<string, string> = { i2c: "I²C", analog: "Analog", digital: "Digital", i2s: "Audio", uart: "Serial", spi: "SPI", power: "Power" };

export default function Page() {
  return <ProjectPage active="assembly">{(p, s) => (p.nodes.length ? <Assembly p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

function Assembly({ p }: { p: Project }) {
  const [mode, setMode] = useState<ViewMode>("exploded");
  const guide = assemblyGuide(p);
  return (
    <div className="mx-auto max-w-[1180px]">
      <h1 className="text-[30px] font-semibold">Assembly</h1>
      <p className="mt-1 text-ink-2">Every wire, and the order the parts go into the printed shell.</p>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-sand/50">
              <EnclosureViewer layout={p.compiled.layout} color={p.design.color} face={p.design.face} wires={p.compiled.edges} mode={mode} className="absolute inset-0" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
              <Segmented<ViewMode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "exploded", label: "Exploded" },
                  { value: "xray", label: "Wired" },
                  { value: "solid", label: "Closed" },
                ]}
              />
              <span className="text-[13px] text-ink-3">Drag to turn it</span>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold">You will need</h2>
            <ul className="mt-2 list-disc pl-5 text-[14px] leading-relaxed text-ink-2">
              {guide.tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Connections</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">{guide.wires.length} wires. Colours match the 3D view and the wiring diagram.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-[13.5px]">
                <thead className="text-[12.5px] text-ink-3">
                  <tr>
                    <th className="pb-2 font-medium">From</th>
                    <th className="pb-2 font-medium">Pin</th>
                    <th className="pb-2 font-medium">To</th>
                    <th className="pb-2 font-medium">Pin</th>
                    <th className="pb-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.wires.map((w, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: w.color }} />
                        {w.from}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[12.5px]">{w.fromPin}</td>
                      <td className="py-2 pr-3">{w.to}</td>
                      <td className="py-2 pr-3 font-mono text-[12.5px]">{w.toPin}</td>
                      <td className="py-2 text-ink-3">{KIND[w.kind] ?? w.kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Steps</h2>
            <ol className="mt-3 flex flex-col gap-5">
              {guide.steps.map((s, i) => (
                <li key={s.title} className="flex gap-3.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sand text-[13px] font-semibold">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
                    {!!s.items.length && (
                      <ul className="mt-2 flex flex-col gap-1 text-[13.5px]">
                        {s.items.map((it, k) => (
                          <li key={k} className="rounded-lg bg-sand/60 px-3 py-1.5">{it}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
