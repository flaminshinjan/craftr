import { resolveNodes } from "./wiring";
import type { BlockDef, CardPocket, DesignConfig, EnclosureStyle, Finish, Layout, Material, PlacedCutout, Placement, ProjectNode } from "./types";

export const STYLE: Record<EnclosureStyle, { wall: number; radius: number; clearance: number; /** Extra room kept around the parts, which lets the corners be rounder. */ margin?: number; label: string; blurb: string }> = {
  slim: { wall: 1.6, radius: 9, clearance: 0.6, margin: 2.5, label: "Slim", blurb: "One thin layer, parts side by side" },
  minimal: { wall: 2, radius: 8, clearance: 1.2, label: "Minimal", blurb: "Soft corners, clean faces" },
  rugged: { wall: 3, radius: 4, clearance: 1.5, label: "Rugged", blurb: "Thick walls, survives drops" },
  compact: { wall: 1.6, radius: 5, clearance: 0.6, label: "Compact", blurb: "Smallest footprint, parts stacked" },
};

export const MATERIAL: Record<Material, { name: string; density: number; inrPerG: number; blurb: string; recycled: boolean }> = {
  rPLA: { name: "Recycled PLA", density: 1.24, inrPerG: 1.3, recycled: true, blurb: "Recycled plastic, crisp detail, indoor use. Can be reground into new filament." },
  rPETG: { name: "Recycled PETG", density: 1.27, inrPerG: 1.6, recycled: true, blurb: "Recycled plastic, strong and weather resistant. Can be reground into new filament." },
  PLA: { name: "PLA", density: 1.24, inrPerG: 1.2, recycled: false, blurb: "Plant-based, crisp detail, indoor use. Recyclable through filament recyclers." },
  PETG: { name: "PETG", density: 1.27, inrPerG: 1.5, recycled: false, blurb: "Strong, weather resistant. Recyclable through filament recyclers." },
  ABS: { name: "ABS", density: 1.04, inrPerG: 1.4, recycled: false, blurb: "Tough, handles heat. Rarely recycled." },
  PC: { name: "PC", density: 1.2, inrPerG: 2.4, recycled: false, blurb: "Very strong. Rarely recycled." },
};
/** What a new design can be printed in: recycled first, and nothing that cannot be recycled. */
export const MATERIAL_CHOICES: Material[] = ["rPLA", "rPETG", "PLA", "PETG"];

export const FINISH: Record<Finish, { label: string; blurb: string }> = {
  chalk: { label: "Chalk", blurb: "Dead matte and slightly powdery, like chalk. Hides layer lines. Printed in matte-grade filament." },
  smooth: { label: "Smooth", blurb: "The usual soft sheen of a clean print." },
};

export const COLORS = ["#F2EBDD", "#5FA052", "#D9B98E", "#C9C9C6", "#3F4043"];
export const MIN_WALL = 1.2;
/** Footprint of the card shape: it has to cover a bank card and sit inside a phone's back. */
export const CARD = { w: 66, h: 102 };
const BANK_CARD = { w: 54, h: 85.6, t: 0.8 };
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
/** A small part sitting in the middle of a ring, such as a button inside a ring of lights. */
const nested = (ring: Placed, in_: Placed) => !!ring.block.hole && Math.hypot(in_.w, in_.d) <= ring.block.hole - 1 && Math.hypot(ring.x - in_.x, ring.y - in_.y) < 0.5;
const clash = (a: Placed, b: Placed) => !nested(a, b) && !nested(b, a) && Math.abs(a.x - b.x) < (a.w + b.w) / 2 + GAP - 1e-6 && Math.abs(a.y - b.y) < (a.d + b.d) / 2 + GAP - 1e-6;

/**
 * Packs parts into a disc of radius r. Boards with a USB port go hard against the right-hand wall;
 * everything else takes the free spot nearest the centre, turned 90° when that helps.
 */
