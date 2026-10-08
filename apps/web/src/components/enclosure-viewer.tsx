"use client";

import { getBlock, type Layout, type PlacedCutout } from "@craftr/core";
import { useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ADDITION, Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export type ViewMode = "solid" | "xray" | "exploded";
export interface ViewerHandle {
  /** Binary STLs in millimetres, oriented for printing: body open side up, lid face down. */
  exportStl: () => { body: ArrayBuffer; lid: ArrayBuffer } | null;
  /** A PNG data URL of the assembled device from a fixed three-quarter angle, used as the reference for renders. */
  snapshot: (size?: number) => string | null;
}

const LIP_DEPTH = 3;
const LIP_THICK = 1;
const LIP_FIT = 0.2;
/** The front panel sits this far below the rim around it, which draws a fine shadow line. */
export const FACE_RECESS = 0.3;
const FACE_FIT = 0.15;

/** A rounded rectangle as a closed loop of points, counter-clockwise. With r at half the width it is a circle. */
function outline(w: number, h: number, r: number, seg = 12): THREE.Vector2[] {
  const rr = Math.max(0.05, Math.min(r, w / 2, h / 2));
  const pts: THREE.Vector2[] = [];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  corners.forEach(([sx, sy], i) => {
    // Sample between the tangent points, so two corners never share a point when the sides vanish.
    for (let k = 0; k < seg; k++) {
      const a = (i + (k + 0.5) / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(sx * (w / 2 - rr) + Math.cos(a) * rr, sy * (h / 2 - rr) + Math.sin(a) * rr));
    }
  });
  return pts;
}

/** A straight-sided solid with the given outline, from z0 to z1. */
function prism(pts: THREE.Vector2[], z0: number, z1: number, hole?: THREE.Vector2[]) {
  const shape = new THREE.Shape(pts);
  if (hole) shape.holes.push(new THREE.Path(hole));
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
  g.translate(0, 0, z0);
  return g;
}

/**
 * The outside of the body: the outline swept from back to front, with a soft rounded back edge
 * and a crisp little chamfer at the front. Each section is the outline pulled in by `inset`.
 */
function hull(w: number, h: number, r: number, d: number, back: number, front: number, seg: number) {
  const sections: { z: number; inset: number }[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    sections.push({ z: -d / 2 + back * (1 - Math.cos(a)), inset: back * (1 - Math.sin(a)) });
  }
  sections.push({ z: d / 2 - front, inset: 0 }, { z: d / 2, inset: front });
  const rings = sections.map((s) => outline(w - 2 * s.inset, h - 2 * s.inset, r - s.inset, seg));
  const n = rings[0].length;
  const pos: number[] = [];
  rings.forEach((ring, i) => ring.forEach((p) => pos.push(p.x, p.y, sections[i].z)));
  const idx: number[] = [];
  for (let s = 0; s < rings.length - 1; s++) {
    for (let i = 0; i < n; i++) {
      const a = s * n + i;
      const b = s * n + ((i + 1) % n);
      idx.push(a, b, a + n, b, b + n, a + n);
    }
  }
  const backC = pos.length / 3;
  pos.push(0, 0, -d / 2, 0, 0, d / 2);
  const last = (rings.length - 1) * n;
  for (let i = 0; i < n; i++) {
    idx.push(backC, (i + 1) % n, i);
    idx.push(backC + 1, last + i, last + ((i + 1) % n));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return toCreasedNormals(g, Math.PI / 5);
}

function cutoutBrush(c: PlacedCutout, l: Layout, mat: THREE.Material) {
  const { w, h, d } = l.outer;
  const len = l.wall * 3 + 4;
  const side = c.face === "left" || c.face === "right";
  const cap = c.face === "top" || c.face === "bottom";
  let geo: THREE.BufferGeometry;
  if (c.shape === "circle" && c.grille) {
    // A field of small holes on a hex grid instead of one big opening.
    const pitch = 2.6;
    const holes: THREE.BufferGeometry[] = [];
    for (let row = -8; row <= 8; row++) {
      for (let col = -8; col <= 8; col++) {
        const x = (col + (row % 2 ? 0.5 : 0)) * pitch;
        const y = row * pitch * 0.866;
        if (Math.hypot(x, y) > c.w / 2 - 0.7) continue;
        const hole = new THREE.CylinderGeometry(0.75, 0.75, len, 12);
        hole.translate(x, 0, -y);
        holes.push(hole);
      }
    }
    geo = mergeGeometries(holes)!;
    holes.forEach((g) => g.dispose());
    if (side) geo.rotateZ(Math.PI / 2);
    else if (!cap) geo.rotateX(Math.PI / 2);
  } else if (c.shape === "circle") {
    geo = new THREE.CylinderGeometry(c.w / 2, c.w / 2, len, 40);
    if (side) geo.rotateZ(Math.PI / 2);
    else if (!cap) geo.rotateX(Math.PI / 2);
  } else {
    // Rounded corners on every opening; a port in a side wall becomes a full stadium.
    const r = side ? Math.min(c.w, c.h) / 2 - 0.05 : Math.min(1.2, Math.min(c.w, c.h) / 2 - 0.05);
    // A board lies flat against the back, so a port in a side wall is tall and thin: its width runs up the wall.
    geo = prism(side ? outline(c.h, c.w, r, 6) : outline(c.w, c.h, r, 6), -len / 2, len / 2);
    if (side) geo.rotateY(Math.PI / 2);
    else if (cap) geo.rotateX(Math.PI / 2);
  }
  const b = new Brush(geo, mat);
  const t = l.wall / 2;
  if (c.face === "front") b.position.set(c.u, c.v, d / 2 - t);
  else if (c.face === "back") b.position.set(c.u, c.v, -d / 2 + t);
  else if (c.face === "right") b.position.set(w / 2 - t, c.v, c.u);
  else if (c.face === "left") b.position.set(-w / 2 + t, c.v, c.u);
  else if (c.face === "top") b.position.set(c.u, h / 2 - t, c.v);
  else b.position.set(c.u, -h / 2 + t, c.v);
  b.updateMatrixWorld();
  return b;
}

const disc = (r: number) => new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2, false);

/** The Craftr sunflower as flat pixel blocks, in units where the whole mark is LOGO.h tall and centred on the origin. */
const LOGO = { w: 3.5, h: 4.75, mid: -0.625 };
function logoShapes(u: number): THREE.Shape[] {
  const sq = (cx: number, cy: number, size: number) => new THREE.Shape([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector2((cx + (x * size) / 2) * u, (cy + (y * size) / 2 - LOGO.mid) * u)));
  const petals = [sq(0, 0, 0.9), sq(0, 1.25, 1), sq(0, -1.25, 1), sq(1.25, 0, 1), sq(-1.25, 0, 1), sq(0.95, 0.95, 0.8), sq(-0.95, 0.95, 0.8), sq(0.95, -0.95, 0.8), sq(-0.95, -0.95, 0.8)];
  // Stem and both leaves as one outline, so the blocks never overlap.
  const half: [number, number][] = [[0.2, -1.9], [0.2, -2.25], [0.8, -2.25], [0.8, -1.95], [1.6, -1.95], [1.6, -2.4], [1.2, -2.4], [1.2, -2.7], [0.2, -2.7], [0.2, -3]];
  const stem = [...half, ...half.map(([x, y]) => [-x, y] as [number, number]).reverse()];
  return [...petals, new THREE.Shape(stem.map(([x, y]) => new THREE.Vector2(x * u, (y - LOGO.mid) * u)))];
}

type Box2 = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box2, b: Box2, pad = 1.5) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;

