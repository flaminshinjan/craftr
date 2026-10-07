import { resolveNodes } from "./wiring";
import type { BlockDef, DesignConfig, EnclosureStyle, Layout, Material, PlacedCutout, Placement, ProjectNode } from "./types";

export const STYLE: Record<EnclosureStyle, { wall: number; radius: number; clearance: number; label: string; blurb: string }> = {
  minimal: { wall: 2, radius: 8, clearance: 1.2, label: "Minimal", blurb: "Soft corners, clean faces" },
  rugged: { wall: 3, radius: 4, clearance: 1.5, label: "Rugged", blurb: "Thick walls, survives drops" },
  compact: { wall: 1.6, radius: 5, clearance: 0.6, label: "Compact", blurb: "As small as the parts allow" },
};

export const MATERIAL: Record<Material, { density: number; inrPerG: number; blurb: string }> = {
  PLA: { density: 1.24, inrPerG: 1.2, blurb: "Easy, crisp detail, indoor use" },
  ABS: { density: 1.04, inrPerG: 1.4, blurb: "Tough, handles heat" },
  PETG: { density: 1.27, inrPerG: 1.5, blurb: "Strong, weather resistant" },
  PC: { density: 1.2, inrPerG: 2.4, blurb: "Very strong, premium" },
};

export const COLORS = ["#F2EBDD", "#5FA052", "#D9B98E", "#C9C9C6", "#3F4043"];
export const MIN_WALL = 1.2;
const GAP = 2;
const LAYER_GAP = 1.5;

type Item = { nodeId: string; block: BlockDef; w: number; d: number; t: number };
type Placed = Item & { x: number; y: number; rotated?: boolean };
type Packed = { items: Placed[]; w: number; h: number; t: number; hasPort: boolean };

/** Shelf-packs boards into rows. Boards with a USB port start a row so they sit against the right-hand wall. */
function pack(items: Item[], maxW?: number): Packed {
  if (!items.length) return { items: [], w: 0, h: 0, t: 0, hasPort: false };
  const sorted = [...items].sort((a, b) => Number(!!b.block.port) - Number(!!a.block.port) || b.w * b.d - a.w * a.d);
  const area = sorted.reduce((s, i) => s + (i.w + GAP) * (i.d + GAP), 0);
  const target = Math.max(...sorted.map((i) => i.w), maxW ?? Math.sqrt(area) * 1.25);
  const rows: { items: Item[]; w: number; d: number }[] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (!row || it.block.port || row.w + GAP + it.w > target) rows.push({ items: [it], w: it.w, d: it.d });
    else {
      row.items.push(it);
      row.w += GAP + it.w;
      row.d = Math.max(row.d, it.d);
    }
  }
  const w = Math.max(...rows.map((r) => r.w));
  const h = rows.reduce((s, r) => s + r.d, 0) + GAP * (rows.length - 1);
  const out: Placed[] = [];
  let y = h / 2;
  for (const row of rows) {
    let x = w / 2; // fill from the right edge towards the left
    for (const it of row.items) {
      out.push({ ...it, x: x - it.w / 2, y: y - row.d / 2 });
      x -= it.w + GAP;
    }
    y -= row.d + GAP;
  }
  return { items: out, w, h, t: Math.max(...sorted.map((i) => i.t)), hasPort: sorted.some((i) => !!i.block.port) };
}

const inCircle = (p: Placed, r: number) => (p.block.round ? Math.hypot(p.x, p.y) + p.w / 2 <= r + 1e-6 : Math.hypot(Math.abs(p.x) + p.w / 2, Math.abs(p.y) + p.d / 2) <= r + 1e-6);
const clash = (a: Placed, b: Placed) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + GAP - 1e-6 && Math.abs(a.y - b.y) < (a.d + b.d) / 2 + GAP - 1e-6;

/**
 * Packs parts into a disc of radius r. Boards with a USB port go hard against the right-hand wall;
 * everything else takes the free spot nearest the centre, turned 90° when that helps.
 */