function packCircle(items: Item[], r: number, fixed: Placed[] = []): Placed[] | null {
  // Ports claim the wall first; then the things a person touches or looks at take the centre.
  const rank = (i: Item) => (i.block.port ? 0 : i.block.category === "input" || i.block.category === "display" ? 1 : 2);
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || b.w * b.d - a.w * a.d);
  // Parts already placed (the composed front face) stay where they are; the rest fill in around them.
  const placed: Placed[] = [...fixed];
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
function minRadius(items: Item[], fixed: Placed[] = []): number {
  if (!items.length && !fixed.length) return 0;
  const key = items.map((i) => `${i.block.id}:${i.w}x${i.d}`).sort().join("|") + "//" + fixed.map((i) => `${i.block.id}@${i.x},${i.y}`).join("|");
  const hit = radiusCache.get(key);
  if (hit !== undefined) return hit;
  const area = [...items, ...fixed].reduce((s, i) => s + (i.block.round ? (Math.PI * i.w * i.w) / 4 : i.w * i.d), 0);
  let r = Math.ceil(Math.max(Math.sqrt(area / Math.PI), ...items.map((i) => (i.block.round ? i.w / 2 : Math.hypot(i.w, i.d) / 2))));
  while (!(fixed.every((f) => inCircle(f, r)) && packCircle(items, r, fixed)) && r < 400) r++;
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
  const card = design.shape === "card";
  let pocket: CardPocket | null = null;
  const parts = resolveNodes(nodes);
  const item = (p: (typeof parts)[number]): Item => ({ nodeId: p.node.id, block: p.block, w: p.block.size.w, d: p.block.size.d, t: p.block.size.h - (p.block.protrude ?? 0) });
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

  // Slim lays every part in one plane, side by side, so the device is only as thick as its tallest part.
  // A card keeps its fixed footprint, so it cannot spread out and stays stacked.
  const flat = design.style === "slim" && !card;
  const gap = flat ? 1 : LAYER_GAP;
  // A magnet ring or other wafer-thin back part stays as a sheet underneath, rather than taking a place in the plane.
  const under = flat ? groups.back.filter((i) => i.t <= 2) : [];
  const base = under.length ? Math.max(...under.map((i) => i.t)) + gap : 0;
  const inPlane = flat ? [...groups.back.filter((i) => i.t > 2), ...groups.power, ...groups.logic, ...groups.front] : [];
  const layerOf = new Map<string, LayerKey>();
  if (flat) {
    for (const i of groups.back) layerOf.set(i.nodeId, "back");
    for (const i of groups.front) layerOf.set(i.nodeId, "front");
    groups.logic = [...groups.logic, ...groups.power];
    groups.power = [];
  }
  const split = (placed: Placed[]) => {
    for (const k of ["back", "logic", "front"] as const) {
      const mine = placed.filter((p) => (layerOf.get(p.nodeId) ?? "logic") === k);
      if (mine.length) placedLayers[k] = [...(placedLayers[k] ?? []), ...mine];
    }
  };

  // Put power and logic boards side by side when that does not grow the footprint: a thinner device for free.
  const mergeInternal = () => {
    groups.logic = [...groups.logic, ...groups.power];
    groups.power = [];
  };
  if (shape === "round" && flat) {
    // Compose the face first, centred, then let the boards fill the ring of space around it.
    const face = groups.front.length ? packCircle(groups.front, minRadius(groups.front))! : [];
    const rest = inPlane.filter((i) => layerOf.get(i.nodeId) !== "front");
    const r = Math.max(8, minRadius(rest, face), minRadius(under));
    const dia = ceil(2 * r + pad);
    minOuter = { w: dia, h: dia, d: 0 };
    outer = design.auto ? { ...minOuter } : { w: design.width, h: design.width, d: design.depth };
    fits = outer.w >= minOuter.w;
    const room = outer.w / 2 - wall - clearance;
    if (under.length) placedLayers.back = packCircle(under, room) ?? packCircle(under, minRadius(under))!;
    split(packCircle(rest, room, face) ?? packCircle(rest, minRadius(rest, face), face)!);
  } else if (shape === "round") {
    const radii = () => ORDER.map((k) => minRadius(groups[k]));
    if (groups.power.length && groups.logic.length && minRadius([...groups.logic, ...groups.power]) <= Math.max(...radii())) mergeInternal();
    const r = Math.max(8, ...radii());
    const dia = ceil(2 * r + pad);
    minOuter = { w: dia, h: dia, d: 0 };
    outer = design.auto ? { ...minOuter } : { w: design.width, h: design.width, d: design.depth };
    fits = outer.w >= minOuter.w;
    const room = outer.w / 2 - wall - clearance;
    for (const k of ORDER) if (groups[k].length) placedLayers[k] = packCircle(groups[k], room) ?? packCircle(groups[k], minRadius(groups[k]))!;
  } else {
    // With a size the user chose, lay rows out to the width they gave, so a wide box gets wide rows.
    const padXY = pad + 2 * (flat ? (style.margin ?? 0) : 0);
    const roomW = card ? CARD.w - pad : design.auto ? undefined : design.width - padXY;
    const roomH = card ? CARD.h - pad : design.height - padXY;
    // On a card, the small boards tuck in around the charging pad or magnet ring, leaving one thin layer for the battery.
    if (card && groups.back.length) {
      const isCell = (i: Item) => i.block.tags.includes("battery");
      const small = [...groups.logic, ...groups.power.filter((i) => !isCell(i))];
      const together = pack([...groups.back, ...small], roomW);
      if (small.length && together.w <= roomW! && together.h <= roomH) {
        groups.back = [...groups.back, ...small];
        groups.logic = [];
        groups.power = groups.power.filter(isCell);
      }
    }
    /**
     * Slim boxes are composed face first: the front parts sit together in the middle of the face,
     * and the boards go either side of them or in a band underneath, whichever comes out tighter.
     */
    const compose = (): Packed => {
      // A few front parts read best as one row across the face.
      const face = groups.front.length <= 3 ? pack(groups.front, groups.front.reduce((s, i) => s + i.w + GAP, 0)) : pack(groups.front);
      const rest = inPlane.filter((i) => layerOf.get(i.nodeId) !== "front");
      const done = (items: Placed[], w: number, h: number): Packed => ({ items, w, h, t: Math.max(0, ...items.map((i) => i.t)), hasPort: rest.some((i) => !!i.block.port) });
      if (!rest.length) return done(face.items, face.w, face.h);
      if (!face.items.length) return pack(rest);
      const shift = (p: Packed, dx: number, dy: number) => p.items.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy }));
      const column = (items: Item[]) => pack(items, Math.max(0, ...items.map((i) => i.w)));
      // Either side: boards with a port go right, to reach the wall; the others balance the two sides.
      const right = rest.filter((i) => i.block.port);
      const left: Item[] = [];
      const areaOf = (list: Item[]) => list.reduce((s, i) => s + i.w * i.d, 0);
      for (const i of rest.filter((x) => !x.block.port).sort((a, b) => b.w * b.d - a.w * a.d)) (areaOf(left) <= areaOf(right) ? left : right).push(i);
      const L = column(left);
      const R = column(right);
      const half = face.w / 2 + Math.max(L.items.length ? GAP + L.w : 0, R.items.length ? GAP + R.w : 0);
      const sides = done([...face.items, ...shift(L, -half + L.w / 2, 0), ...shift(R, half - R.w / 2, 0)], 2 * half, Math.max(face.h, L.h, R.h));
      // A wide flat slab reads as sleek; a tall thin one reads as a remote control.
      const score = (p: Packed) => p.w * p.h * (1 + 0.5 * Math.abs(Math.log(p.w / p.h))) * (p.h > p.w * 1.15 ? 1.3 : 1);
      // Underneath: the face group at the top, a band of boards below it. Try each band width and keep the best.
      let best = sides;
      const widest = Math.max(face.w, ...rest.map((i) => i.w));
      const total = Math.max(widest, rest.reduce((s, i) => s + i.w + GAP, 0));
      for (let bw = widest; bw <= total; bw += 2) {
        const band = pack(rest, bw);
        const w = Math.max(face.w, band.w);
        const h = face.h + GAP + band.h;
        const below = done([...shift(face, 0, h / 2 - face.h / 2), ...shift(band, band.hasPort ? w / 2 - band.w / 2 : 0, -h / 2 + band.h / 2)], w, h);
        if (score(below) < score(best) - 1e-6) best = below;
      }
      return best;
    };
    const fit = (items: Item[]) => {
      const natural = pack(items);
      if (roomW === undefined) return natural;
      const wide = pack(items, roomW);
      return wide.w <= roomW && wide.h <= roomH ? wide : natural;
    };
    const packed = Object.fromEntries(ORDER.map((k) => [k, fit(groups[k])])) as Record<LayerKey, Packed>;
    // Slim: one joint packing stands in for the logic layer when sizing; the parts are dealt back to their layers below.
    const joint = flat ? compose() : null;
    if (joint) {
      packed.back = fit(under);
      packed.power = pack([]);
      packed.logic = joint;
      packed.front = pack([]);
    }
    const merged = fit([...groups.logic, ...groups.power]);
    const capW = Math.max(...ORDER.map((k) => packed[k].w));
    const capH = Math.max(...ORDER.map((k) => packed[k].h));
    if (groups.power.length && groups.logic.length && merged.w <= capW && merged.h <= capH) {
      mergeInternal();
      packed.logic = merged;
      packed.power = pack([]);
    }
    const live = ORDER.filter((k) => (joint ? packed[k].items.length : groups[k].length));
    const innerW = Math.max(16, ...live.map((k) => packed[k].w));
    const innerH = Math.max(16, ...live.map((k) => packed[k].h));
    minOuter = { w: Math.max(ceil(innerW + padXY), card ? CARD.w : 0), h: Math.max(ceil(innerH + padXY), card ? CARD.h : 0), d: 0 };
    // A card keeps its footprint and is always as thin as the parts allow.
    outer = design.auto || card ? { ...minOuter } : { w: design.width, h: design.height, d: design.depth };
    fits = outer.w >= minOuter.w && outer.h >= minOuter.h;
    const halfW = outer.w / 2 - wall;
    // The card pocket covers the top of the front face, so anything front-mounted moves to a strip along the bottom.
    const cards = card ? Math.max(0, Math.min(3, Math.round(design.pocketCards ?? 0))) : 0;
    const strip = packed.front.items.length ? packed.front.h + 2 * clearance + 3 : 0;
    const pocketH = Math.min(BANK_CARD.h - 14, outer.h - strip - 6);
    if (cards && pocketH >= 45) pocket = { w: Math.min(outer.w - 4, BANK_CARD.w + 5), h: pocketH, y: outer.h / 2 - 3 - pocketH / 2, d: cards * BANK_CARD.t + 2.3, slot: cards * BANK_CARD.t + 0.7, cards };
    const frontDrop = pocket ? -(outer.h / 2 - wall - clearance) + packed.front.h / 2 : 0;
    if (joint) {
      if (under.length) placedLayers.back = packed.back.items;
      // The face stays centred; only the boards with a port slide out to meet the right-hand wall.
      split(joint.items.map((it) => (it.block.port ? { ...it, x: halfW - clearance - it.w / 2 } : it)));
    }
    for (const k of joint ? [] : live) {
      const L = packed[k];
      const xo = L.hasPort ? halfW - clearance - L.w / 2 : 0;
      // On a card the front parts live in a strip along the bottom, so everything else slides to the top
      // to leave that strip clear: the status light then sits beside the battery, not on it.
      const up = card && packed.front.items.length && k !== "front" ? Math.max(0, (roomH - L.h) / 2) : 0;
      placedLayers[k] = L.items.map((it) => ({ ...it, x: it.x + xo, y: it.y + (k === "front" ? frontDrop : up) }));
    }
  }

  // Depth: layers stack from the rear wall, but a front part only adds depth where it sits over something.
  // A status light beside the battery shares the battery's depth instead of adding a whole layer.
  {
    let top = 0;
    const solids: { it: Placed; top: number }[] = [];
    for (const k of ORDER) {
      const items = placedLayers[k];
      if (!items || k === "front") continue;
      if (flat) {
        // Everything rests on the rear wall, above the thin sheet of back parts if there is one.
        for (const it of items) solids.push({ it, top: it.t <= 2 && k === "back" ? it.t : base + it.t });
        continue;
      }
      const t = thick(k);
      for (const it of items) solids.push({ it, top: k === "back" ? it.t : top + t / 2 + it.t / 2 });
      top += t + gap;
    }
    if (flat) top = Math.max(0, ...solids.map((x) => x.top)) + gap;
    const over = (a: Placed, b: Placed) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 1 && Math.abs(a.y - b.y) < (a.d + b.d) / 2 + 1;
    const front = (placedLayers.front ?? []).map((f) => f.t + Math.max(0, ...solids.filter((s) => over(f, s.it)).map((s) => s.top + gap)));
    const need = ceil(Math.max(flat ? 4 : 6, top - gap, ...front) + pad);
    minOuter.d = need;
    if (design.auto || card) outer.d = need;
    fits = fits && outer.d >= need;
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
      const rear = -cavityD / 2 + clearance;
      const pz = k === "front" ? cavityD / 2 - clearance - it.t / 2 : k === "back" ? rear + (flat && it.t > 2 ? base : 0) + it.t / 2 : flat ? rear + base + it.t / 2 : z + t / 2;
      const pos: [number, number, number] = [it.x, it.y, pz];
      placements.push({ nodeId: it.nodeId, blockId: it.block.id, pos, size: [it.w, it.d, it.t], layer: k, ...(it.rotated ? { rotated: true } : {}) });
      if (it.block.cutout && (k === "front" || k === "back")) cutouts.push({ nodeId: it.nodeId, label: it.block.name, face: k, ...it.block.cutout, u: pos[0], v: pos[1] });
      if (it.block.port) cutouts.push({ nodeId: it.nodeId, label: `${it.block.name} USB-C`, face: "right", ...it.block.port, u: pos[2], v: pos[1] });
    }
    z += t + gap;
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
  const limit = (shape === "round" ? Math.min(outer.w, outer.d) : Math.min(outer.w, outer.h)) / 2 - 0.5;

  const stand = !!design.stand && shape === "box" && !card && !parts.some((x) => x.block.mount === "bottom_external");
  // Corners as round as the style wants, but never so round that the inside of a corner cuts into a part.
  let radius = Math.min(shape === "round" ? Math.min(style.radius, 4) : card ? 9 : design.style === "minimal" || design.style === "slim" ? Math.min(14, Math.max(style.radius, Math.min(outer.w, outer.h) * 0.2)) : style.radius, limit);
  let innerRadius = Math.max(0.6, radius - wall);
  if (shape === "box") {
    const round = new Set(parts.filter((x) => x.block.round).map((x) => x.node.id));
    const clears = (ri: number) => {
      const cx = outer.w / 2 - wall - ri;
      const cy = outer.h / 2 - wall - ri;
      return placements.every((p) => {
        if (p.layer === "external") return true;
        // A disc reaches a corner only along its diagonal.
        const reach = round.has(p.nodeId) ? Math.SQRT1_2 : 1;
        const dx = Math.abs(p.pos[0]) + (p.size[0] / 2) * reach - cx;
        const dy = Math.abs(p.pos[1]) + (p.size[1] / 2) * reach - cy;
        return dx <= 0 || dy <= 0 || Math.hypot(dx, dy) <= ri - 0.3;
      });
    };
    innerRadius = Math.round(innerRadius * 2) / 2;
    while (innerRadius > 1 && !clears(innerRadius)) innerRadius -= 0.5;
    // The outside may be rounder than the inside, as long as the wall stays at least 1 mm thick across the corner.
    radius = Math.round(Math.min(radius, innerRadius + (Math.SQRT2 * wall - 1.1) / (Math.SQRT2 - 1)) * 2) / 2;
  }
  return { shape, card, stand, pocket, outer, minOuter, wall, radius, innerRadius, clearance, placements, cutouts, fits, shellVolumeCm3, massG };
}

export function enclosureCostInr(l: Layout, material: Material): number {
  const m = MATERIAL[material] ?? MATERIAL.PLA;
  return Math.max(60, Math.round((l.shellVolumeCm3 * m.density * 0.85 * m.inrPerG + 35) / 5) * 5);
}