/** Where the engraved logo goes on a face: the first free spot that clears every opening, or nowhere. */
function logoSpot(l: Layout, face: "front" | "back"): Box2 | null {
  const { w, h } = l.outer;
  const round = l.shape === "round";
  const small = Math.min(w, h);
  const tall = face === "front" ? Math.min(14, Math.max(8, small * 0.2)) : Math.min(22, Math.max(9, small * 0.3));
  const size = { w: (tall / LOGO.h) * LOGO.w, h: tall };
  const taken: Box2[] = l.cutouts.filter((c) => c.face === face).map((c) => ({ x: c.u, y: c.v, w: c.w, h: c.shape === "circle" ? c.w : c.h }));
  if (face === "front") {
    // Parts that shine or sense through the panel without an opening still need their patch of wall left alone.
    for (const p of l.placements) if (p.layer === "front" && !l.cutouts.some((c) => c.nodeId === p.nodeId)) taken.push({ x: p.pos[0], y: p.pos[1], w: p.size[0], h: p.size[1] });
    if (l.pocket) taken.push({ x: 0, y: l.pocket.y, w: l.pocket.w, h: l.pocket.h });
  }
  const edge = l.wall + 3;
  const dx = w / 2 - edge - size.w / 2;
  const dy = h / 2 - edge - size.h / 2;
  const spots: [number, number][] = face === "back" ? [[0, 0], [0, -dy], [0, dy]] : round ? [[0, -dy + 1], [0, dy - 1]] : [[0, -dy], [dx, -dy], [-dx, -dy], [0, dy], [dx, dy], [-dx, dy]];
  for (const [x, y] of spots) {
    const spot = { x, y, ...size };
    if (dx >= 0 && dy >= 0 && !taken.some((t) => overlaps(spot, t))) return spot;
  }
  return null;
}

/** A brush that sinks the logo into a face whose outside surface is at `z`. */
function logoBrush(spot: Box2, z: number, depth: number, mat: THREE.Material) {
  const g = new THREE.ExtrudeGeometry(logoShapes(spot.h / LOGO.h), { depth: depth * 2, bevelEnabled: false });
  g.translate(spot.x, spot.y, z - depth);
  const b = new Brush(g, mat);
  b.updateMatrixWorld();
  return b;
}

const POST_FIT = 0.15;
const POST_WALL = 0.8;
const LEDGE = 1.2;
const CLIP_RISE = 1.25;
/**
 * How far a clip may hook over a board. The post has to bend that far to let the board past, and a printed
 * post of this thickness can only bend so much before it marks or cracks (about 1.5% strain), which goes with
 * the square of its free height. Short posts therefore get a small hook, and very short ones get none.
 */
const clipReach = (free: number) => Math.min(0.4, ((2 / 3) * 0.015 * free * free) / POST_WALL);
const STAND_TILT = (12 * Math.PI) / 180;

/**
 * The printed features that hold parts: posts along the edges of each board in the body, which locate it,
 * support it on a ledge and clip over it, and low frames inside the front panel for the parts that mount there.
 * A post is left out only where it would run through another part.
 */