function packCircle(items: Item[], r: number): Placed[] | null {
  // Ports claim the wall first; then the things a person touches or looks at take the centre.
  const rank = (i: Item) => (i.block.port ? 0 : i.block.category === "input" || i.block.category === "display" ? 1 : 2);
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || b.w * b.d - a.w * a.d);
  const placed: Placed[] = [];
  const free = (c: Placed) => inCircle(c, r) && !placed.some((p) => clash(c, p));
  const n = Math.floor(r);
  const grid: [number, number][] = [];
  for (let x = -n; x <= n; x++) for (let y = -n; y <= n; y++) if (Math.hypot(x, y) <= r) grid.push([x, y]);
  grid.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0]);

  for (const it of sorted) {
    let spot: Placed | null = null;
    if (it.block.port) {
      for (let k = 0; k <= 2 * n && !spot; k++) {
        const y = k % 2 ? (k + 1) / 2 : -k / 2;
        const far = Math.abs(y) + it.d / 2;
        if (far >= r) continue;
        const c = { ...it, x: Math.sqrt(r * r - far * far) - it.w / 2, y };
        if (free(c)) spot = c;
      }
    } else {
      const turns = it.block.round || it.w === it.d ? [false] : [false, true];
      for (const [x, y] of grid) {
        for (const rotated of turns) {
          const c: Placed = rotated ? { ...it, w: it.d, d: it.w, x, y, rotated } : { ...it, x, y };
          if (free(c)) {
            spot = c;
            break;
          }
        }
        if (spot) break;
      }
    }
    if (!spot) return null;
    placed.push(spot);
  }
  return placed;
}

const radiusCache = new Map<string, number>();
/** Smallest disc (to the millimetre) the parts pack into. */
function minRadius(items: Item[]): number {
  if (!items.length) return 0;
  const key = items.map((i) => `${i.block.id}:${i.w}x${i.d}`).sort().join("|");
  const hit = radiusCache.get(key);
  if (hit !== undefined) return hit;
  const area = items.reduce((s, i) => s + (i.block.round ? (Math.PI * i.w * i.w) / 4 : i.w * i.d), 0);
  let r = Math.ceil(Math.max(Math.sqrt(area / Math.PI), ...items.map((i) => (i.block.round ? i.w / 2 : Math.hypot(i.w, i.d) / 2))));
  while (!packCircle(items, r) && r < 400) r++;
  radiusCache.set(key, r);
  return r;
}

const ceil = (n: number) => Math.ceil(n - 1e-6);
const ORDER = ["back", "power", "logic", "front"] as const;
type LayerKey = (typeof ORDER)[number];

