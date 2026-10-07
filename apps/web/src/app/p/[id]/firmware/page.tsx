"use client";

import clsx from "clsx";
import { ArrowRight, Check, CircleDot, Copy, Cpu, Download, Grip, Info, RefreshCw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CodeView } from "@/components/code-view";
import { NotReady, ProjectPage } from "@/components/project-parts";
import { PageHead } from "@/components/shell";
import { Button, Card, Notice } from "@/components/ui";
import { errorText } from "@/lib/api";
import { canFlash, flashMicroPython } from "@/lib/flash";
import { download, useProjectAction } from "@/lib/project";
import type { Project } from "@/lib/types";

type Line = { at: string; kind: "info" | "ok" | "busy" | "error"; text: string };

export default function Page() {
  return <ProjectPage active="firmware">{(p, s) => (p.firmware ? <FirmwarePage p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

function FirmwarePage({ p }: { p: Project }) {
  const fw = p.firmware!;
  const file = fw.files[0];
  const regen = useProjectAction<{ language: "micropython" | "arduino" }>(p.id, "firmware");
  const [logs, setLogs] = useState<Line[]>([]);
  const [flashing, setFlashing] = useState(false);
  const [copied, setCopied] = useState(false);
  const log = (kind: Line["kind"], text: string) => setLogs((l) => [...l, { at: new Date().toLocaleTimeString("en-GB"), kind, text }]);

  const flash = async () => {
    if (fw.language !== "micropython") return log("info", "Arduino sketches are compiled on your computer. Download main.ino and upload it from the Arduino IDE (board: ESP32).");
    if (!canFlash()) return log("error", "This browser cannot talk to USB devices. Use Chrome or Edge on a computer, or download main.py and copy it with Thonny.");
    setFlashing(true);
    try {
      await flashMicroPython(file.name, file.content, log);
    } catch (e) {
      const msg = errorText(e);
      log(/No port selected|cancel/i.test(msg) ? "info" : "error", /No port selected|cancel/i.test(msg) ? "No device selected." : msg);
    } finally {
      setFlashing(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-[1280px] flex-col">
      <PageHead
        title="Firmware"
        subtitle={`Program your ${p.name.toLowerCase()} and send it to your device.`}
        right={
          <>
            <select
              aria-label="Firmware language"
              value={fw.language}
              disabled={regen.isPending}
              onChange={(e) => regen.mutate({ language: e.target.value as "micropython" | "arduino" })}
              className="h-12 rounded-xl border border-line bg-card px-4 shadow-soft"
            >
              <option value="micropython">MicroPython (ESP32)</option>
              <option value="arduino">Arduino C++ (ESP32)</option>
            </select>
            <Button variant="dark" className="h-12 px-5" onClick={flash} loading={flashing}>
              <Cpu className="size-4" /> Flash
            </Button>
          </>
        }
      />
      {regen.isError && <Notice className="mb-4">{errorText(regen.error)}</Notice>}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="flex min-h-[420px] flex-col overflow-hidden lg:min-h-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <span className="font-semibold">{file.name}</span>
            <span className={clsx("rounded-md px-2 py-0.5 text-[11.5px] font-medium", fw.source === "ai" ? "bg-lilac text-[#5a4fc7]" : "bg-sand text-ink-2")} title={fw.source === "ai" ? "Written by Claude from the verified driver snippets and your pin assignments" : "Composed from each block's verified driver snippet"}>
              {fw.source === "ai" ? "Written by Claude" : "Driver baseline"}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => regen.mutate({ language: fw.language })} loading={regen.isPending} title="Rewrite the firmware for the current design">
                {!regen.isPending && <RefreshCw className="size-3.5" />} {regen.isPending ? "Writing…" : "Regenerate"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(file.content).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
                {copied ? <Check className="size-3.5 text-leaf" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => download(file.name, file.content)}>
                <Download className="size-3.5" /> Download
              </Button>
            </div>
          </div>
          <div className={clsx("min-h-0 flex-1 transition-opacity", regen.isPending && "opacity-40")}>
            <CodeView code={file.content} language={fw.language === "arduino" ? "c" : "python"} />
          </div>
        </Card>

        <Card className="flex min-h-[320px] flex-col lg:min-h-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-xl font-semibold">Logs</h2>
            <button onClick={() => setLogs([])} disabled={!logs.length} className="flex items-center gap-2 text-ink-2 disabled:opacity-40">
              <Trash2 className="size-4" /> Clear
            </button>
          </div>
          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pb-4 font-mono text-[12.5px]" aria-live="polite">
            {!logs.length && (
              <li className="font-sans text-[13.5px] leading-relaxed text-ink-3">
                Connect your board over USB-C and press Flash. Craftr copies {file.name} onto a board that already runs MicroPython; install MicroPython once from micropython.org first.
              </li>
            )}
            {logs.map((l, i) => (
              <li key={i} className="flex items-start gap-3 py-1.5">
                <span className="text-ink-3">{l.at}</span>
                {l.kind === "ok" ? <Check className="mt-0.5 size-4 shrink-0 text-leaf" /> : l.kind === "error" ? <X className="mt-0.5 size-4 shrink-0 text-rose" /> : l.kind === "busy" ? <Grip className="mt-0.5 size-4 shrink-0 text-ink-3" /> : l.text.startsWith("Connect") ? <CircleDot className="mt-0.5 size-4 shrink-0 text-ink-3" /> : <Info className="mt-0.5 size-4 shrink-0 text-ink-3" />}
                <span className={clsx("min-w-0 break-words", l.kind === "error" && "text-rose")}>{l.text}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4">
            <Link href={`/p/${p.id}/bom`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sand font-medium hover:bg-line">
              Continue to BOM & cost <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
