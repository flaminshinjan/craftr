import { assemblyGuide } from "./assembly";
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

  const guide = assemblyGuide(p);
  const steps = guide.steps.map((x) => `${x.title}. ${x.body}${x.items.length ? `\n${x.items.map((i) => `   - ${i}`).join("\n")}` : ""}`);

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
