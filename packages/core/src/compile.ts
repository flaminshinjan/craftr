import { getBlock } from "./blocks";
import { MIN_WALL, enclosureCostInr, layout } from "./layout";
import { resolveNodes, wire } from "./wiring";
import type { BomRow, Check, Compiled, DesignConfig, PowerEstimate, Pricing, ProductSpec, ProjectNode } from "./types";

const DUTY: Record<ProductSpec["duty"], number> = { always_on: 1, periodic: 0.02, event_driven: 0.06 };

export function estimatePower(nodes: ProjectNode[], spec: Pick<ProductSpec, "duty">): PowerEstimate {
  const parts = resolveNodes(nodes);
  const duty = DUTY[spec.duty] ?? 1;
  const peakMa = parts.reduce((s, p) => s + p.block.activeMa, 0);
  const sleepMa = parts.reduce((s, p) => s + p.block.sleepUa, 0) / 1000;
  const avgMa = Math.round((peakMa * duty + sleepMa * (1 - duty)) * 100) / 100;
  const capacityMah = parts.reduce((s, p) => s + (p.block.capacityMah ?? 0), 0) || null;
  const batteryHours = capacityMah && avgMa > 0 ? Math.round((capacityMah * 0.85) / avgMa) : null;
  return { avgMa, peakMa: Math.round(peakMa), capacityMah, batteryHours, batteryLabel: batteryHours === null ? "USB powered" : humanHours(batteryHours) };
}

export function humanHours(h: number): string {
  if (h < 48) return `~${h} hours`;
  const d = h / 24;
  if (d < 60) return `~${Math.round(d)} days`;
  if (d < 730) return `~${Math.round(d / 30)} months`;
  return `~${(d / 365).toFixed(1)} years`;
}

const nice = (n: number) => Math.max(99, Math.ceil(n / 10) * 10 - 1);

export function price(bomInr: number): Pricing {
  // Parts at a sourcing markup, plus a flat fee for assembly, flashing and test.
  const proto = nice(bomInr * 1.3 + 320);
  return {
    bomInr,
    unitInr: proto,
    deliveryDays: [7, 10],
    tiers: [
      { id: "prototype", name: "Prototype", qty: 1, leadTime: "7–10 days", unitInr: proto, perks: ["Assemble and test", "Source components", "Basic QA"] },
      { id: "small_batch", name: "Small Batch", qty: 10, leadTime: "2–3 weeks", unitInr: nice(bomInr * 1.22 + 190), perks: ["Bulk component sourcing", "Assembly & testing", "Quality check"] },
      { id: "batch", name: "Batch", qty: 50, leadTime: "4–6 weeks", unitInr: nice(bomInr * 1.15 + 120), perks: ["Best unit pricing", "Full assembly & testing", "Production QA"] },
    ],
  };
}

export const SHIPPING_INR = 99;
export const GST_RATE = 0.18;
export function orderTotals(unitInr: number, qty: number) {
  const subtotal = unitInr * qty;
  const shipping = SHIPPING_INR + Math.floor((qty - 1) / 10) * 150;
  const tax = Math.round(subtotal * GST_RATE);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}

