"use client";

import { getBlock, type Layout, type PlacedCutout } from "@craftr/core";
import { useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";

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

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.max(0.1, Math.min(r, w / 2 - 0.05, h / 2 - 0.05));
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

function cutoutBrush(c: PlacedCutout, l: Layout, mat: THREE.Material) {
  const { w, h, d } = l.outer;
  const len = l.wall * 3 + 4;
  const side = c.face === "left" || c.face === "right";
  const cap = c.face === "top" || c.face === "bottom";
  let geo: THREE.BufferGeometry;
  if (c.shape === "circle") {
    geo = new THREE.CylinderGeometry(c.w / 2, c.w / 2, len, 28);
    if (side) geo.rotateZ(Math.PI / 2);
    else if (!cap) geo.rotateX(Math.PI / 2);
  } else {
    geo = side ? new THREE.BoxGeometry(len, c.h, c.w) : cap ? new THREE.BoxGeometry(c.w, len, c.h) : new THREE.BoxGeometry(c.w, c.h, len);
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

/** A disc lying in the XY plane, centred, with softened edges. */
function puck(r: number, depth: number, fillet: number) {
  const f = Math.max(0, Math.min(fillet, r - 0.5, depth / 2 - 0.1));
  const g = new THREE.ExtrudeGeometry(disc(r - f), { depth: depth - 2 * f, bevelEnabled: f > 0, bevelThickness: f, bevelSize: f, bevelSegments: 5, curveSegments: 48 });
  g.translate(0, 0, -(depth - 2 * f) / 2);
  return g;
}

/** Builds the printable shell from the compiled layout: hollow body, openings cut, split into body and lid. */
function buildShell(l: Layout, mat: THREE.Material) {
  const { w, h, d } = l.outer;
  const t = l.wall;
  const round = l.shape === "round";
  const ev = new Evaluator();
  ev.attributes = ["position", "normal"];
  const cw = Math.max(1, w - 2 * t);
  const ch = Math.max(1, h - 2 * t);
  const cd = Math.max(1, d - 2 * t);
  const outer = new Brush(round ? puck(w / 2, d, l.radius) : new RoundedBoxGeometry(w, h, d, 5, l.radius), mat);
  const cavity = new Brush(round ? puck(cw / 2, cd, 0) : new RoundedBoxGeometry(cw, ch, cd, 4, Math.max(0.4, Math.min(l.radius - t, cw / 2 - 0.1, ch / 2 - 0.1, cd / 2 - 0.1))), mat);
  outer.updateMatrixWorld();
  cavity.updateMatrixWorld();
  let shell = ev.evaluate(outer, cavity, SUBTRACTION);
  const cuts = l.cutouts.map((c) => cutoutBrush(c, l, mat));
  for (const c of cuts) shell = ev.evaluate(shell, c, SUBTRACTION);

  const slab = new Brush(new THREE.BoxGeometry(w + 10, h + 10, t + 10), mat);
  slab.position.z = d / 2 - t + (t + 10) / 2;
  slab.updateMatrixWorld();
  const body = ev.evaluate(shell, slab, SUBTRACTION);
  let lid = ev.evaluate(shell, slab, INTERSECTION);

  // A friction-fit lip so the lid seats in the body.
  const lw = cw - 2 * LIP_FIT;
  const lh = ch - 2 * LIP_FIT;
  if (lw > 8 && lh > 8 && cd > LIP_DEPTH + 1) {
    const ring = round ? disc(lw / 2) : roundedRect(lw, lh, Math.max(0.4, l.radius - t));
    ring.holes.push(round ? disc(lw / 2 - LIP_THICK) : roundedRect(lw - 2 * LIP_THICK, lh - 2 * LIP_THICK, Math.max(0.3, l.radius - t - LIP_THICK)));
    const lip = new Brush(new THREE.ExtrudeGeometry(ring, { depth: LIP_DEPTH + 0.2, bevelEnabled: false, curveSegments: round ? 48 : 6 }), mat);
    lip.position.z = d / 2 - t - LIP_DEPTH;
    lip.updateMatrixWorld();
    lid = ev.evaluate(lid, lip, ADDITION);
    for (const c of cuts) lid = ev.evaluate(lid, c, SUBTRACTION);
  }
  for (const b of [outer, cavity, slab, ...cuts]) b.geometry.dispose();
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

export function EnclosureViewer({ layout, color, mode = "solid", spin = false, interactive = true, className, ref }: { layout: Layout; color: string; mode?: ViewMode; spin?: boolean; interactive?: boolean; className?: string; ref?: React.Ref<ViewerHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; model: THREE.Group; movers: Movable[]; shell: THREE.MeshStandardMaterial | null; geos: { body: THREE.BufferGeometry; lid: THREE.BufferGeometry } | null; mode: ViewMode; dist: number; span: number } | null>(null);

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
      const keep = { pos: camera.position.clone(), aspect: camera.aspect, bg: scene.background, opacity: s.shell?.opacity ?? 1, size: renderer.getSize(new THREE.Vector2()), ratio: renderer.getPixelRatio(), places: s.movers.map((m) => m.obj.position.clone()) };
      // Assembled, opaque, from a fixed front three-quarter angle, so every picture is framed the same way.
      s.movers.forEach((m) => m.obj.position.copy(m.home));
      if (s.shell) s.shell.opacity = 1;
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
      if (s.shell) s.shell.opacity = keep.opacity;
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
    stage.current = { renderer, scene, camera, controls, model, movers: [], shell: null, geos: null, mode: "solid", dist: 200, span: 0 };

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
      if (s.shell) {
        s.shell.opacity += ((s.mode === "xray" ? 0.3 : 1) - s.shell.opacity) * 0.15;
        // A see-through shell must not write depth or draw its inner faces, or its own triangles show through.
        const clear = s.shell.opacity < 0.97;
        if (s.shell.depthWrite === clear) {
          s.shell.depthWrite = !clear;
          s.shell.side = clear ? THREE.FrontSide : THREE.DoubleSide;
          s.shell.needsUpdate = true;
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
  const sig = JSON.stringify([layout.shape, layout.outer, layout.wall, layout.radius, layout.cutouts, layout.placements, color]);
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
    const shellMat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, transparent: true, opacity: s.mode === "xray" ? 0.3 : 1, side: THREE.DoubleSide });
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
    add(new THREE.Mesh(geos.lid, shellMat), step * 5);

    const order = { back: 1, power: 2, logic: 3, front: 4, external: 0 } as const;
    const c = new THREE.Color(color);
    const lightShell = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.25;
    for (const p of layout.placements) {
      // Distance from the part's outward face to the outside of the wall it looks through.
      const reach = p.layer === "front" ? d / 2 - (p.pos[2] + p.size[2] / 2) : p.layer === "back" ? d / 2 + (p.pos[2] - p.size[2] / 2) : 0;
      const part = partObject(p.blockId, p.size, reach, lightShell);
      part.position.set(...p.pos);
      if (p.layer === "back") part.rotation.y = Math.PI;
      add(part, step * order[p.layer]);
    }

    const low = Math.min(-h / 2, ...layout.placements.map((p) => p.pos[1] - p.size[1] / 2));
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 2.4, Math.max(w, d) * 2.4), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = low - 0.5;
    model.add(shadow);

    s.span = step * 5;
    s.movers = movers;
    s.shell = shellMat;
    s.geos = geos;
    const radius = Math.hypot(w, h, d) / 2 + Math.max(0, -h / 2 - low) / 2;
    const dist = (radius / Math.sin((s.camera.fov * Math.PI) / 360)) * 1.12;
    const first = s.dist === 200 && s.camera.position.lengthSq() === 0;
    s.dist = dist;
    s.controls.target.set(0, (low + h / 2) / 2, s.controls.target.z);
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