export function layout(nodes: ProjectNode[], design: DesignConfig): Layout {
  const style = STYLE[design.style] ?? STYLE.minimal;
  const { wall, clearance } = style;
  const shape = design.shape === "round" ? "round" : "box";
  const parts = resolveNodes(nodes);
  const item = (p: (typeof parts)[number]): Item => ({ nodeId: p.node.id, block: p.block, w: p.block.size.w, d: p.block.size.d, t: p.block.size.h });
  const by = (f: (b: BlockDef) => boolean) => parts.filter((p) => f(p.block)).map(item);

  const groups: Record<LayerKey, Item[]> = {
    back: by((b) => b.mount === "back"),
    power: by((b) => b.mount === "internal" && b.category === "power"),
    logic: by((b) => b.mount === "internal" && b.category !== "power"),
    front: by((b) => b.mount === "front"),
  };
  const thick = (k: LayerKey) => Math.max(0, ...groups[k].map((i) => i.t));
  const pad = 2 * (wall + clearance);
  const placedLayers: Partial<Record<LayerKey, Placed[]>> = {};
  let minOuter: Layout["minOuter"];
  let outer: Layout["outer"];
  let fits: boolean;

  // Put power and logic boards side by side when that does not grow the footprint: a thinner device for free.
  const mergeInternal = () => {
    groups.logic = [...groups.logic, ...groups.power];
    groups.power = [];
  };
  const depthOf = () => {
    const live = ORDER.filter((k) => groups[k].length);
    return Math.max(6, live.reduce((s, k) => s + thick(k), 0) + LAYER_GAP * Math.max(0, live.length - 1));
  };

  if (shape === "round") {
    const radii = () => ORDER.map((k) => minRadius(groups[k]));
    if (groups.power.length && groups.logic.length && minRadius([...groups.logic, ...groups.power]) <= Math.max(...radii())) mergeInternal();
    const r = Math.max(8, ...radii());
    const dia = ceil(2 * r + pad);
    minOuter = { w: dia, h: dia, d: ceil(depthOf() + pad) };
    outer = design.auto ? { ...minOuter } : { w: design.width, h: design.width, d: design.depth };
    fits = outer.w >= minOuter.w && outer.d >= minOuter.d;
    const room = outer.w / 2 - wall - clearance;
    for (const k of ORDER) if (groups[k].length) placedLayers[k] = packCircle(groups[k], room) ?? packCircle(groups[k], minRadius(groups[k]))!;
  } else {
    // With a size the user chose, lay rows out to the width they gave, so a wide box gets wide rows.
    const roomW = design.auto ? undefined : design.width - pad;
    const roomH = design.height - pad;
    const fit = (items: Item[]) => {
      const natural = pack(items);
      if (roomW === undefined) return natural;
      const wide = pack(items, roomW);
      return wide.w <= roomW && wide.h <= roomH ? wide : natural;
    };
    const packed = Object.fromEntries(ORDER.map((k) => [k, fit(groups[k])])) as Record<LayerKey, Packed>;
    const merged = fit([...groups.logic, ...groups.power]);
    const capW = Math.max(...ORDER.map((k) => packed[k].w));
    const capH = Math.max(...ORDER.map((k) => packed[k].h));
    if (groups.power.length && groups.logic.length && merged.w <= capW && merged.h <= capH) {
      mergeInternal();
      packed.logic = merged;
      packed.power = pack([]);
    }
    const live = ORDER.filter((k) => groups[k].length);
    const innerW = Math.max(16, ...live.map((k) => packed[k].w));
    const innerH = Math.max(16, ...live.map((k) => packed[k].h));
    minOuter = { w: ceil(innerW + pad), h: ceil(innerH + pad), d: ceil(depthOf() + pad) };
    outer = design.auto ? { ...minOuter } : { w: design.width, h: design.height, d: design.depth };
    fits = outer.w >= minOuter.w && outer.h >= minOuter.h && outer.d >= minOuter.d;
    const halfW = outer.w / 2 - wall;
    for (const k of live) {
      const L = packed[k];
      const xo = L.hasPort ? halfW - clearance - L.w / 2 : 0;
      placedLayers[k] = L.items.map((it) => ({ ...it, x: it.x + xo }));
    }
  }

  const cavityD = outer.d - 2 * wall;
  const placements: Placement[] = [];
  const cutouts: PlacedCutout[] = [];

  // Stack layers from the rear wall forward; front parts are pinned to the front wall and back parts to the rear.
  let z = -cavityD / 2 + clearance;
  for (const k of ORDER) {
    const items = placedLayers[k];
    if (!items) continue;
    const t = thick(k);
    for (const it of items) {
      const pz = k === "front" ? cavityD / 2 - clearance - it.t / 2 : k === "back" ? -cavityD / 2 + clearance + it.t / 2 : z + t / 2;
      const pos: [number, number, number] = [it.x, it.y, pz];
      placements.push({ nodeId: it.nodeId, blockId: it.block.id, pos, size: [it.w, it.d, it.t], layer: k, ...(it.rotated ? { rotated: true } : {}) });
      if (it.block.cutout && (k === "front" || k === "back")) cutouts.push({ nodeId: it.nodeId, label: it.block.name, face: k, ...it.block.cutout, u: pos[0], v: pos[1] });
      if (it.block.port) cutouts.push({ nodeId: it.nodeId, label: `${it.block.name} USB-C`, face: "right", ...it.block.port, u: pos[2], v: pos[1] });
    }
    z += t + LAYER_GAP;
  }

  for (const p of parts) {
    const { w, d, h } = p.block.size;
    if (p.block.mount === "bottom_external") {
      const inserted = 14;
      placements.push({ nodeId: p.node.id, blockId: p.block.id, pos: [0, -outer.h / 2 - d / 2 + inserted, 0], size: [w, d, h], layer: "external" });
      if (p.block.cutout) cutouts.push({ nodeId: p.node.id, label: p.block.name, face: "bottom", ...p.block.cutout, u: 0, v: 0 });
    } else if (p.block.mount === "top_external") {
      placements.push({ nodeId: p.node.id, blockId: p.block.id, pos: [0, outer.h / 2 + h / 2, 0], size: [w, h, d], layer: "external" });
      if (p.block.cutout) cutouts.push({ nodeId: p.node.id, label: `${p.block.name} cable`, face: "top", ...p.block.cutout, u: 0, v: 0 });
    }
  }

  const solid = (w: number, h: number, d: number) => (shape === "round" ? Math.PI * (w / 2) ** 2 * d : w * h * d);
  const shellMm3 = solid(outer.w, outer.h, outer.d) - solid(Math.max(0, outer.w - 2 * wall), Math.max(0, outer.h - 2 * wall), Math.max(0, cavityD));
  const shellVolumeCm3 = Math.round(shellMm3 / 100) / 10;
  const density = (MATERIAL[design.material] ?? MATERIAL.PLA).density;
  const massG = Math.round(shellVolumeCm3 * density * 0.85 + parts.reduce((s, p) => s + p.block.massG, 0));
  const limit = Math.min(outer.w, outer.h, outer.d) / 2 - 0.5;

  return { shape, outer, minOuter, wall, radius: Math.min(shape === "round" ? Math.min(style.radius, 4) : style.radius, limit), clearance, placements, cutouts, fits, shellVolumeCm3, massG };
}

export function enclosureCostInr(l: Layout, material: Material): number {
  const m = MATERIAL[material] ?? MATERIAL.PLA;
  return Math.max(60, Math.round((l.shellVolumeCm3 * m.density * 0.85 * m.inrPerG + 35) / 5) * 5);
}