function fixtures(l: Layout) {
  const { w, h, d } = l.outer;
  const t = l.wall;
  const round = l.shape === "round";
  const floor = -d / 2 + t;
  const cap = d / 2 - t - LIP_DEPTH - 0.4;
  const inside = (x: number, y: number, slack: number) => (round ? Math.hypot(x, y) <= w / 2 - t + slack : Math.abs(x) <= w / 2 - t + slack && Math.abs(y) <= h / 2 - t + slack);
  const feet: THREE.BufferGeometry[] = [];
  const guides: THREE.BufferGeometry[] = [];
  const frames: THREE.BufferGeometry[] = [];
  const held = new Set<string>();
  const out = POST_FIT + POST_WALL;

  for (const p of l.placements) {
    const [sx, sy, sz] = p.size;
    const [px, py, pz] = p.pos;
    if (p.layer === "front") {
      // A shallow frame the part drops into, glued or held by its own leads.
      const fw = sx + 2 * 0.2;
      const fh = sy + 2 * 0.2;
      const reach = 0.2 + 0.7;
      if (!inside(px + Math.sign(px || 1) * (sx / 2 + reach), py + Math.sign(py || 1) * (sy / 2 + reach), -0.25)) continue;
      const g = prism(outline(fw + 1.4, fh + 1.4, 0.6, 3), d / 2 - t - Math.min(1.6, sz), d / 2 - t + 0.2, outline(fw, fh, 0.2, 3).reverse());
      g.translate(px, py, 0);
      frames.push(g);
      held.add(p.nodeId);
      continue;
    }
    if (p.layer === "external" || Math.min(sx, sy) < 5) continue;
    const bottom = pz - sz / 2;
    const top = pz + sz / 2;
    if (bottom > cap) continue;
    const isRound = !!getBlock(p.blockId)?.round;
    // Where posts may stand: two along each edge of a board, or four around a disc.
    type Spot = { x: number; y: number; nx: number; ny: number; axis: "x" | "y" | "r" };
    const spots: Spot[] = [];
    if (isRound) for (const a of [45, 135, 225, 315].map((g) => (g * Math.PI) / 180)) spots.push({ x: px + (Math.cos(a) * sx) / 2, y: py + (Math.sin(a) * sx) / 2, nx: Math.cos(a), ny: Math.sin(a), axis: "r" });
    else
      for (const f of [-0.3, 0.3, 0]) {
        for (const side of [-1, 1]) {
          spots.push({ x: px + (side * sx) / 2, y: py + f * sy, nx: side, ny: 0, axis: "x" });
          spots.push({ x: px + f * sx, y: py + (side * sy) / 2, nx: 0, ny: side, axis: "y" });
        }
      }
    const wide = Math.min(4, Math.max(2.2, Math.min(sx, sy) * 0.3));
    const free = (q: Spot, upTo: number) => {
      // The post's footprint: a little under the part's edge, and POST_WALL outside it.
      const cx = q.x + q.nx * (out - LEDGE) * 0.5;
      const cy = q.y + q.ny * (out - LEDGE) * 0.5;
      const hx = Math.abs(q.nx) * (out + LEDGE) * 0.5 + Math.abs(q.ny) * wide * 0.5 + 0.3;
      const hy = Math.abs(q.ny) * (out + LEDGE) * 0.5 + Math.abs(q.nx) * wide * 0.5 + 0.3;
      if (!inside(q.x + q.nx * out, q.y + q.ny * out, 0.5)) return false;
      return !l.placements.some((o) => o.nodeId !== p.nodeId && o.layer !== "external" && o.pos[2] - o.size[2] / 2 < upTo && Math.abs(o.pos[0] - cx) < o.size[0] / 2 + hx && Math.abs(o.pos[1] - cy) < o.size[1] / 2 + hy);
    };
    // The centre spot on an edge is only a fallback for when both outer ones are blocked.
    const taken = new Set<string>();
    const chosen = spots.filter((q, i) => {
      const key = `${q.nx},${q.ny}`;
      if (!isRound && i >= 8 && taken.has(key)) return false;
      if (!free(q, Math.min(top, cap))) return false;
      taken.add(key);
      return true;
    });
    // Clips go on one pair of opposite sides, so the board tilts in under one side and clicks past the other.
    const clipAxis = isRound ? "r" : chosen.some((q) => q.axis === "x" && q.nx > 0) && chosen.some((q) => q.axis === "x" && q.nx < 0) ? "x" : "y";
    for (const q of chosen) {
      const hook = clipReach(sz + 0.25);
      const clip = q.axis === clipAxis && hook >= 0.15 && top + CLIP_RISE <= cap && free(q, top + CLIP_RISE);
      const peak = clip ? top + CLIP_RISE : Math.min(top, cap);
      // Profiles are drawn in the plane of the post (outward distance, height) and swept along the edge.
      const sweep = (pts: [number, number][]) => {
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([n, z]) => new THREE.Vector2(n, z))), { depth: wide, bevelEnabled: false });
        g.translate(0, 0, -wide / 2);
        g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(q.nx, q.ny, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(q.ny, -q.nx, 0)).setPosition(q.x, q.y, 0));
        return g;
      };
      if (bottom - floor > 0.05) feet.push(sweep([[-LEDGE, floor], [out, floor], [out, bottom], [-LEDGE, bottom]]));
      if (peak - bottom > 1) {
        const wall: [number, number][] = [[POST_FIT, Math.max(floor, bottom - 0.2)], [out, Math.max(floor, bottom - 0.2)], [out, peak], [POST_FIT, peak]];
        // The clip: a small hook over the board's edge, flat underneath and sloped on top so the board slides past.
        guides.push(sweep(clip ? [...wall, [POST_FIT - hook, top + 0.25], [POST_FIT, top + 0.25]] : wall));
      }
      held.add(p.nodeId);
    }
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    if (!list.length) return null;
    const g = mergeGeometries(list)!;
    list.forEach((x) => x.dispose());
    return g;
  };
  return { feet: merge(feet), guides: merge(guides), frames: merge(frames), held };
}

/**
 * Builds the printable shell from the compiled layout. The body is a tub: back and side walls in one piece.
 * The front is a flat panel that drops into a rebate in the rim, so the only seam is a fine line on the face,
 * and the panel prints face-down for a clean surface.
 */
