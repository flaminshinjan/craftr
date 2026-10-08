"use client";

import { getBlock, resolveNodes } from "@craftr/core";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, ArrowUp, Box, Check, Code2, Coins, Cpu, Factory, ReceiptText, RefreshCw, SlidersHorizontal, Truck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Checks, ProjectPage, WiringList } from "@/components/project-parts";
import { Avatar, NewButton } from "@/components/shell";
import { Button, Card, Chip, Notice, Segmented, Spinner, Thumb, inr } from "@/components/ui";
import { assetUrl, errorText, useApi } from "@/lib/api";
import { useProjectAction } from "@/lib/project";
import type { ViewerHandle } from "@/components/enclosure-viewer";
import type { Project } from "@/lib/types";

const EnclosureViewer = dynamic(() => import("@/components/enclosure-viewer").then((m) => m.EnclosureViewer), { ssr: false });

const STEPS = [
  { title: "Select components", icon: Cpu },
  { title: "Design enclosure", icon: Box },
  { title: "Write firmware", icon: Code2 },
  { title: "Review BOM & cost", icon: ReceiptText },
  { title: "Prepare for manufacturing", icon: Factory },
];

export default function BuildPage() {
  return <ProjectPage active="build">{(p, s) => <Build p={p} generating={s.generating} />}</ProjectPage>;
}

