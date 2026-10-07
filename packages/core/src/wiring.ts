import { getBlock } from "./blocks";
import type { BlockDef, Check, Edge, ProjectNode } from "./types";

const KIND_COLOR: Record<Edge["kind"], string> = {
  i2c: "#E0A23C",
  analog: "#4E9A47",
  digital: "#3B82C4",
  i2s: "#D95C8A",
  uart: "#8A6FE8",
  spi: "#2BA5A5",
  power: "#D9534F",
};

export interface Wiring {
  edges: Edge[];
  pinmap: Record<string, Record<string, string>>;
  checks: Check[];
  mcu: { node: ProjectNode; block: BlockDef } | null;
}

type Resolved = { node: ProjectNode; block: BlockDef };

export const resolveNodes = (nodes: ProjectNode[]): Resolved[] =>
  nodes.flatMap((node) => {
    const block = getBlock(node.blockId);
    return block ? [{ node, block }] : [];
  });

/** Assigns MCU pins to every block and builds the power chain. Deterministic: same nodes in, same pins out. */
export function wire(nodes: ProjectNode[]): Wiring {
  const parts = resolveNodes(nodes);
  const edges: Edge[] = [];
  const pinmap: Record<string, Record<string, string>> = {};
  const checks: Check[] = [];
  const mcus = parts.filter((p) => p.block.iface === "mcu");
  const mcu = mcus[0] ?? null;

  if (!mcu) {
    checks.push({ id: "mcu", level: "error", title: "No controller", detail: "Add an ESP32 board. Every Craftr device needs one brain." });
    return { edges, pinmap, checks, mcu: null };
  }
  if (mcus.length > 1) {
    checks.push({ id: "mcu", level: "error", title: "More than one controller", detail: `Found ${mcus.length} controller boards. Keep one and remove the rest.` });
  }

  const map = mcu.block.pinmap!;
  const used = new Set<number>();
  const gpioPool = [...map.gpio];
  const adcPool = [...map.adc];
  const failures: string[] = [];
  const take = (pool: number[]): number | null => {
    while (pool.length) {
      const n = pool.shift()!;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
    return null;
  };
  const claim = (n: number) => {
    used.add(n);
    return n;
  };
  const edge = (p: Resolved, kind: Edge["kind"], label: string, pins: { a: string; b: string }[]) => {
    const powered = p.block.pins.some((x) => x.kind === "power");
    edges.push({
      id: `${p.node.id}-${mcu.node.id}`,
      from: p.node.id,
      to: mcu.node.id,
      kind,
      color: KIND_COLOR[kind],
      label,
      pins: [...(powered ? [{ a: p.block.pins.find((x) => x.kind === "power")!.name, b: "3V3" }] : []), ...pins, { a: "GND", b: "GND" }],
    });
  };

  // Buses first, so fixed-function pins are reserved before the general pool is handed out.
  const needs = (i: BlockDef["iface"]) => parts.filter((p) => p.block.iface === i && !mcus.includes(p));
  if (needs("i2c").length) [map.i2c.sda, map.i2c.scl].forEach(claim);
  if (needs("i2s_in").length || needs("i2s_out").length) [map.i2s.bclk, map.i2s.ws].forEach(claim);
  if (needs("i2s_in").length) claim(map.i2s.din);
  if (needs("i2s_out").length) claim(map.i2s.dout);
  if (needs("uart").length) [map.uart.tx, map.uart.rx].forEach(claim);
  if (needs("spi").length) [map.spi.sck, map.spi.mosi].forEach(claim);

  const once = (i: BlockDef["iface"], what: string) => {
    if (needs(i).length > 1) checks.push({ id: `bus-${i}`, level: "error", title: `Two ${what} devices`, detail: `This controller has one ${what} port. Remove one of: ${needs(i).map((p) => p.block.name).join(", ")}.` });
  };
  once("i2s_in", "I2S input");
  once("i2s_out", "I2S output");
  once("uart", "serial");
  once("spi", "SPI display");

  for (const p of parts) {
    if (mcus.includes(p)) continue;
    const g = (n: number) => `GPIO${n}`;
    const pm: Record<string, string> = {};
    switch (p.block.iface) {
      case "i2c":
        pm.SDA = g(map.i2c.sda);
        pm.SCL = g(map.i2c.scl);
        edge(p, "i2c", `I2C ${p.block.i2cAddr ?? ""}`.trim(), [{ a: "SDA", b: pm.SDA }, { a: "SCL", b: pm.SCL }]);
        break;
      case "adc": {
        const n = take(adcPool);
        if (n === null) failures.push(p.block.name);
        else {
          pm[p.block.signals[0]] = g(n);
          edge(p, "analog", "Analog (ADC)", [{ a: p.block.signals[0], b: g(n) }]);
        }
        break;
      }
      case "gpio": {
        const pins: { a: string; b: string }[] = [];
        for (const s of p.block.signals) {
          const n = take(gpioPool);
          if (n === null) {
            failures.push(p.block.name);
            break;
          }
          pm[s] = g(n);
          pins.push({ a: s, b: g(n) });
        }
        if (pins.length) edge(p, "digital", "Digital", pins);
        break;
      }
      case "i2s_in":
        Object.assign(pm, { BCLK: g(map.i2s.bclk), WS: g(map.i2s.ws), SD: g(map.i2s.din) });
        edge(p, "i2s", "I2S audio in", [{ a: "SCK", b: pm.BCLK }, { a: "WS", b: pm.WS }, { a: "SD", b: pm.SD }]);
        break;
      case "i2s_out":
        Object.assign(pm, { BCLK: g(map.i2s.bclk), WS: g(map.i2s.ws), DIN: g(map.i2s.dout) });
        edge(p, "i2s", "I2S audio out", [{ a: "BCLK", b: pm.BCLK }, { a: "LRC", b: pm.WS }, { a: "DIN", b: pm.DIN }]);
        break;
      case "uart":
        // Module TX goes to the controller's RX and the other way round.
        Object.assign(pm, { TX: g(map.uart.rx), RX: g(map.uart.tx) });
        edge(p, "uart", "Serial (UART)", [{ a: "TX", b: pm.TX }, { a: "RX", b: pm.RX }]);
        break;
      case "spi": {
        const cs = take(gpioPool);
        const dc = take(gpioPool);
        if (cs === null || dc === null) failures.push(p.block.name);
        else {
          Object.assign(pm, { SCK: g(map.spi.sck), MOSI: g(map.spi.mosi), CS: g(cs), DC: g(dc) });
          edge(p, "spi", "SPI", [{ a: "SCK", b: pm.SCK }, { a: "MOSI", b: pm.MOSI }, { a: "CS", b: pm.CS }, { a: "DC", b: pm.DC }]);
        }
        break;
      }
    }
    if (Object.keys(pm).length) pinmap[p.node.id] = pm;
  }

  if (failures.length) {
    checks.push({ id: "pins", level: "error", title: "Out of pins", detail: `${mcu.block.name} has no free pins left for: ${[...new Set(failures)].join(", ")}. Use a larger controller or remove a block.` });
  } else {
    checks.push({ id: "pins", level: "ok", title: "Pins assigned", detail: `Every block has its own pins on the ${mcu.block.name}, with ${gpioPool.filter((n) => !used.has(n)).length} digital pins to spare.` });
  }

  // I2C address clashes.
  const addrs = new Map<string, string[]>();
  for (const p of needs("i2c")) addrs.set(p.block.i2cAddr ?? "?", [...(addrs.get(p.block.i2cAddr ?? "?") ?? []), p.block.name]);
  for (const [addr, names] of addrs) {
    if (names.length > 1) checks.push({ id: `i2c-${addr}`, level: "error", title: "I2C address clash", detail: `${names.join(" and ")} both answer at ${addr}. Keep one of them.` });
  }

  // Power chain: source -> charger -> (switch) -> (regulator) -> controller.
  const find = (tag: string) => parts.find((p) => p.block.tags.includes(tag));
  const battery = find("battery");
  const charger = find("charger");
  const regulator = find("regulator");
  const sw = find("power_switch");
  const solar = find("solar");
  const pad = find("wireless_charging");
  const usb = parts.find((p) => p.block.id === "usb_c");
  const power = (a: Resolved, b: Resolved, label: string, pins: { a: string; b: string }[]) =>
    edges.push({ id: `${a.node.id}-${b.node.id}`, from: a.node.id, to: b.node.id, kind: "power", color: KIND_COLOR.power, label, pins });

  if (battery) {
    const onboard = mcu.block.tags.includes("onboard_charger");
    if (charger) {
      power(battery, charger, "Battery", [{ a: "BAT+", b: "BAT+" }, { a: "BAT-", b: "GND" }]);
      let tail: Resolved = charger;
      let out = "OUT+";
      if (sw) {
        power(tail, sw, "Switched", [{ a: out, b: "IN" }]);
        tail = sw;
        out = "OUT";
      }
      if (regulator) {
        power(tail, regulator, "Battery rail", [{ a: out, b: "VIN" }, { a: "GND", b: "GND" }]);
        power(regulator, mcu, "3.3V", [{ a: "VOUT", b: "3V3" }, { a: "GND", b: "GND" }]);
      } else {
        power(tail, mcu, "Battery rail", [{ a: out, b: "5V" }, { a: "GND", b: "GND" }]);
      }
      if (usb) power(usb, charger, "5V", [{ a: "VBUS", b: "IN+" }, { a: "GND", b: "GND" }]);
      if (solar) power(solar, charger, "Solar", [{ a: "V+", b: "IN+" }, { a: "V-", b: "GND" }]);
      if (pad && charger.block.tags.includes("boost_5v")) power(charger, pad, "5V to phone charger", [{ a: "5V", b: "5V" }, { a: "GND", b: "GND" }]);
    } else if (onboard) {
      power(battery, mcu, "Battery", [{ a: "BAT+", b: "BAT+" }, { a: "BAT-", b: "BAT-" }]);
    } else {
      power(battery, mcu, "Battery", [{ a: "BAT+", b: "5V" }, { a: "BAT-", b: "GND" }]);
      checks.push({ id: "charger", level: "error", title: "Battery has no charger", detail: "A Li-Po cell needs a charger and protection board. Add the Battery Charger block." });
    }
  } else {
    if (usb) power(usb, mcu, "5V", [{ a: "VBUS", b: "5V" }, { a: "GND", b: "GND" }]);
    if (charger) checks.push({ id: "charger", level: "warn", title: "Charger without a battery", detail: "There is a charger but no battery. Add a battery or remove the charger." });
  }
  if (pad && !(battery && charger?.block.tags.includes("boost_5v"))) checks.push({ id: "phone-charging", level: "error", title: "Phone charger has no power source", detail: "The MagSafe Charging Pad needs a battery and the Power Bank Module, which supplies the 5V it runs on." });
  if (solar && !charger) checks.push({ id: "solar", level: "error", title: "Solar panel has nowhere to go", detail: "The panel needs a battery and the Battery Charger block to store its energy." });

  return { edges, pinmap, checks, mcu };
}
