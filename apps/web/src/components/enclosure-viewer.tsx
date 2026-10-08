"use client";

import { getBlock, type Layout, type PlacedCutout } from "@craftr/core";
import { useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  // Keep the inside corners tight enough that a board placed in a corner still clears them.
  const innerR = round ? R - t : Math.max(0.6, Math.min(R - t, l.clearance * 3.4));
  const rim = Math.max(0.8, t * 0.45);
  const backEdge = Math.min(round ? l.radius : 3, d / 5, R * 0.6);
  const cavityLine = outline(w - 2 * t, h - 2 * t, innerR, seg);
  const seatLine = outline(w - 2 * rim, h - 2 * rim, R - rim, seg);

  const outer = brush(hull(w, h, R, d, backEdge, 0.4, seg));
  const cavity = brush(prism(cavityLine, -d / 2 + t, d / 2 + 1));
  const seat = brush(prism(seatLine, d / 2 - t, d / 2 + 1));
  let body = ev.evaluate(ev.evaluate(outer, cavity, SUBTRACTION), seat, SUBTRACTION);
  const cuts = l.cutouts.map((c) => cutoutBrush(c, l, mat));
  for (const c of cuts) body = ev.evaluate(body, c, SUBTRACTION);

  const plate = brush(prism(outline(w - 2 * rim - 2 * FACE_FIT, h - 2 * rim - 2 * FACE_FIT, R - rim - FACE_FIT, seg), d / 2 - t, d / 2 - FACE_RECESS));
  let lid: Brush = plate;
  // A friction-fit lip so the panel seats in the body.
  const lw = w - 2 * t - 2 * LIP_FIT;
  const lh = h - 2 * t - 2 * LIP_FIT;
  const extra: Brush[] = [];
  if (lw > 8 && lh > 8 && d - 2 * t > LIP_DEPTH + 1) {
    const lip = brush(prism(outline(lw, lh, innerR - LIP_FIT, seg), d / 2 - t - LIP_DEPTH, d / 2 - t + 0.2, outline(lw - 2 * LIP_THICK, lh - 2 * LIP_THICK, Math.max(0.3, innerR - LIP_FIT - LIP_THICK), seg).reverse()));
    extra.push(lip);
    lid = ev.evaluate(lid, lip, ADDITION);
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
  for (const b of [outer, cavity, seat, plate, ...extra, ...cuts]) b.geometry.dispose();
  return { body: body.geometry, lid: lid.geometry };
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
  const pcb = () => box(sx, sy, board, std(PCB[b?.category ?? "other"] ?? PCB.other, 0.55), 0, 0, -top + board / 2, 0.6);
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
    box(sx, sy, 7, metal, 0, 0, -top + 3.5);
    cyl(3, sz - 7, metal, 0, 0, -top + 7 + (sz - 7) / 2);
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
    box(c.w - 0.4, c.h - 0.4, reach - 0.2, std("#0b0d10", 0.08, 0.4), 0, 0, top + (reach - 0.2) / 2, 0.3);
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

export function EnclosureViewer({ layout, color, face, mode = "solid", spin = false, interactive = true, className, ref }: { layout: Layout; color: string; face?: string; mode?: ViewMode; spin?: boolean; interactive?: boolean; className?: string; ref?: React.Ref<ViewerHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; model: THREE.Group; movers: Movable[]; shells: THREE.MeshStandardMaterial[]; geos: { body: THREE.BufferGeometry; lid: THREE.BufferGeometry } | null; mode: ViewMode; dist: number; span: number } | null>(null);

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
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(120, 220, 260);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff1dc, 0.7);
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
    stage.current = { renderer, scene, camera, controls, model, movers: [], shells: [], geos: null, mode: "solid", dist: 200, span: 0 };

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
  const sig = JSON.stringify([layout.shape, layout.pocket, layout.outer, layout.wall, layout.radius, layout.cutouts, layout.placements, color, face]);
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
    const skin = (tint: string) => new THREE.MeshStandardMaterial({ color: tint, roughness: 0.62, metalness: 0.02, transparent: true, opacity: s.mode === "xray" ? 0.3 : 1, side: THREE.DoubleSide });
    const shellMat = skin(color);
    const faceMat = skin(face || color);
    let geos: { body: THREE.BufferGeometry; lid: THREE.BufferGeometry };
    try {
      geos = buildShell(layout, shellMat);
    } catch (e) {
      // CSG can fail on degenerate sizes; show the plain box rather than nothing.
      console.error("enclosure build failed", e);
      geos = { body: new RoundedBoxGeometry(w, h, d, 4, layout.radius), lid: new THREE.BufferGeometry() };
    }
    const step = d * 0.4 + 10;
    const movers: Movable[] = [];
    const add = (obj: THREE.Object3D, offsetZ: number) => {
      model.add(obj);
      movers.push({ obj, home: obj.position.clone(), away: obj.position.clone().add(new THREE.Vector3(0, 0, offsetZ)) });
      if (s.mode === "exploded") obj.position.z += offsetZ;
    };
    add(new THREE.Mesh(geos.body, shellMat), 0);
    add(new THREE.Mesh(geos.lid, faceMat), step * 5);

    const order = { back: 1, power: 2, logic: 3, front: 4, external: 0 } as const;
    const c = new THREE.Color(face || color);
    const lightShell = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.25;
    for (const p of layout.placements) {
      // Distance from the part's outward face to the outside of the wall it looks through.
      const reach = p.layer === "front" ? d / 2 - FACE_RECESS - (p.pos[2] + p.size[2] / 2) : p.layer === "back" ? d / 2 + (p.pos[2] - p.size[2] / 2) : 0;
      const part = partObject(p.blockId, p.size, reach, lightShell);
      part.position.set(...p.pos);
      if (p.layer === "back") part.rotation.y = Math.PI;
      add(part, step * order[p.layer]);
    }

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

    const low = Math.min(-h / 2, ...layout.placements.map((p) => p.pos[1] - p.size[1] / 2));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 2.4, Math.max(w, d) * 2.4), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = low - 0.5;
    model.add(shadow);

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