/** Everything that can be derived from the chosen blocks and the design, with no model in the loop. */
export function compile(input: { nodes: ProjectNode[]; design: DesignConfig; spec: ProductSpec }): Compiled {
  const { nodes, design, spec } = input;
  const parts = resolveNodes(nodes);
  const w = wire(nodes);
  const l = layout(nodes, design);
  const power = estimatePower(nodes, spec);
  const checks: Check[] = [...w.checks];

  // Voltage: everything hangs off the 3.3V rail unless it is part of the power chain.
  const bad = parts.filter((p) => p.block.iface !== "power" && p.block.iface !== "mcu" && p.block.iface !== "none" && (p.block.voltage.min > 3.3 || p.block.voltage.max < 3.3));
  checks.push(
    bad.length
      ? { id: "voltage", level: "error", title: "Voltage mismatch", detail: `${bad.map((p) => p.block.name).join(", ")} cannot run from the 3.3V rail.` }
      : { id: "voltage", level: "ok", title: "Voltages match", detail: "Every block runs from the controller's 3.3V rail." },
  );

  // Current budget against whichever supply feeds the rail.
  const regulator = parts.find((p) => p.block.tags.includes("regulator"));
  const limit = regulator?.block.supplyMa ?? w.mcu?.block.supplyMa ?? 500;
  if (power.peakMa > limit) checks.push({ id: "current", level: "error", title: "Draws too much current", detail: `Peak draw is ${power.peakMa} mA but the 3.3V supply gives ${limit} mA. Add the Voltage Regulator block or remove a power-hungry part.` });
  else if (power.peakMa > limit * 0.8) checks.push({ id: "current", level: "warn", title: "Close to the current limit", detail: `Peak draw is ${power.peakMa} mA of ${limit} mA available.` });
  else checks.push({ id: "current", level: "ok", title: "Power budget is fine", detail: `Peak draw is ${power.peakMa} mA of ${limit} mA available.` });

  // Battery life against what was asked for.
  if (power.batteryHours !== null) {
    const want = spec.battery_target_hours;
    if (want && power.batteryHours < want) checks.push({ id: "battery", level: "warn", title: "Battery life is short of the target", detail: `Estimated ${power.batteryLabel} against a target of ${humanHours(want)}. Use a bigger cell or wake less often.` });
    else checks.push({ id: "battery", level: "ok", title: "Battery life", detail: `Estimated ${power.batteryLabel} per charge on ${power.capacityMah} mAh (average ${power.avgMa} mA).` });
  } else if (spec.power_source !== "usb" && w.mcu) {
    checks.push({ id: "battery", level: "warn", title: "No battery", detail: "The spec asks for battery power but there is no battery block, so the device only runs from USB." });
  }

  // Mechanical.
  checks.push(
    l.fits
      ? { id: "fit", level: "ok", title: "Components fit", detail: `Everything fits in ${l.outer.w} × ${l.outer.h} × ${l.outer.d} mm with ${l.clearance} mm clearance.` }
      : { id: "fit", level: "error", title: "Enclosure is too small", detail: `The parts need at least ${l.minOuter.w} × ${l.minOuter.h} × ${l.minOuter.d} mm. Current size is ${l.outer.w} × ${l.outer.h} × ${l.outer.d} mm.` },
  );
  checks.push(
    l.wall >= MIN_WALL
      ? { id: "wall", level: "ok", title: "Printable walls", detail: `${l.wall} mm walls, above the ${MIN_WALL} mm minimum for FDM printing.` }
      : { id: "wall", level: "error", title: "Walls too thin", detail: `${l.wall} mm walls are below the ${MIN_WALL} mm minimum.` },
  );
  const ports = l.cutouts.filter((c) => c.face === "right");
  if (w.mcu) {
    checks.push(
      ports.length
        ? { id: "ports", level: "ok", title: "Ports reachable", detail: `${ports.length} USB-C opening${ports.length > 1 ? "s" : ""} on the right side, ${l.cutouts.length - ports.length} other opening${l.cutouts.length - ports.length === 1 ? "" : "s"}.` }
        : { id: "ports", level: "warn", title: "No USB opening", detail: "Nothing reaches the outside for charging or flashing." },
    );
  }

  // Bill of materials.
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.block.id, (counts.get(p.block.id) ?? 0) + 1);
  const bom: BomRow[] = [...counts].map(([id, qty]) => {
    const b = getBlock(id)!;
    return { key: id, blockId: id, name: b.name, detail: b.subtitle, qty, unitInr: b.priceInr, totalInr: b.priceInr * qty };
  });
  if (parts.length) {
    const enc = enclosureCostInr(l, design.material);
    bom.push({ key: "enclosure", blockId: null, name: "Enclosure (3D Printed)", detail: `${design.material}, ${l.outer.w} × ${l.outer.h} × ${l.outer.d} mm`, qty: 1, unitInr: enc, totalInr: enc });
    bom.push({ key: "misc", blockId: null, name: "Misc (wires, screws, etc.)", detail: "Jumper wires, M2 screws, heat-set inserts", qty: 1, unitInr: 50, totalInr: 50 });
  }
  const bomInr = bom.reduce((s, r) => s + r.totalInr, 0);

  return { edges: w.edges, pinmap: w.pinmap, checks, layout: l, bom, pricing: price(bomInr), power };
}