function buildShell(l: Layout, mat: THREE.Material) {
  const { w, h, d } = l.outer;
  const t = l.wall;
  const round = l.shape === "round";
  const seg = round ? 18 : 12;
  const ev = new Evaluator();
  ev.attributes = ["position", "normal"];
  const R = round ? w / 2 : l.radius;
  const brush = (g: THREE.BufferGeometry) => {
    const b = new Brush(g, mat);
    b.updateMatrixWorld();
    return b;
  };
  // The layout has already kept the corner radius small enough that parts clear the inside of it.
  const innerR = round ? R - t : (l.innerRadius ?? Math.max(0.6, R - t));
  const rim = Math.max(0.8, t * 0.45);
  const backEdge = Math.min(round ? l.radius : 3, d / 5, R * 0.6);
  const cavityLine = outline(w - 2 * t, h - 2 * t, innerR, seg);
  const seatLine = outline(w - 2 * rim, h - 2 * rim, R - rim, seg);

  const outer = brush(hull(w, h, R, d, backEdge, 0.4, seg));
  const cavity = brush(prism(cavityLine, -d / 2 + t, d / 2 + 1));
  const seat = brush(prism(seatLine, d / 2 - t, d / 2 + 1));
  let body = ev.evaluate(ev.evaluate(outer, cavity, SUBTRACTION), seat, SUBTRACTION);
  const fx = fixtures(l);
  const extra: Brush[] = [];
  for (const g of [fx.feet, fx.guides]) {
    if (!g) continue;
    const b = brush(g);
    body = ev.evaluate(body, b, ADDITION);
    extra.push(b);
  }
  if (l.stand) {
    // A wedge under the body, so it leans back on a desk with its face towards you.
    const zb = -d / 2 + backEdge + 0.5;
    const zf = d / 2 - 1.5;
    const drop = (zf - zb) * Math.tan(STAND_TILT);
    const wideFoot = Math.max(6, Math.min(10, w * 0.14));
    const reach = Math.max(wideFoot / 2, w / 2 - R - wideFoot / 2 - 1);
    for (const side of reach > wideFoot ? [-1, 1] : [0]) {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(zb, -h / 2 + 0.4), new THREE.Vector2(zf, -h / 2 + 0.4), new THREE.Vector2(zf, -h / 2 - drop), new THREE.Vector2(zb, -h / 2)]), { depth: wideFoot, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      g.translate(side * reach + wideFoot / 2, 0, 0);
      const foot = brush(g);
      body = ev.evaluate(body, foot, ADDITION);
      extra.push(foot);
    }
  }
  // A thumbnail notch in the rim at the bottom, to lift the panel out again.
  const notch = brush(prism(outline(7, rim + 2, 0.6, 3), d / 2 - 1.2, d / 2 + 1).translate(0, -h / 2 + (rim + 2) / 2 - 1, 0));
  body = ev.evaluate(body, notch, SUBTRACTION);
  extra.push(notch);
  const cuts = l.cutouts.map((c) => cutoutBrush(c, l, mat));
  for (const c of cuts) body = ev.evaluate(body, c, SUBTRACTION);

  const plate = brush(prism(outline(w - 2 * rim - 2 * FACE_FIT, h - 2 * rim - 2 * FACE_FIT, R - rim - FACE_FIT, seg), d / 2 - t, d / 2 - FACE_RECESS));
  let lid: Brush = plate;
  // A friction-fit lip so the panel seats in the body.
  const lw = w - 2 * t - 2 * LIP_FIT;
  const lh = h - 2 * t - 2 * LIP_FIT;
  if (lw > 8 && lh > 8 && d - 2 * t > LIP_DEPTH + 1) {
    const lip = brush(prism(outline(lw, lh, innerR - LIP_FIT, seg), d / 2 - t - LIP_DEPTH, d / 2 - t + 0.2, outline(lw - 2 * LIP_THICK, lh - 2 * LIP_THICK, Math.max(0.3, innerR - LIP_FIT - LIP_THICK), seg).reverse()));
    extra.push(lip);
    lid = ev.evaluate(lid, lip, ADDITION);
    // Crush ribs: thin ridges that stand 0.1 mm proud of the opening and squash on the first fit,
    // so the panel grips whether the printer runs a little tight or a little loose.
    const ribs: THREE.BufferGeometry[] = [];
    const rib = (x: number, y: number, turn: number) => {
      const g = new THREE.BoxGeometry(1, 0.5, LIP_DEPTH - 0.6);
      g.rotateZ(turn);
      g.translate(x, y, d / 2 - t - LIP_DEPTH / 2);
      ribs.push(g);
    };
    if (round) for (let i = 0; i < 6; i++) rib(Math.sin((i * Math.PI) / 3) * (lw / 2 + 0.05), -Math.cos((i * Math.PI) / 3) * (lw / 2 + 0.05), (i * Math.PI) / 3);
    else {
      const ax = Math.max(0, Math.min(lw * 0.25, lw / 2 - innerR - 1.5));
      const ay = Math.max(0, Math.min(lh * 0.25, lh / 2 - innerR - 1.5));
      for (const k of ax ? [-1, 1] : [0]) for (const side of [-1, 1]) rib(k * ax, side * (lh / 2 + 0.05), 0);
      for (const k of ay ? [-1, 1] : [0]) for (const side of [-1, 1]) rib(side * (lw / 2 + 0.05), k * ay, Math.PI / 2);
    }
    const ridge = brush(mergeGeometries(ribs)!);
    ribs.forEach((g) => g.dispose());
    lid = ev.evaluate(lid, ridge, ADDITION);
    extra.push(ridge);
  }
  if (fx.frames) {
    const b = brush(fx.frames);
    lid = ev.evaluate(lid, b, ADDITION);
    extra.push(b);
  }
  for (const c of cuts) lid = ev.evaluate(lid, c, SUBTRACTION);
  // The card pocket: a shallow sleeve on the outside of the front panel, open at the top, with a thumb notch.
  if (l.pocket) {
    const k = l.pocket;
    const place = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const b = new Brush(g, mat);
      b.position.set(x, y, z);
      b.updateMatrixWorld();
      return b;
    };
    const sleeve = place(new RoundedBoxGeometry(k.w, k.h, k.d + 1, 4, 1.6), 0, k.y, d / 2 + k.d / 2 - 0.5);
    const slot = place(new THREE.BoxGeometry(k.w - 3.2, k.h, k.slot), 0, k.y + 1.6, d / 2 + k.slot / 2 + 0.6);
    const notch = new Brush(new THREE.CylinderGeometry(9, 9, k.d + 4, 40), mat);
    notch.rotation.x = Math.PI / 2;
    notch.position.set(0, k.y + k.h / 2, d / 2 + k.d / 2 + 1.2);
    notch.updateMatrixWorld();
    lid = ev.evaluate(lid, sleeve, ADDITION);
    lid = ev.evaluate(lid, slot, SUBTRACTION);
    lid = ev.evaluate(lid, notch, SUBTRACTION);
    extra.push(sleeve, slot, notch);
  }
  // The Craftr mark, sunk into the back and into a free corner of the front panel.
  const deep = Math.min(0.5, t * 0.3);
  const onBack = logoSpot(l, "back");
  const onFront = logoSpot(l, "front");
  if (onBack) {
    const b = logoBrush(onBack, -d / 2, deep, mat);
    body = ev.evaluate(body, b, SUBTRACTION);
    extra.push(b);
  }
  if (onFront) {
    const b = logoBrush(onFront, d / 2 - FACE_RECESS, deep, mat);
    lid = ev.evaluate(lid, b, SUBTRACTION);
    extra.push(b);
  }
  for (const b of [outer, cavity, seat, plate, ...extra, ...cuts]) b.geometry.dispose();
  // The floor of each engraving, so the viewer can shade it the way a recess catches less light.
  const marks = [onBack && { spot: onBack, z: -d / 2 + deep - 0.03, back: true }, onFront && { spot: onFront, z: d / 2 - FACE_RECESS - deep + 0.03, back: false }].filter((m) => !!m);
  return { body: body.geometry, lid: lid.geometry, marks };
}

