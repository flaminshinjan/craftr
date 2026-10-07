import { COLORS, DEFAULT_DESIGN, DEFAULT_SPEC, MATERIAL, STYLE, TEMPLATES, arrange, composeFirmware, deriveFeatures, getBlock, nextNodeId, type DesignConfig, type ProjectNode } from "@craftr/core";
import { assets, db, messages, projects, type GenState, type Variant } from "@craftr/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { designByKeywords, designProduct, editProduct, hasClaude, writeFirmware } from "../ai/claude";
import { decodeReference, hasImages, renderPreview } from "../ai/images";
import { requireUser, type AppEnv } from "../auth";
import { charge } from "../billing";
import { DEFAULT_PLAN, DONE, bad, build, cleanNodes, ensurePower, fromDesign, ownProject, type Project } from "../lib";

export const projectRoutes = new Hono<AppEnv>().use(requireUser);

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const setGen = (id: string, gen: GenState, extra: Partial<typeof projects.$inferInsert> = {}) => db().update(projects).set({ gen, ...extra, updatedAt: new Date() }).where(eq(projects.id, id));
const say = (projectId: string, role: "user" | "assistant", content: string, changes: string[] = []) => db().insert(messages).values({ id: nanoid(12), projectId, role, content, changes });

projectRoutes.get("/", async (c) => {
  const rows = await db()
    .select({ id: projects.id, name: projects.name, description: projects.description, previewAssetId: projects.previewAssetId, design: projects.design, compiled: projects.compiled, gen: projects.gen, origin: projects.origin, updatedAt: projects.updatedAt })
    .from(projects)
    .where(eq(projects.userId, c.get("user").id))
    .orderBy(desc(projects.updatedAt));
  return c.json(rows.map(({ compiled, ...r }) => ({ ...r, unitInr: compiled.pricing.unitInr, outer: compiled.layout.outer, blockCount: compiled.bom.filter((b) => b.blockId).length })));
});

projectRoutes.post("/", async (c) => {
  const body = await c.req.json<{ prompt?: string; templateId?: string; blank?: boolean }>();
  const user = c.get("user");
  const id = nanoid(10);

  if (body.templateId) {
    const t = TEMPLATES.find((x) => x.id === body.templateId) ?? bad("Unknown template.", 404);
    const b = build(t.nodes, t.design, t.spec);
    // Every remix of a proven build starts with the same look, so its render is made once and shared.
    const [cached] = await db().select({ id: assets.id }).from(assets).where(and(eq(assets.kind, "preview"), eq(assets.ref, `template:${t.id}`))).orderBy(desc(assets.createdAt)).limit(1);
    await db().insert(projects).values({ id, userId: user.id, name: t.name, prompt: t.prompt, description: t.description, origin: "template", features: t.features, spec: t.spec, nodes: t.nodes, ...b, firmware: composeFirmware(t), gen: { ...DONE, plan: DEFAULT_PLAN }, previewAssetId: cached?.id ?? null });
    await say(id, "user", t.prompt);
    await say(id, "assistant", `Here's the ${t.name}, a proven build. Remix it however you like: ask me to change something, or open Build with Blocks.`);
    return c.json({ id });
  }

  if (body.blank) {
    const nodes: ProjectNode[] = [{ id: "n1", blockId: "esp32_devkit", x: 0, y: 0 }];
    const b = build(nodes, DEFAULT_DESIGN, DEFAULT_SPEC);
    await db().insert(projects).values({ id, userId: user.id, name: "Untitled build", origin: "blocks", description: "Built block by block.", spec: DEFAULT_SPEC, nodes, ...b, firmware: composeFirmware({ name: "Untitled build", description: "", nodes, spec: DEFAULT_SPEC }), gen: { ...DONE, plan: DEFAULT_PLAN } });
    return c.json({ id });
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 3) bad("Describe what you want to build.");
  if (prompt.length > 2000) bad("Keep the description under 2000 characters.");
  const b = build([], DEFAULT_DESIGN, DEFAULT_SPEC);
  await db().insert(projects).values({ id, userId: user.id, name: prompt.length > 48 ? `${prompt.slice(0, 45)}…` : prompt, prompt, origin: "prompt", spec: DEFAULT_SPEC, nodes: [], ...b, gen: { step: 1, error: null, startedAt: null, plan: DEFAULT_PLAN } });
  await say(id, "user", prompt);
  return c.json({ id });
});

