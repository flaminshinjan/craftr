"use client";

/* Minimal Web Serial typings; the API is Chromium-only and not in lib.dom. */
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

export type Log = (kind: "info" | "ok" | "busy" | "error", text: string) => void;
export const canFlash = () => typeof navigator !== "undefined" && "serial" in navigator;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Copies a file onto a board that already runs MicroPython, using the raw REPL over USB serial.
 * The board needs MicroPython firmware installed once beforehand (micropython.org/download).
 */
export async function flashMicroPython(name: string, code: string, log: Log) {
  log("busy", "Connecting to device...");
  const port: SerialPortLike = await (navigator as unknown as { serial: { requestPort(): Promise<SerialPortLike> } }).serial.requestPort();
  await port.open({ baudRate: 115200 });
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let seen = "";
  let reading = true;
  const pump = (async () => {
    while (reading) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      if (value) seen += dec.decode(value);
    }
  })();
  const send = (s: string) => writer.write(enc.encode(s));
  const waitFor = async (needle: string, ms: number) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (seen.includes(needle)) return true;
      await sleep(30);
    }
    return false;
  };
  /** Runs one snippet in the raw REPL and fails on a traceback. */
  const run = async (src: string) => {
    seen = "";
    await send(src);
    await send("\x04");
    if (!(await waitFor("\x04>", 5000)) && !seen.includes("OK")) throw new Error("The board stopped responding.");
    if (seen.includes("Traceback")) throw new Error(seen.slice(seen.indexOf("Traceback")).replace(/[\x04>]/g, "").trim().split("\n").pop() ?? "The board reported an error.");
  };

  try {
    await send("\r\x03\x03");
    await sleep(250);
    seen = "";
    await send("\x01");
    if (!(await waitFor("raw REPL", 2500))) throw new Error("No MicroPython prompt. Install MicroPython on the board first, then try again.");
    log("ok", "Connected to MicroPython");
    log("info", `Uploading firmware (${name})...`);
    await run(`f=open(${JSON.stringify(name)},'w')`);
    const SIZE = 256;
    const total = Math.ceil(code.length / SIZE);
    let mark = 0;
    for (let i = 0; i < total; i++) {
      await run(`f.write(${JSON.stringify(code.slice(i * SIZE, (i + 1) * SIZE))})`);
      const pct = Math.floor(((i + 1) / total) * 4) * 25;
      if (pct > mark) log("busy", `Writing...   ${(mark = pct)}%`);
    }
    await run("f.close()");
    log("ok", "Firmware uploaded successfully!");
    log("busy", "Restarting device...");
    await send("\x02");
    await sleep(100);
    seen = "";
    await send("\x04");
    await sleep(1500);
    log("ok", "Device restarted.");
    const boot = seen.replace(/[^\x20-\x7e\n]/g, "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-4);
    boot.forEach((l) => log("info", l));
  } finally {
    reading = false;
    await reader.cancel().catch(() => {});
    await pump;
    reader.releaseLock();
    writer.releaseLock();
    await port.close().catch(() => {});
  }
}