const std = (color: string, roughness = 0.6, metalness = 0.05, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const PCB: Record<string, string> = { mcu: "#1f2328", sensor: "#2e6b4a", power: "#27477a", connectivity: "#2b5c8a", display: "#1d3f73", audio: "#5a2d82", input: "#2a2d31", output: "#2a2d31", other: "#3a3f45" };

/**
 * Draws one part roughly as it really looks, in a frame where +Z points out of the enclosure.
 * `reach` is the distance from the part's top face to the outside of the wall it faces.
 */
function partObject(blockId: string, size: [number, number, number], reach: number, lightShell: boolean): THREE.Group {
  const b = getBlock(blockId);
  const [sx, sy, sz] = size;
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0.4) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, Math.min(r, w / 2 - 0.02, h / 2 - 0.02, d / 2 - 0.02))), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (r: number, len: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 32), m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const ring = (ro: number, ri: number, len: number, m: THREE.Material) => {
    const shape = disc(ro);
    shape.holes.push(disc(ri));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 48 }), m);
    mesh.position.z = -len / 2;
    g.add(mesh);
  };
  const top = sz / 2;
  const board = Math.min(1.6, sz * 0.5);
  const pcb = () => {
    box(sx, sy, board, std(PCB[b?.category ?? "other"] ?? PCB.other, 0.42, 0.1), 0, 0, -top + board / 2, 0.6);
    // Plated header holes at 2.54 mm pitch: both long edges on a controller, one on a breakout.
    const gold = std("#d4af55", 0.3, 0.9);
    const alongX = sx >= sy;
    const len = Math.max(sx, sy);
    const n = Math.max(2, Math.floor((len - 3) / 2.54));
    const rows = b?.iface === "mcu" ? [-1, 1] : [1];
    const holes: THREE.BufferGeometry[] = [];
    for (const side of rows) {
      for (let i = 0; i < n; i++) {
        const u = -((n - 1) * 2.54) / 2 + i * 2.54;
        const v = side * (Math.min(sx, sy) / 2 - 1.3);
        const ringGeo = new THREE.RingGeometry(0.35, 0.8, 12);
        ringGeo.translate(alongX ? u : v, alongX ? v : u, -top + board + 0.02);
        holes.push(ringGeo);
      }
    }
    g.add(new THREE.Mesh(mergeGeometries(holes)!, gold));
    holes.forEach((x) => x.dispose());
  };
  const metal = std("#c9cdd2", 0.3, 0.85);
  const dark = std("#191b1e", 0.5);
  const cap = std(lightShell ? "#3a3c40" : "#e9e3d6", 0.55);
  const id = b?.id ?? "";

  if (b?.tags.includes("battery")) {
    box(sx, sy, sz, std("#b9bec4", 0.35, 0.7), 0, 0, 0, 1.2);
    box(sx * 0.14, sy * 0.96, sz * 1.02, std("#e0a72e", 0.6), -sx / 2 + sx * 0.07, 0, 0, 0.3);
  } else if (id === "magsafe_ring") ring(sx / 2, sx / 2 - 5, sz, std("#8f959c", 0.4, 0.7));
  else if (id === "rgb_led") {
    ring(sx / 2, sx / 2 - 6, 1.2, std("#f4f4f2", 0.6));
    // The ring shines through the thin front wall; show that glow on the outside face.
    const glow = disc(sx / 2 - 0.5);
    glow.holes.push(disc(sx / 2 - 5.5));
    const halo = new THREE.Mesh(new THREE.ShapeGeometry(glow, 48), new THREE.MeshBasicMaterial({ color: "#ffc978", transparent: true, opacity: 0.75 }));
    halo.position.z = top + reach + 0.06;
    g.add(halo);
    for (let i = 0; i < 8; i++) box(3, 3, 1.4, std("#ffffff", 0.3, 0, { emissive: "#ffb347", emissiveIntensity: 0.9 }), Math.cos((i * Math.PI) / 4) * (sx / 2 - 3), Math.sin((i * Math.PI) / 4) * (sx / 2 - 3), 0.9, 0.2);
  } else if (id === "speaker_amp") {
    cyl(sx / 2, sz * 0.5, dark, 0, 0, top - sz * 0.25);
    cyl(sx * 0.3, sz * 0.5, metal, 0, 0, -top + sz * 0.25);
  } else if (id === "vibration_motor") cyl(sx / 2, sz, metal);
  else if (id === "buzzer") cyl(sx / 2, sz, dark);
  else if (id === "button") {
    box(sx * 0.85, sy * 0.85, sz * 0.6, dark, 0, 0, -top + sz * 0.3);
    cyl((b?.cutout?.w ?? 7) / 2 - 0.35, sz * 0.4 + reach + 1.2, cap, 0, 0, top - sz * 0.4 + (sz * 0.4 + reach + 1.2) / 2);
  } else if (id === "rotary_encoder") {
    box(sx, sy, sz, metal, 0, 0, 0);
    // The shaft passes out through the panel to the knob.
    cyl(3, reach + 4, metal, 0, 0, top + (reach + 4) / 2);
    cyl(8, 11, cap, 0, 0, top + reach + 6.5);
  } else if (id === "led") {
    cyl(1.5, sz + reach + 0.5, std("#7dea8a", 0.3, 0, { emissive: "#3fd457", emissiveIntensity: 1.1 }), 0, 0, (reach + 0.5) / 2);
  } else if (id === "pir") {
    box(sx, sy, sz * 0.5, std(PCB.sensor), 0, 0, -top + sz * 0.25);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.3, 24, 16), std("#f3f1ec", 0.35));
    dome.position.z = top + reach - 1.5;
    g.add(dome);
  } else if (b?.category === "display") {
    pcb();
    const c = b.cutout!;
    box(c.w + 2, c.h + 2, sz - board, dark, 0, 0, -top + board + (sz - board) / 2, 0.5);
    // The glass sits in the window, a hair below the outside face.
    box(c.w - 0.4, c.h - 0.4, reach - 0.2, new THREE.MeshPhysicalMaterial({ color: "#07090c", roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 0.6 }), 0, 0, top + (reach - 0.2) / 2, 0.3);
  } else if (id === "soil_moisture") {
    // A flat blade with a pointed tip, the way a capacitive soil probe is cut.
    const s = new THREE.Shape();
    s.moveTo(-sx / 2, sy / 2);
    s.lineTo(sx / 2, sy / 2);
    s.lineTo(sx / 2, -sy / 2 + sx * 0.7);
    s.lineTo(0, -sy / 2);
    s.lineTo(-sx / 2, -sy / 2 + sx * 0.7);
    s.closePath();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: sz, bevelEnabled: false }), std("#17191c", 0.5));
    blade.position.z = -sz / 2;
    g.add(blade);
  } else if (id === "solar_panel") {
    box(sx, sy, sz, std("#d8dadd", 0.4, 0.5), 0, 0, 0, 0.5);
    box(sx - 4, sy * 1.02, sz - 4, std("#16233f", 0.2, 0.3), 0, 0, 0, 0.2);
  } else if (b?.iface === "mcu") {
    pcb();
    box(sx * 0.36, sy * 0.62, Math.max(1, sz - board - 0.8), metal, -sx * 0.18, 0, -top + board + Math.max(1, sz - board - 0.8) / 2, 0.3);
    box(sx * 0.16, sy * 0.3, 1.2, dark, sx * 0.14, 0, -top + board + 0.6, 0.2);
  } else {
    pcb();
    box(Math.min(sx * 0.45, 8), Math.min(sy * 0.45, 8), Math.max(0.8, sz - board), id === "mic_inmp441" ? metal : dark, 0, 0, -top + board + Math.max(0.8, sz - board) / 2, 0.3);
  }
  // A USB-C socket at the edge that meets the wall.
  if (b?.port) box(7.4, 8.9, 3.2, metal, sx / 2 - 3.7 + 1.2, 0, -top + board + 1.6, 1.2);
  return g;
}