projectRoutes.get("/:id", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  const msgs = await db().select().from(messages).where(eq(messages.projectId, p.id)).orderBy(asc(messages.createdAt));
  return c.json({ ...p, messages: msgs, ai: { chat: hasClaude(), images: hasImages() } });
});

projectRoutes.delete("/:id", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  await db().delete(projects).where(eq(projects.id, p.id));
  return c.json({ ok: true });
});

/** Runs the prompt → product pipeline. The client keeps this request open and polls the project for progress. */
projectRoutes.post("/:id/generate", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  const stale = p.gen.startedAt && Date.now() - new Date(p.gen.startedAt).getTime() > 150_000;
  if (p.gen.step === 0 || p.gen.step >= 6) return c.json({ ok: true, skipped: "done" });
  if (p.gen.startedAt && !stale && !p.gen.error) return c.json({ ok: true, skipped: "running" });

  // Charged once per build; a retry after a failure was already refunded, so it is charged again.
  let refund = async () => {};
  try {
    if (hasClaude()) refund = await charge(c.get("user"), "generate", p.id);
  } catch (e) {
    // Out of credits: show it on the build page instead of spinning forever.
    await setGen(p.id, { ...p.gen, startedAt: null, error: errText(e) });
    return c.json({ ok: false, error: errText(e) }, 402);
  }
  let gen: GenState = { step: 1, error: null, startedAt: new Date().toISOString(), plan: p.gen.plan };
  await setGen(p.id, gen);
  try {
    // 1. Components
    const t0 = Date.now();
    const lap = (what: string) => console.log(`[generate ${p.id}] ${what} at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const d = hasClaude() ? await designProduct(p.prompt) : designByKeywords(p.prompt);
    const made = fromDesign(d);
    const doc = { name: d.name.slice(0, 80), description: d.description, nodes: made.nodes, spec: made.spec };
    gen = { ...gen, step: 2, plan: [d.plan.components, d.plan.enclosure, d.plan.firmware, d.plan.bom, d.plan.manufacturing] };
    await setGen(p.id, gen, { ...doc, features: made.features, design: made.design, compiled: made.compiled });
    await say(p.id, "assistant", d.reply);
    lap("designed");

    // 2. Enclosure: the geometry comes out of the compile above.
    gen = { ...gen, step: 3 };
    await setGen(p.id, gen);

    // 3. Firmware
    const template = composeFirmware(doc);
    const firmware = hasClaude() ? await writeFirmware({ ...doc, compiled: made.compiled, language: "micropython" }).catch((e) => (console.error("firmware failed", e), template)) : template;
    lap("firmware written");

    // 4 and 5. The BOM and manufacturing plan come from the compile. The picture is made afterwards,
    // from the browser's snapshot of the real 3D model, so it shows the device that will be built.
    await setGen(p.id, { ...gen, step: 6, startedAt: null }, { firmware });
    return c.json({ ok: true });
  } catch (e) {
    console.error("generation failed", e);
    await refund();
    await setGen(p.id, { ...gen, error: errText(e) });
    return c.json({ ok: false, error: errText(e) }, 500);
  }
});

function patchDesign(cur: DesignConfig, patch: Partial<Record<keyof DesignConfig, unknown>>): DesignConfig {
  const d = { ...cur };
  if (patch.shape === "box" || patch.shape === "round") d.shape = patch.shape;
  if (typeof patch.style === "string" && patch.style in STYLE) d.style = patch.style as DesignConfig["style"];
  if (typeof patch.material === "string" && patch.material in MATERIAL) d.material = patch.material as DesignConfig["material"];
  if (typeof patch.color === "string" && /^#[0-9a-fA-F]{6}$/.test(patch.color)) d.color = patch.color;
  if (typeof patch.auto === "boolean") d.auto = patch.auto;
  for (const k of ["width", "height", "depth"] as const) {
    const v = Number(patch[k]);
    if (patch[k] != null && Number.isFinite(v)) {
      d[k] = Math.min(200, Math.max(10, Math.round(v)));
      if (patch.auto === undefined) d.auto = false;
    }
  }
  return d;
}

async function save(p: Project, next: { name?: string; description?: string; nodes?: ProjectNode[]; design?: DesignConfig; spec?: Project["spec"] }) {
  const nodes = next.nodes ?? p.nodes;
  const spec = next.spec ?? p.spec;
  const name = next.name ?? p.name;
  const description = next.description ?? p.description;
  const b = build(nodes, next.design ?? p.design, spec);
  const rewired = !!next.nodes && JSON.stringify(next.nodes.map((n) => [n.id, n.blockId])) !== JSON.stringify(p.nodes.map((n) => [n.id, n.blockId]));
  // New wiring means the old firmware has the wrong pins, so fall back to the composed baseline.
  const firmware = rewired || !p.firmware ? composeFirmware({ name, description, nodes, spec }) : p.firmware;
  const [row] = await db()
    .update(projects)
    .set({ name, description, nodes, spec, ...b, firmware, features: rewired ? deriveFeatures(nodes) : p.features, version: p.version + 1, updatedAt: new Date() })
    .where(eq(projects.id, p.id))
    .returning();
  return { row, rewired };
}

projectRoutes.patch("/:id", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  const body = await c.req.json<{ name?: string; nodes?: unknown; design?: Partial<DesignConfig>; previewAssetId?: string }>();
  // Picking a variant makes its render the project's picture.
  if (body.previewAssetId && p.variants.some((v) => v.assetId === body.previewAssetId)) {
    const swapped: Variant[] = p.previewAssetId ? [{ assetId: p.previewAssetId, style: p.design.style, color: p.design.color }, ...p.variants.filter((v) => v.assetId !== body.previewAssetId)] : p.variants;
    await db().update(projects).set({ previewAssetId: body.previewAssetId, variants: swapped }).where(eq(projects.id, p.id));
  }
  const { row } = await save(p, {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : undefined,
    nodes: body.nodes ? cleanNodes(body.nodes) : undefined,
    design: body.design ? patchDesign(p.design, body.design) : undefined,
  });
  return c.json(row);
});

projectRoutes.post("/:id/chat", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  const { message } = await c.req.json<{ message: string }>();
  const text = (message ?? "").trim();
  if (!text) bad("Say what you'd like to change.");
  if (!hasClaude()) bad("Chat needs ANTHROPIC_API_KEY on the api. You can still edit the design by hand.", 422);

  c.set("refund", await charge(c.get("user"), "chat", p.id));
  const history = await db().select().from(messages).where(eq(messages.projectId, p.id)).orderBy(asc(messages.createdAt));
  await say(p.id, "user", text);
  const edit = await editProduct(p, history, text);

  const remove = new Set(edit.remove_blocks);
  let nodes = p.nodes.filter((n) => !remove.has(n.blockId));
  let ids = ensurePower([...nodes.map((n) => n.blockId), ...edit.add_blocks.filter((id) => getBlock(id))]);
  // One controller only: a newly added one replaces the old.
  const newMcu = edit.add_blocks.find((id) => getBlock(id)?.iface === "mcu");
  if (newMcu) {
    nodes = nodes.filter((n) => getBlock(n.blockId)?.iface !== "mcu");
    ids = ids.filter((id) => getBlock(id)?.iface !== "mcu" || id === newMcu);
  }
  const have = nodes.map((n) => n.blockId);
  for (const id of ids) {
    const i = have.indexOf(id);
    if (i >= 0) have.splice(i, 1);
    else nodes = [...nodes, { id: nextNodeId(nodes), blockId: id, x: 0, y: 0 }];
  }
  const changedNodes = nodes.length !== p.nodes.length || nodes.some((n, i) => n.blockId !== p.nodes[i]?.blockId);
  const spec = { ...p.spec, ...Object.fromEntries(Object.entries(edit.spec).filter(([, v]) => v !== null)) } as Project["spec"];

  const { row, rewired } = await save(p, {
    name: edit.name?.slice(0, 80) ?? undefined,
    description: edit.description ?? undefined,
    nodes: changedNodes ? arrange(nodes) : undefined,
    design: patchDesign(p.design, Object.fromEntries(Object.entries(edit.design).filter(([, v]) => v !== null))),
    spec,
  });

  let out = row;
  if (edit.rewrite_firmware || (rewired && p.firmware?.source === "ai")) {
    const firmware = await writeFirmware({ ...row, language: p.firmware?.language ?? "micropython", instructions: text }).catch((e) => (console.error("firmware failed", e), null));
    if (firmware) [out] = await db().update(projects).set({ firmware }).where(eq(projects.id, p.id)).returning();
  }
  await say(p.id, "assistant", edit.reply, edit.changes);
  const msgs = await db().select().from(messages).where(eq(messages.projectId, p.id)).orderBy(asc(messages.createdAt));
  return c.json({ ...out, messages: msgs });
});

projectRoutes.post("/:id/firmware", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  const { language } = await c.req.json<{ language: "micropython" | "arduino" }>();
  if (language !== "micropython" && language !== "arduino") bad("Unknown language.");
  if (!p.nodes.length) bad("Add some blocks first.");
  let firmware;
  if (hasClaude()) c.set("refund", await charge(c.get("user"), "firmware", p.id));
  if (hasClaude()) firmware = await writeFirmware({ ...p, language });
  else if (language === "micropython") firmware = composeFirmware(p);
  else firmware = bad("Arduino C++ is written by Claude and needs ANTHROPIC_API_KEY on the api.", 422);
  const [row] = await db().update(projects).set({ firmware, updatedAt: new Date() }).where(eq(projects.id, p.id)).returning();
  return c.json(row);
});

projectRoutes.post("/:id/preview", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  if (!hasImages()) bad("Renders need OPENAI_API_KEY on the api.", 422);
  if (!p.nodes.length) bad("Add some blocks first.");
  const body = await c.req.json<{ reference?: string }>().catch(() => ({}) as { reference?: string });
  // A build's first picture is part of the build; re-renders are charged.
  if (p.previewAssetId) c.set("refund", await charge(c.get("user"), "render", p.id));
  const previewAssetId = await renderPreview(p.id, p, "preview", decodeReference(body.reference));
  // An untouched remix of a proven build: keep this render for everyone who remixes it next.
  const t = p.origin === "template" && p.version === 1 ? TEMPLATES.find((x) => x.prompt === p.prompt) : undefined;
  if (t) await db().update(assets).set({ ref: `template:${t.id}` }).where(eq(assets.id, previewAssetId));
  const [row] = await db().update(projects).set({ previewAssetId, updatedAt: new Date() }).where(eq(projects.id, p.id)).returning();
  return c.json(row);
});

/** Renders the same device in other styles and colours, to pick from on the Design page. */
projectRoutes.post("/:id/variants", async (c) => {
  const p = await ownProject(c.get("user"), c.req.param("id"));
  if (!hasImages()) bad("Variants need OPENAI_API_KEY on the api.", 422);
  const reference = decodeReference((await c.req.json<{ reference?: string }>().catch(() => ({}) as { reference?: string })).reference);
  c.set("refund", await charge(c.get("user"), "variants", p.id));
  const styles = Object.keys(STYLE) as DesignConfig["style"][];
  // With a reference picture the shape is fixed, so variants explore colour; without one they can vary style too.
  const options = (reference ? [p.design.style] : styles).flatMap((style) => COLORS.map((color) => ({ style, color }))).filter((o) => o.style !== p.design.style || o.color !== p.design.color);
  const picks = [...options].sort(() => Math.random() - 0.5).slice(0, 3);
  const made = await Promise.all(
    picks.map(async (o): Promise<Variant | null> => {
      const design = { ...p.design, ...o };
      const b = build(p.nodes, design, p.spec);
      return renderPreview(p.id, { ...p, ...b }, "variant", reference).then((assetId) => ({ assetId, ...o })).catch((e) => (console.error("variant failed", e), null));
    }),
  );
  const variants = made.filter((v): v is Variant => !!v);
  if (!variants.length) bad("The image model did not return any variants. Try again.", 422);
  const [row] = await db().update(projects).set({ variants: [...variants, ...p.variants].slice(0, 8), updatedAt: new Date() }).where(eq(projects.id, p.id)).returning();
  return c.json(row);
});
