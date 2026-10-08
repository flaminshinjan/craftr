import { getBlock } from "./blocks";
import { MATERIAL } from "./layout";
import type { Compiled, DesignConfig, Firmware, ProjectNode } from "./types";

export interface AssemblyStep {
  title: string;
  body: string;
  items: string[];
}

export interface WireRow {
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  kind: string;
  color: string;
}

export interface AssemblyGuide {
  tools: string[];
  wires: WireRow[];
  steps: AssemblyStep[];
}

/** How to build one unit by hand: every wire, then the order the parts go into the printed shell. */
export function assemblyGuide(p: { nodes: ProjectNode[]; design: DesignConfig; compiled: Compiled; firmware: Firmware | null }): AssemblyGuide {
  const label = (id: string) => getBlock(p.nodes.find((n) => n.id === id)?.blockId ?? "")?.name ?? id;
  const { layout: l, edges } = p.compiled;
  const wires: WireRow[] = edges.flatMap((e) => e.pins.map((x) => ({ from: label(e.from), fromPin: x.a, to: label(e.to), toPin: x.b, kind: e.kind, color: e.color })));
  const row = (w: WireRow) => `${w.from} ${w.fromPin} → ${w.to} ${w.toPin}`;
  const signal = wires.filter((w) => w.kind !== "power");
  const power = wires.filter((w) => w.kind === "power");
  const names = (layer: string) => l.placements.filter((x) => x.layer === layer).map((x) => label(x.nodeId));
  const boards = [...names("back"), ...names("power"), ...names("logic")];
  const front = names("front");
  const outside = names("external");
  const two = p.design.face && p.design.face !== p.design.color;

  const steps: AssemblyStep[] = [];
  const add = (title: string, body: string, items: string[] = []) => steps.push({ title, body, items });
  add(
    "Print the two parts",
    `Print the body and the front panel in ${(p.design.finish ?? "chalk") === "chalk" ? "matte-grade " : ""}${MATERIAL[p.design.material]?.name ?? p.design.material}${two ? ", each in its own colour" : ""}${(p.design.finish ?? "chalk") === "chalk" ? ", which gives the chalk finish" : ""}: ${l.outer.w} × ${l.outer.h} × ${l.outer.d} mm outside, ${l.wall} mm walls, 0.2 mm layers, 20% infill, no supports. The body prints open side up. The front panel prints face down, which gives it its smooth face.`,
  );
  if (signal.length) add("Wire the modules to the controller", "Cut each wire about 20 mm longer than the gap it has to cross, so parts can be lifted out later. Solder one wire per row.", signal.map(row));
  if (power.length) add("Wire the power chain", "Do the battery last, and keep its two leads apart while you work.", power.map(row));
  add("Flash and test on the bench", `Before anything goes into the shell, flash ${p.firmware?.files[0]?.name ?? "the firmware"} over USB-C and check that every sensor reads and every output works. A fault is far easier to fix now.`);
  if (front.length) add("Fit the front panel parts", "Turn the front panel face down. Each of these drops into its printed frame on the inside of the panel, facing out through its opening. Hold each with a small dab of glue at one corner.", front);
  if (boards.length)
    add(
      "Seat the boards in the body",
      "Work from the rear wall forward, in this order. Each board rests on the ledges of its printed posts: tilt one edge in under the clips, then press the other edge down until it clicks. A part with no posts around it (it sits directly on another part) is fixed with a square of double-sided foam tape. Line each USB-C port up with its opening on the right side.",
      boards,
    );
  if (outside.length) add("Fit the outside parts", "These pass through their openings from outside. Seal around each with a little glue.", outside);
  add("Close it up", "Tuck the wires clear of the rim and press the front panel in until it sits just below the rim all the way round. The ribs on its lip grip the body, so the first fit is firm. To open it again, lift the panel at the thumbnail notch in the bottom edge.");
  add("Final test", "Power on, check every reading and output again, check that it charges, and confirm it connects.");

  return { tools: ["Soldering iron and solder", "Thin stranded wire (26–30 AWG) in a few colours", "Wire strippers and flush cutters", "Double-sided foam tape and a gel superglue", "USB-C cable", "Multimeter"], wires, steps };
}
