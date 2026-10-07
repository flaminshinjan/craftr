import { getBlock } from "./blocks";
import type { Compiled, DesignConfig, Firmware, ProductSpec, ProjectNode } from "./types";

export interface PackageInput {
  name: string;
  description: string;
  spec: ProductSpec;
  nodes: ProjectNode[];
  design: DesignConfig;
  compiled: Compiled;
  firmware: Firmware | null;
}

const csv = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** The text half of the manufacturing package. The STL is exported from the 3D model in the browser. */
export function buildPackage(p: PackageInput): { name: string; mime: string; content: string }[] {
  const label = (id: string) => getBlock(p.nodes.find((n) => n.id === id)?.blockId ?? "")?.name ?? id;
  const { layout: l } = p.compiled;

  const bom = ["Component,Detail,Qty,Unit price (INR),Total (INR),Vendor", ...p.compiled.bom.map((r) => [r.name, r.detail, r.qty, r.unitInr, r.totalInr, r.blockId ? getBlock(r.blockId)?.vendor ?? "" : "Craftr"].map(csv).join(","))].join("\n") + "\n";

  const wiring = p.compiled.edges.map((e) => ({ from: label(e.from), to: label(e.to), type: e.kind, connections: e.pins.map((x) => `${x.a} -> ${x.b}`) }));

  const steps: string[] = [];
  const power = p.compiled.edges.filter((e) => e.kind === "power");
  const signal = p.compiled.edges.filter((e) => e.kind !== "power");
  steps.push(`Print the enclosure in ${p.design.material} (${l.outer.w} × ${l.outer.h} × ${l.outer.d} mm, ${l.wall} mm walls, 0.2 mm layers, 20% infill). The body prints open side up; the front lid prints face down.`);
  if (signal.length) steps.push(`Wire each module to the controller:\n${signal.map((e) => `   - ${label(e.from)}: ${e.pins.map((x) => `${x.a} → ${x.b}`).join(", ")}`).join("\n")}`);
  if (power.length) steps.push(`Wire the power chain, battery last:\n${power.map((e) => `   - ${label(e.from)} → ${label(e.to)}: ${e.pins.map((x) => `${x.a} → ${x.b}`).join(", ")}`).join("\n")}`);
  steps.push(`Flash ${p.firmware?.files[0]?.name ?? "the firmware"} over USB-C and confirm the device boots before closing it up.`);
  const order = ["back", "power", "logic", "front"];
  const inside = l.placements.filter((x) => x.layer !== "external").sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
  if (inside.length) steps.push(`Seat the parts in the body from the rear wall forward: ${inside.map((x) => label(x.nodeId)).join(", ")}. Line the USB-C ports up with the openings on the right side.`);
  const ext = l.placements.filter((x) => x.layer === "external");
  if (ext.length) steps.push(`Fit the external parts through their openings: ${ext.map((x) => label(x.nodeId)).join(", ")}.`);
  steps.push("Press the front lid on, checking that buttons move freely and the display sits behind its window.");
  steps.push("Functional test: power on, check every sensor reading and output, check charging, then confirm it connects.");

  const assembly = `# ${p.name}: assembly\n\n${p.description}\n\n## Parts\n\n${p.compiled.bom.map((r) => `- ${r.qty} × ${r.name}${r.detail ? ` (${r.detail})` : ""}`).join("\n")}\n\n## Steps\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n## Checks Craftr ran\n\n${p.compiled.checks.map((c) => `- [${c.level === "ok" ? "x" : " "}] ${c.title}: ${c.detail}`).join("\n")}\n`;

  const product = { name: p.name, description: p.description, spec: p.spec, blocks: p.nodes.map((n) => n.blockId), enclosure: { ...p.design, ...l.outer, wall_mm: l.wall, cutouts: l.cutouts }, power: p.compiled.power, mass_g: l.massG };

  return [
    { name: "product.json", mime: "application/json", content: JSON.stringify(product, null, 2) + "\n" },
    { name: "bom.csv", mime: "text/csv", content: bom },
    { name: "wiring.json", mime: "application/json", content: JSON.stringify(wiring, null, 2) + "\n" },
    { name: "assembly.md", mime: "text/markdown", content: assembly },
    ...(p.firmware?.files.map((f) => ({ name: `firmware/${f.name}`, mime: "text/plain", content: f.content })) ?? []),
  ];
}