function Build({ p, generating }: { p: Project; generating: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const chat = useProjectAction<{ message: string }>(p.id, "chat");
  const [draft, setDraft] = useState("");
  const [retrying, setRetrying] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const msgs = p.messages ?? [];
  const first = msgs.find((m) => m.role === "assistant");
  const later = first ? msgs.slice(msgs.indexOf(first) + 1) : [];
  const ready = p.nodes.length > 0;
  const { pricing, checks } = p.compiled;

  useEffect(() => {
    if (later.length || chat.isPending) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [later.length, chat.isPending]);

  const send = () => {
    const message = draft.trim();
    if (!message || chat.isPending) return;
    setDraft("");
    chat.mutate({ message }, { onError: () => setDraft(message) });
  };

  const retry = async () => {
    setRetrying(true);
    api(`/projects/${p.id}/generate`, { method: "POST" })
      .catch(() => {})
      .finally(() => {
        setRetrying(false);
        qc.invalidateQueries({ queryKey: ["project", p.id] });
      });
    // The api marks the run as started straight away; refetch so the steps start moving.
    setTimeout(() => qc.invalidateQueries({ queryKey: ["project", p.id] }), 800);
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Home" className="rounded-lg p-1.5 text-ink-2 hover:bg-sand">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-2xl font-semibold lowercase">{p.name}</h1>
        </div>
        <div className="hidden items-center gap-4 lg:flex">
          <NewButton />
          <Avatar />
        </div>
      </header>

      {p.prompt && <div className="ml-auto max-w-[78%] rounded-3xl rounded-tr-lg bg-lilac px-6 py-4 text-[17px] leading-snug">{p.prompt}</div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <section className="min-w-0">
          <p className="text-[17px]">{first?.content ?? (p.gen.error ? "Something went wrong while building this." : "Got it! Working out a plan for your build…")}</p>
          <ol className="mt-5 flex flex-col gap-5">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const state = p.gen.step > n || p.gen.step === 0 ? "done" : p.gen.step === n ? (p.gen.error ? "failed" : "active") : "todo";
              return (
                <li key={s.title} className={clsx("flex items-start gap-4 transition-opacity", state === "todo" && "opacity-45")}>
                  <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", state === "done" ? "bg-leaf-soft text-leaf-dark" : state === "failed" ? "bg-rose-soft text-rose" : "bg-sun-soft text-[#b07d08]")}>
                    {state === "done" ? <Check className="size-4" /> : state === "active" ? <Spinner className="size-4 text-[#b07d08]" /> : n}
                  </span>
                  <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-full", state === "done" ? "bg-leaf-soft text-leaf-dark" : "bg-sun-soft text-[#c98f12]")}>
                    <s.icon className="size-5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-[16.5px] font-semibold">{s.title}</div>
                    <div className="text-ink-2">{p.gen.plan[i]}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          {p.gen.error && (
            <Notice className="mt-5">
              <p>{p.gen.error}</p>
              <Button size="sm" className="mt-2" loading={retrying} onClick={retry}>
                <RefreshCw className="size-3.5" /> Try again
              </Button>
            </Notice>
          )}
        </section>

        <PreviewCard p={p} generating={generating} />
      </div>

      {ready && (
        <Card className="p-6 lg:p-7">
          <h2 className="text-[26px] font-semibold">{p.name}</h2>
          <p className="mt-1 max-w-2xl text-[15px] text-ink-2">{p.description}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {p.features.map((f) => (
              <Chip key={f.label} icon={f.icon}>
                {f.label}
              </Chip>
            ))}
          </div>
          {checks.some((c) => c.level !== "ok") && (
            <div className="mt-4">
              <Checks checks={checks} only="problems" />
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-5">
            <Stat icon={<Coins className="size-5 text-sun" />} tone="bg-sun-soft" label="Estimated prototype price" value={inr(pricing.unitInr)} hint={`Parts ${inr(pricing.bomInr)}, plus sourcing, assembly and testing`} />
            <Stat icon={<Truck className="size-5 text-ink-2" />} tone="bg-sand" label="Estimated delivery" value={`${pricing.deliveryDays[0]}–${pricing.deliveryDays[1]} days`} hint="After order confirmation" />
            <div className="ml-auto flex gap-3">
              <Button onClick={() => input.current?.focus()}>
                <SlidersHorizontal className="size-4" /> Change something
              </Button>
              <Link href={`/p/${p.id}/design`} className={clsx("inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 font-medium text-white shadow-soft hover:bg-black", generating && "pointer-events-none opacity-50")}>
                Continue <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {ready && (
        <section className="flex flex-col gap-4">
          {later.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="pop ml-auto max-w-[78%] rounded-3xl rounded-tr-lg bg-lilac px-5 py-3 text-[15.5px]">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="pop max-w-[78%]">
                <p className="text-[15.5px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {!!m.changes.length && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {m.changes.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-leaf" /> {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )}
          {chat.isPending && (
            <div className="flex items-center gap-2 text-ink-3">
              <Spinner className="size-4" /> Reworking the design…
            </div>
          )}
          {chat.isError && <Notice>{errorText(chat.error)}</Notice>}
          <div ref={end} />
          <form
            className="flex items-end gap-3 rounded-[22px] border border-line bg-card py-2 pr-2 pl-5 shadow-soft focus-within:border-line-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={input}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={generating}
              placeholder={p.ai?.chat === false ? "Chat needs an Anthropic key on the api" : 'change something: "make it thinner", "add a screen", "3-day battery"…'}
              aria-label="Change something"
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15.5px] outline-none placeholder:text-ink-3"
            />
            <button type="submit" disabled={!draft.trim() || chat.isPending || generating} aria-label="Send" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-white disabled:opacity-40">
              <ArrowUp className="size-5" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Stat({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: string; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-4" title={hint}>
      <span className={clsx("flex size-12 items-center justify-center rounded-full", tone)}>{icon}</span>
      <div>
        <div className="text-[13px] text-ink-3">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}

type Tab = "preview" | "schematic" | "model" | "app";

function PreviewCard({ p, generating }: { p: Project; generating: boolean }) {
  const [tab, setTab] = useState<Tab>("preview");
  const ready = p.nodes.length > 0;
  const render = useProjectAction<{ reference?: string }>(p.id, "preview");
  const viewer = useRef<ViewerHandle>(null);
  const busy = render.isPending;
  // The picture is drawn from a snapshot of the real 3D model, so it shows the device that will be built.
  const makePicture = () => render.mutate({ reference: viewer.current?.snapshot() ?? undefined });

  // A build with no picture yet gets one the first time it is opened.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || generating || p.previewAssetId || !p.ai?.images || !p.nodes.length) return;
    const key = `craftr:render:${p.id}`;
    const wait = setInterval(() => {
      const reference = viewer.current?.snapshot();
      if (!reference) return; // the 3D model is still loading
      clearInterval(wait);
      if (asked.current) return;
      asked.current = true;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
      render.mutate({ reference });
    }, 500);
    return () => clearInterval(wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, p.previewAssetId, p.ai?.images, p.nodes.length, p.id]);

  return (
    <Card className="p-2">
      <Segmented<Tab>
        className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"
        value={tab}
        onChange={setTab}
        options={[
          { value: "preview", label: "Preview" },
          { value: "schematic", label: "Schematic" },
          { value: "model", label: "3D Model" },
          { value: "app", label: "App" },
        ]}
      />
      <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-xl bg-sand/70">
        {!ready ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-3">
            {generating ? <Spinner className="size-6" /> : <Thumb className="size-24 rounded-2xl" />}
            {generating ? "Choosing components…" : "No components yet"}
          </div>
        ) : tab === "preview" ? (
          <>
            {/* Always mounted: it is the stand-in while there is no picture, and the source of the snapshot. */}
            <EnclosureViewer ref={viewer} layout={p.compiled.layout} color={p.design.color} face={p.design.face} spin={!p.previewAssetId} interactive={!p.previewAssetId} className={clsx("absolute inset-0", p.previewAssetId && "pointer-events-none opacity-0")} />
            {p.previewAssetId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(p.previewAssetId)} alt={`Photo-style render of ${p.name}`} className={clsx("relative size-full object-cover transition-opacity", busy && "opacity-50")} />
            )}
            {busy ? (
              <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">
                <Spinner className="size-3.5" /> Photographing your design, about half a minute…
              </span>
            ) : p.ai?.images ? (
              <button onClick={makePicture} title="Make a fresh picture from the current design" className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2 hover:bg-card hover:text-ink">
                <RefreshCw className="size-3.5" /> {p.previewAssetId ? "Re-render picture" : "Render a picture"}
              </button>
            ) : (
              !p.previewAssetId && <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">Live 3D model</span>
            )}
            {render.isError && <span className="absolute right-3 bottom-3 max-w-[60%] rounded-xl bg-rose-soft px-3 py-1.5 text-[12.5px] text-rose">{errorText(render.error)}</span>}
          </>
        ) : tab === "model" ? (
          <>
            <EnclosureViewer layout={p.compiled.layout} color={p.design.color} face={p.design.face} mode="xray" className="size-full" />
            <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink-2">
              {p.compiled.layout.outer.w} × {p.compiled.layout.outer.h} × {p.compiled.layout.outer.d} mm · drag to rotate
            </span>
          </>
        ) : tab === "schematic" ? (
          <div className="scroll-thin h-full overflow-y-auto bg-card p-4">
            <WiringList nodes={p.nodes} compiled={p.compiled} dense />
          </div>
        ) : (
          <AppMock p={p} />
        )}
      </div>
    </Card>
  );
}

/** What the readings will look like on a phone, built from the fields the firmware actually sends. */
function AppMock({ p }: { p: Project }) {
  const fields = [...new Set(resolveNodes(p.nodes).flatMap(({ block }) => (block.driver?.read?.fields ?? []).filter((f) => f !== "audio").map((f) => `${f}|${block.icon}`)))].slice(0, 6);
  const mcu = p.nodes.map((n) => getBlock(n.blockId)).find((b) => b?.iface === "mcu");
  return (
    <div className="flex h-full items-center justify-center gap-6 p-4">
      <div className="flex h-full max-h-[330px] w-[190px] flex-col rounded-[28px] border-[6px] border-ink bg-paper p-3">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/80" />
        <div className="truncate text-[13px] font-semibold">{p.name}</div>
        <div className="mb-2 text-[10.5px] text-ink-3">{p.spec.connectivity.join(" · ") || "Offline"}</div>
        <div className="grid flex-1 grid-cols-2 content-start gap-1.5 overflow-hidden">
          {fields.length ? (
            fields.map((f) => {
              const [name] = f.split("|");
              return (
                <div key={f} className="rounded-xl border border-line bg-card p-2">
                  <div className="truncate text-[9.5px] text-ink-3 capitalize">{name.replace(/_/g, " ")}</div>
                  <div className="text-base font-semibold text-ink-3">--</div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 rounded-xl border border-line bg-card p-2 text-[11px] text-ink-3">This device has no sensor readings to show.</div>
          )}
        </div>
      </div>
      <p className="hidden max-w-[190px] text-[13px] text-ink-2 sm:block">
        A sketch of the companion screen. These are the readings the {mcu?.name ?? "controller"} sends; values appear once a real device is flashed and online.
      </p>
    </div>
  );
}