function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(70,50,20,0.28)");
  grad.addColorStop(1, "rgba(70,50,20,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

interface Movable {
  obj: THREE.Object3D;
  home: THREE.Vector3;
  away: THREE.Vector3;
}

export function EnclosureViewer({ layout, color, face, finish = "chalk", wires, mode = "solid", spin = false, interactive = true, className, ref }: { layout: Layout; color: string; face?: string; finish?: "chalk" | "smooth"; /** Connections to draw between parts, by node id. Shown in the x-ray and exploded views. */ wires?: { from: string; to: string; color: string; pins: { a: string; b: string }[] }[]; mode?: ViewMode; spin?: boolean; interactive?: boolean; className?: string; ref?: React.Ref<ViewerHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; key: THREE.DirectionalLight; model: THREE.Group; movers: Movable[]; shells: THREE.MeshStandardMaterial[]; wires: { mesh: THREE.Mesh; a: THREE.Object3D; b: THREE.Object3D; pa: THREE.Vector3; pb: THREE.Vector3; rise: number; key: string }[]; geos: { body: THREE.BufferGeometry; lid: THREE.BufferGeometry } | null; mode: ViewMode; dist: number; span: number } | null>(null);

  useImperativeHandle(ref, () => ({
    exportStl: () => {
      const g = stage.current?.geos;
      if (!g) return null;
      const out = (geo: THREE.BufferGeometry, flip: boolean) => {
        const copy = geo.clone();
        if (flip) copy.rotateX(Math.PI);
        copy.computeBoundingBox();
        copy.translate(0, 0, -copy.boundingBox!.min.z);
        const data = new STLExporter().parse(new THREE.Mesh(copy), { binary: true }) as DataView;
        copy.dispose();
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer;
      };
      return { body: out(g.body, false), lid: out(g.lid, true) };
    },
    snapshot: (size = 1024) => {
      const s = stage.current;
      if (!s?.geos) return null;
      const { renderer, scene, camera, controls } = s;
      const keep = { pos: camera.position.clone(), aspect: camera.aspect, bg: scene.background, opacity: s.shells[0]?.opacity ?? 1, size: renderer.getSize(new THREE.Vector2()), ratio: renderer.getPixelRatio(), places: s.movers.map((m) => m.obj.position.clone()) };
      // Assembled, opaque, from a fixed front three-quarter angle, so every picture is framed the same way.
      s.movers.forEach((m) => m.obj.position.copy(m.home));
      s.shells.forEach((m) => (m.opacity = 1));
      s.wires.forEach((x) => (x.mesh.visible = false));
      scene.background = new THREE.Color("#ece7df");
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      const target = new THREE.Vector3(0, controls.target.y, 0);
      camera.position.copy(target).add(new THREE.Vector3(0.6, 0.42, 1).normalize().multiplyScalar(s.dist * 1.05));
      camera.lookAt(target);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL("image/png");
      scene.background = keep.bg;
      s.shells.forEach((m) => (m.opacity = keep.opacity));
      s.movers.forEach((m, i) => m.obj.position.copy(keep.places[i]));
      renderer.setPixelRatio(keep.ratio);
      renderer.setSize(keep.size.x, keep.size.y, false);
      camera.aspect = keep.aspect;
      camera.updateProjectionMatrix();
      camera.position.copy(keep.pos);
      camera.lookAt(controls.target);
      return url;
    },
  }));

  // Renderer, camera and lights live for the life of the component.
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    // A soft studio: the room lights every surface and gives metal and glass something to reflect,
    // and one key light from the upper front casts the shadow that sits the object on the ground.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 0.55));
    const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
    key.position.set(140, 260, 240);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 7;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff1dc, 0.35);
    fill.position.set(-200, 60, -120);
    scene.add(fill);
    const model = new THREE.Group();
    scene.add(model);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enabled = interactive;
    controls.autoRotate = spin && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 1.2;
    stage.current = { renderer, scene, camera, controls, key, model, movers: [], shells: [], wires: [], geos: null, mode: "solid", dist: 200, span: 0 };

    const size = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = stage.current;
      if (!s || document.hidden) return;
      const exploded = s.mode === "exploded";
      for (const m of s.movers) m.obj.position.lerp(exploded ? m.away : m.home, 0.12);
      for (const m of s.shells) {
        m.opacity += ((s.mode === "xray" ? 0.3 : 1) - m.opacity) * 0.15;
        // A see-through shell must not write depth or draw its inner faces, or its own triangles show through.
        const clear = m.opacity < 0.97;
        if (m.depthWrite === clear) {
          m.depthWrite = !clear;
          m.side = clear ? THREE.FrontSide : THREE.DoubleSide;
          m.needsUpdate = true;
        }
      }
      // Wires follow their parts, and are redrawn only while something is moving.
      for (const wire of s.wires) {
        wire.mesh.visible = s.mode !== "solid";
        const key = `${wire.a.position.z.toFixed(2)}|${wire.b.position.z.toFixed(2)}`;
        if (!wire.mesh.visible || key === wire.key) continue;
        wire.key = key;
        // From one solder pad up off the board, across, and down onto the other pad.
        const from = wire.pa.clone().applyEuler(wire.a.rotation).add(wire.a.position);
        const to = wire.pb.clone().applyEuler(wire.b.rotation).add(wire.b.position);
        const up = new THREE.Vector3(0, 0, wire.rise);
        const path = [from, from.clone().add(up), from.clone().add(to).multiplyScalar(0.5).add(up).add(new THREE.Vector3(0, 0, 1.5)), to.clone().add(up), to];
        wire.mesh.geometry.dispose();
        wire.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, false, "catmullrom", 0.4), 28, 0.32, 6);
      }
      s.controls.target.z += ((exploded ? s.span / 2 : 0) - s.controls.target.z) * 0.12;
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      stage.current = null;
    };
  }, [interactive, spin]);

  // Rebuild the model whenever the design changes.
  const sig = JSON.stringify([layout.shape, layout.stand, layout.pocket, layout.outer, layout.wall, layout.radius, layout.cutouts, layout.placements, color, face, finish, wires]);
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    const { model } = s;
    for (const child of [...model.children]) {
      model.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose());
      });
    }
    const { w, h, d } = layout.outer;
    // Chalk scatters light evenly and looks a touch paler; smooth keeps a soft highlight.
    const chalk = finish === "chalk";
    const paler = (tint: string) => {
      const c = new THREE.Color(tint);
      // Dark colours stay dark: a chalk black is still black, only flatter.
      return c.lerp(new THREE.Color("#ffffff"), 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.25 ? 0.06 : 0.012);
    };
    const skin = (tint: string) => new THREE.MeshStandardMaterial({ color: chalk ? paler(tint) : tint, roughness: chalk ? 1 : 0.5, metalness: chalk ? 0 : 0.03, transparent: true, opacity: s.mode === "xray" ? 0.3 : 1, side: THREE.DoubleSide });
    const shellMat = skin(color);
    const faceMat = skin(face || color);
    let geos: ReturnType<typeof buildShell>;
    try {
      geos = buildShell(layout, shellMat);
    } catch (e) {
      // CSG can fail on degenerate sizes; show the plain box rather than nothing.
      console.error("enclosure build failed", e);
      geos = { body: new RoundedBoxGeometry(w, h, d, 4, layout.radius), lid: new THREE.BufferGeometry(), marks: [] };
    }
    const step = Math.min(d * 0.4 + 10, 22);
    const movers: Movable[] = [];
    // Everything that is the device hangs off one group, so a stand can lean the whole thing back.
    const rig = new THREE.Group();
    if (layout.stand) rig.rotation.x = -STAND_TILT;
    model.add(rig);
    const add = (obj: THREE.Object3D, offsetZ: number) => {
      rig.add(obj);
      movers.push({ obj, home: obj.position.clone(), away: obj.position.clone().add(new THREE.Vector3(0, 0, offsetZ)) });
      if (s.mode === "exploded") obj.position.z += offsetZ;
    };
    const bodyMesh = new THREE.Mesh(geos.body, shellMat);
    const lidMesh = new THREE.Mesh(geos.lid, faceMat);
    for (const m of geos.marks) {
      // Dark plastic shows an engraving as a lighter, duller patch; light plastic shows it as a shadow.
      const tint = new THREE.Color(m.back ? color : face || color);
      const dark = 0.2126 * tint.r + 0.7152 * tint.g + 0.0722 * tint.b < 0.25;
      tint.lerp(new THREE.Color(dark ? "#ffffff" : "#000000"), dark ? 0.16 : 0.3);
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(logoShapes(m.spot.h / LOGO.h)), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, side: THREE.DoubleSide }));
      fill.position.set(m.spot.x, m.spot.y, m.z);
      (m.back ? bodyMesh : lidMesh).add(fill);
    }
    add(bodyMesh, 0);
    add(lidMesh, step * 5);

    const order = { back: 1, power: 2, logic: 3, front: 4, external: 0 } as const;
    const c = new THREE.Color(face || color);
    const lightShell = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.25;
    const byNode = new Map<string, THREE.Object3D>();
    for (const p of layout.placements) {
      // Distance from the part's outward face to the outside of the wall it looks through.
      const reach = p.layer === "front" ? d / 2 - FACE_RECESS - (p.pos[2] + p.size[2] / 2) : p.layer === "back" ? d / 2 + (p.pos[2] - p.size[2] / 2) : 0;
      const part = partObject(p.blockId, p.size, reach, lightShell);
      part.position.set(...p.pos);
      if (p.layer === "back") part.rotation.y = Math.PI;
      add(part, step * order[p.layer]);
      byNode.set(p.nodeId, part);
    }
    // One wire per pin, from a solder pad on one part to a pad on the other.
    const sizes = new Map(layout.placements.map((p) => [p.nodeId, p] as const));
    // Pads sit where each kind of board really has its connections, on the usual 2.54 mm header pitch:
    // a controller has a row down each long side, a breakout has one row along a long edge,
    // and a battery has two leads coming off one end.
    const PITCH = 2.54;
    const seen = new Map<string, string[]>();
    const pad = (nodeId: string, pin: string) => {
      const p = sizes.get(nodeId)!;
      const block = getBlock(p.blockId);
      const [sx, sy, sz] = p.size;
      const known = block?.pins.map((x) => x.name) ?? [];
      // Controller pins that are not in the short pin list (most GPIOs) take the next free place in order of use.
      const extra = seen.get(nodeId) ?? [];
      if (!known.includes(pin) && !extra.includes(pin)) seen.set(nodeId, [...extra, pin]);
      const all = [...known, ...(seen.get(nodeId) ?? [])];
      const i = all.indexOf(pin);
      const long = sx >= sy ? "x" : "y";
      const along = Math.max(sx, sy);
      const across = Math.min(sx, sy);
      const z = -sz / 2 + Math.min(1.6, sz * 0.5) + 0.15;
      let u = 0;
      let v = 0;
      if (block?.tags.includes("battery")) {
        u = -along / 2 + 1;
        v = (i - 0.5) * 3;
      } else if (block?.iface === "mcu") {
        // Two rows: even pins down one side, odd pins down the other.
        const perRow = Math.max(1, Math.floor((along - 3) / PITCH));
        const k = Math.floor(i / 2) % perRow;
        u = -((Math.min(perRow, Math.ceil(all.length / 2)) - 1) * PITCH) / 2 + k * PITCH;
        v = (i % 2 ? -1 : 1) * (across / 2 - 1.3);
      } else {
        const fit = Math.max(1, Math.floor((along - 2) / PITCH));
        const step = all.length > fit ? (along - 3) / Math.max(1, all.length - 1) : PITCH;
        u = -((all.length - 1) * step) / 2 + i * step;
        v = across / 2 - 1.3;
      }
      const at = long === "x" ? new THREE.Vector3(u, v, z) : new THREE.Vector3(v, u, z);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 12).rotateX(Math.PI / 2), std("#d8b24a", 0.35, 0.8));
      dot.position.copy(at);
      byNode.get(nodeId)!.add(dot);
      return at;
    };
    const HOT = /^(3V3|5V|VCC|VIN|BAT\+|OUT\+|IN\+|VBUS)$/i;
    const GROUND = /^(GND|BAT-|OUT-|IN-)$/i;
    let count = 0;
    s.wires = (wires ?? []).flatMap((e) => {
      const a = byNode.get(e.from);
      const b = byNode.get(e.to);
      if (!a || !b) return [];
      return e.pins.map((x) => {
        const tint = GROUND.test(x.a) || GROUND.test(x.b) ? "#26282b" : HOT.test(x.a) || HOT.test(x.b) ? "#d9534f" : e.color;
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), std(tint, 0.5));
        rig.add(mesh);
        return { mesh, a, b, pa: pad(e.from, x.a), pb: pad(e.to, x.b), rise: 2.5 + (count++ % 4) * 0.8, key: "" };
      });
    });

    // Two cards in the pocket, so it reads as a wallet. They are props, not part of the print.
    if (layout.pocket) {
      const k = layout.pocket;
      const cards = new THREE.Group();
      ["#d9dde3", "#2e5fa8", "#c9a24a"].slice(0, k.cards).forEach((tint, i) => {
        const cardMesh = new THREE.Mesh(new RoundedBoxGeometry(54, 85.6, 0.76, 2, 0.3), std(tint, 0.45, 0.1));
        cardMesh.position.set(0, k.y - k.h / 2 + 1.6 + 85.6 / 2 + i * 3, d / 2 + 0.6 + 0.4 + i * 0.8);
        cards.add(cardMesh);
      });
      add(cards, step * 6.4);
    }

    const low = layout.stand ? -(h / 2) * Math.cos(STAND_TILT) - (d / 2) * Math.sin(STAND_TILT) : Math.min(-h / 2, ...layout.placements.map((p) => p.pos[1] - p.size[1] / 2));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 2.4, Math.max(w, d) * 2.4), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = low - 0.5;
    model.add(shadow);
    // The cast shadow lands on an invisible floor; the soft blob under it keeps the contact dark.
    const floorSize = Math.max(w, h, d) * 6;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = low - 0.4;
    ground.receiveShadow = true;
    model.add(ground);
    rig.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const reachOut = Math.max(w, h, d) * 2.2;
    const cam = s.key.shadow.camera;
    cam.left = cam.bottom = -reachOut;
    cam.right = cam.top = reachOut;
    cam.near = 1;
    cam.far = 1500;
    cam.updateProjectionMatrix();

    s.span = step * 5;
    s.movers = movers;
    s.shells = [shellMat, faceMat];
    s.geos = geos;
    // Cards stand above the body, so the frame has to make room for them.
    const high = layout.pocket ? layout.pocket.y - layout.pocket.h / 2 + 1.6 + 85.6 + 6 : h / 2;
    const radius = Math.hypot(w, high - low, d) / 2;
    const dist = (radius / Math.sin((s.camera.fov * Math.PI) / 360)) * 1.12;
    const first = s.dist === 200 && s.camera.position.lengthSq() === 0;
    s.dist = dist;
    s.controls.target.set(0, (low + high) / 2, s.controls.target.z);
    s.controls.minDistance = dist * 0.5;
    s.controls.maxDistance = dist * 3.5;
    if (first) s.camera.position.set(0.72, 0.5, 1).normalize().multiplyScalar(dist * (s.mode === "exploded" ? 1.75 : 1));
    else s.camera.position.setLength(Math.min(Math.max(s.camera.position.length(), s.controls.minDistance), s.controls.maxDistance));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Mode changes animate; the camera backs off to keep the exploded stack in frame.
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    const was = s.mode;
    s.mode = mode;
    if ((was === "exploded") !== (mode === "exploded")) s.camera.position.setLength(Math.min(s.dist * (mode === "exploded" ? 1.75 : 1), s.controls.maxDistance));
  }, [mode]);

  return <div ref={host} className={className} role="img" aria-label={`3D model of the enclosure, ${layout.outer.w} by ${layout.outer.h} by ${layout.outer.d} millimetres`} />;
}
