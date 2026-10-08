import { BLOCK_MAP, COLORS, DEFAULT_DESIGN, DEFAULT_SPEC, compile, deriveFeatures, getBlock, nodesFromBlocks, type DesignConfig, type ProductSpec, type ProjectNode } from "@craftr/core";
import { db, projects, type GenState } from "@craftr/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ProductDesign } from "./ai/claude";
import type { User } from "./auth";

export type Project = typeof projects.$inferSelect;
export const IDLE: GenState = { step: 0, error: null, startedAt: null, plan: [] };
export const DONE: GenState = { step: 6, error: null, startedAt: null, plan: [] };
export const DEFAULT_PLAN = ["Choose sensors, MCU, power, and connectivity modules", "Create a compact enclosure around the parts", "Read sensors, connect, and drive outputs", "Estimate prototype cost and source parts", "Finalize design files and manufacturing plan"];

export const bad = (message: string, status: 400 | 402 | 404 | 409 | 422 = 400): never => {
  throw new HTTPException(status, { message });
};

/**
 * Compiles a design. An automatic size follows the parts; a size the user chose is kept,
 * but grown where the parts no longer fit, so adding a block never leaves an unbuildable box.
 */
export function build(nodes: ProjectNode[], design: DesignConfig, spec: ProductSpec) {
  let compiled = compile({ nodes, design, spec });
  const { outer, minOuter } = compiled.layout;
  if (design.auto) return { design: { ...design, width: outer.w, height: outer.h, depth: outer.d }, compiled };
  if (compiled.layout.fits) return { design, compiled };
  const grown = { ...design, width: Math.max(design.width, minOuter.w), height: Math.max(design.height, minOuter.h), depth: Math.max(design.depth, minOuter.d) };
  compiled = compile({ nodes, design: grown, spec });
  return { design: grown, compiled };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Turns the model's choice into a buildable design, repairing the things the validator would reject. */
export function fromDesign(d: ProductDesign) {
  let ids = d.blocks.map((b) => b.block_id).filter((id) => BLOCK_MAP[id]);
  const mcus = ids.filter((id) => BLOCK_MAP[id].iface === "mcu");
  if (!mcus.length) ids.unshift("esp32_devkit");
  ids = ids.filter((id) => BLOCK_MAP[id].iface !== "mcu" || id === (mcus[0] ?? "esp32_devkit"));
  ids = ensurePower(ids);
  const nodes = nodesFromBlocks([...new Set(ids.filter((id) => BLOCK_MAP[id].iface === "mcu")), ...ids.filter((id) => BLOCK_MAP[id].iface !== "mcu")]);
  const spec: ProductSpec = { ...DEFAULT_SPEC, ...d.spec };
  const design: DesignConfig = { ...DEFAULT_DESIGN, shape: d.enclosure.shape, pocketCards: d.enclosure.shape === "card" ? Math.max(0, Math.min(3, Math.round(d.enclosure.pocket_cards))) : 0, style: d.enclosure.style, material: d.enclosure.material, color: HEX.test(d.enclosure.color) ? d.enclosure.color : COLORS[0], ...(HEX.test(d.enclosure.face_color) && d.enclosure.face_color !== d.enclosure.color ? { face: d.enclosure.face_color } : {}), ...(d.enclosure.stand && d.enclosure.shape === "box" ? { stand: true } : {}) };
  return { nodes, spec, features: d.features.length ? d.features.slice(0, 5) : deriveFeatures(nodes), ...build(nodes, design, spec) };
}

export function ensurePower(ids: string[]): string[] {
  const tags = (t: string, list = out) => list.some((id) => BLOCK_MAP[id]?.tags.includes(t));
  let out = [...ids];
  if (tags("wireless_charging")) {
    // The charging pad has its own magnets, runs from the power bank module and needs a cell worth charging from.
    out = out.filter((id) => id !== "magsafe_ring" && id !== "charger_tp4056");
    if (!tags("boost_5v")) out.push("powerbank_module");
    if (!tags("battery")) out.push("lipo_5000");
  }
  if (tags("battery") && !tags("charger") && !tags("onboard_charger")) out.push("charger_tp4056");
  return out;
}

export function cleanNodes(input: unknown): ProjectNode[] {
  if (!Array.isArray(input) || input.length > 24) bad("A design can hold at most 24 blocks.");
  const seen = new Set<string>();
  return (input as ProjectNode[]).map((n) => {
    if (typeof n?.id !== "string" || seen.has(n.id) || !getBlock(n.blockId)) bad(`Unknown block: ${n?.blockId}`);
    seen.add(n.id);
    return { id: n.id, blockId: n.blockId, x: Math.round(Number(n.x) || 0), y: Math.round(Number(n.y) || 0) };
  });
}

export async function ownProject(user: User, id: string): Promise<Project> {
  const [p] = await db().select().from(projects).where(user.role === "admin" ? eq(projects.id, id) : and(eq(projects.id, id), eq(projects.userId, user.id)));
  return p ?? bad("Project not found.", 404);
}
