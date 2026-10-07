import { BLOCKS, PARTNER_TYPES, STAGE_IDS, getBlock, stageMeta, type OrderStatus, type PartnerType } from "@craftr/core";
import { blockArt, db, orderEvents, orders, partners, projects, users } from "@craftr/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { hasImages, renderBlock } from "../ai/images";
import { requireAdmin, requireUser, type AppEnv } from "../auth";
import { bad } from "../lib";

export const adminRoutes = new Hono<AppEnv>().use(requireUser, requireAdmin);

const event = (orderId: string, actor: { id: string; name: string }, e: Pick<typeof orderEvents.$inferInsert, "type" | "title"> & Partial<typeof orderEvents.$inferInsert>) =>
  db().insert(orderEvents).values({ id: nanoid(12), orderId, actorId: actor.id, actorName: actor.name, ...e });

adminRoutes.get("/overview", async (c) => {
  const [o] = await db()
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${orders.status} not in ('delivered','cancelled'))::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.status} <> 'cancelled'), 0)::int`,
      minutes: sql<number>`coalesce(sum(${orders.humanMinutes}), 0)::int`,
      untouched: sql<number>`count(*) filter (where ${orders.humanMinutes} = 0 and ${orders.status} = 'delivered')::int`,
    })
    .from(orders);
  const byStatus = await db().select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status);
  const [p] = await db().select({ n: sql<number>`count(*)::int` }).from(projects);
  const [u] = await db().select({ n: sql<number>`count(*)::int` }).from(users);
  return c.json({ orders: o, byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), projects: p.n, users: u.n });
});

adminRoutes.get("/orders", async (c) => {
  const rows = await db().select({ order: orders, user: { name: users.name, email: users.email } }).from(orders).innerJoin(users, eq(users.id, orders.userId)).orderBy(desc(orders.createdAt)).limit(200);
  return c.json(rows.map(({ order: { snapshot, ...o }, user }) => ({ ...o, name: snapshot.name, previewAssetId: snapshot.previewAssetId, customer: user })));
});

adminRoutes.get("/orders/:id", async (c) => {
  const [row] = await db().select({ order: orders, user: users }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(eq(orders.id, c.req.param("id")));
  if (!row) bad("Order not found.", 404);
  const events = await db().select().from(orderEvents).where(eq(orderEvents.orderId, row.order.id)).orderBy(asc(orderEvents.createdAt));
  return c.json({ ...row.order, customer: { id: row.user.id, name: row.user.name, email: row.user.email }, events });
});

/** Moves an order to a stage. The customer's tracking page reads the same row and events. */
adminRoutes.post("/orders/:id/stage", async (c) => {
  const user = c.get("user");
  const { status, note } = await c.req.json<{ status: OrderStatus; note?: string }>();
  if (status !== "cancelled" && !STAGE_IDS.includes(status)) bad("Unknown stage.");
  const [o] = await db().update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, c.req.param("id"))).returning();
  if (!o) bad("Order not found.", 404);
  const meta = stageMeta(status);
  await event(o.id, user, { type: "stage", stage: status, title: status === "cancelled" ? "Order cancelled" : meta.label, note: note?.trim() || (status === "cancelled" ? "This order was cancelled." : meta.active) });
  return c.json({ ok: true });
});

adminRoutes.patch("/orders/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ designerId?: string | null; printerId?: string | null; carrier?: string; trackingNumber?: string; etaFrom?: string; etaTo?: string; addMinutes?: number }>();
  const [cur] = await db().select().from(orders).where(eq(orders.id, id));
  if (!cur) bad("Order not found.", 404);
  const set: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };

  for (const [key, what] of [["designerId", "designer"], ["printerId", "print partner"]] as const) {
    const v = body[key];
    if (v === undefined || v === cur[key]) continue;
    set[key] = v;
    if (v) {
      const [partner] = await db().select().from(partners).where(eq(partners.id, v));
      if (!partner) bad("Unknown partner.");
      // The customer sees that a handoff happened; who it went to stays internal.
      await event(id, user, { type: "handoff", title: key === "designerId" ? "Design handed to a designer" : "Files sent to the print partner", note: key === "designerId" ? "A designer is reviewing your enclosure for printability." : "Your enclosure files are with our print partner." });
      await event(id, user, { type: "handoff", internal: true, title: `Assigned ${what}: ${partner.name}`, note: partner.contact });
    }
  }
  if (body.carrier !== undefined) set.carrier = body.carrier.trim() || null;
  if (body.trackingNumber !== undefined) {
    set.trackingNumber = body.trackingNumber.trim() || null;
    if (set.trackingNumber && set.trackingNumber !== cur.trackingNumber) await event(id, user, { type: "tracking", title: "Tracking number added", note: `${(set.carrier ?? cur.carrier) || "Courier"}: ${set.trackingNumber}` });
  }
  if (body.etaFrom && body.etaTo) {
    const from = new Date(body.etaFrom);
    const to = new Date(body.etaTo);
    if (isNaN(+from) || isNaN(+to) || to < from) bad("Delivery window is not valid.");
    set.etaFrom = from;
    set.etaTo = to;
  }
  if (body.addMinutes) {
    const m = Math.round(Number(body.addMinutes));
    if (!Number.isFinite(m) || m <= 0 || m > 600) bad("Minutes must be between 1 and 600.");
    set.humanMinutes = cur.humanMinutes + m;
    await event(id, user, { type: "note", internal: true, title: `Logged ${m} min of engineering time`, note: "" });
  }
  await db().update(orders).set(set).where(eq(orders.id, id));
  return c.json({ ok: true });
});

adminRoutes.post("/orders/:id/notes", async (c) => {
  const { note, internal } = await c.req.json<{ note: string; internal?: boolean }>();
  if (!note?.trim()) bad("Write a note first.");
  const [o] = await db().select({ id: orders.id }).from(orders).where(eq(orders.id, c.req.param("id")));
  if (!o) bad("Order not found.", 404);
  await event(o.id, c.get("user"), { type: "note", internal: !!internal, title: internal ? "Internal note" : "Update from Craftr", note: note.trim().slice(0, 2000) });
  return c.json({ ok: true });
});

adminRoutes.get("/partners", async (c) => c.json(await db().select().from(partners).orderBy(asc(partners.type), asc(partners.name))));

adminRoutes.post("/partners", async (c) => {
  const b = await c.req.json<{ name: string; type: PartnerType; contact?: string; city?: string }>();
  if (!b.name?.trim() || !PARTNER_TYPES.includes(b.type)) bad("A partner needs a name and a type.");
  const [row] = await db().insert(partners).values({ id: nanoid(10), name: b.name.trim(), type: b.type, contact: b.contact?.trim() ?? "", city: b.city?.trim() ?? "" }).returning();
  return c.json(row);
});

adminRoutes.patch("/partners/:id", async (c) => {
  const { active } = await c.req.json<{ active: boolean }>();
  await db().update(partners).set({ active: !!active }).where(eq(partners.id, c.req.param("id")));
  return c.json({ ok: true });
});

adminRoutes.get("/users", async (c) => {
  const rows = await db()
    .select({ id: users.id, name: users.name, email: users.email, imageUrl: users.imageUrl, role: users.role, createdAt: users.createdAt, projects: sql<number>`(select count(*) from ${projects} where ${projects.userId} = ${users.id})::int`, orders: sql<number>`(select count(*) from ${orders} where ${orders.userId} = ${users.id})::int` })
    .from(users)
    .orderBy(desc(users.createdAt));
  return c.json(rows);
});

adminRoutes.patch("/users/:id", async (c) => {
  const { role } = await c.req.json<{ role: "user" | "admin" }>();
  if (role !== "user" && role !== "admin") bad("Unknown role.");
  if (c.req.param("id") === c.get("user").id && role !== "admin") bad("You cannot remove your own admin access.");
  await db().update(users).set({ role }).where(eq(users.id, c.req.param("id")));
  return c.json({ ok: true });
});

adminRoutes.get("/projects", async (c) => {
  const rows = await db()
    .select({ id: projects.id, name: projects.name, origin: projects.origin, previewAssetId: projects.previewAssetId, compiled: projects.compiled, updatedAt: projects.updatedAt, owner: users.name, email: users.email })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.userId))
    .orderBy(desc(projects.updatedAt))
    .limit(200);
  return c.json(rows.map(({ compiled, ...r }) => ({ ...r, unitInr: compiled.pricing.unitInr, errors: compiled.checks.filter((k) => k.level === "error").length, blockCount: compiled.bom.filter((b) => b.blockId).length })));
});

adminRoutes.post("/blocks/:id/art", async (c) => {
  const b = getBlock(c.req.param("id")) ?? bad("Unknown block.", 404);
  if (!hasImages()) bad("Block art needs OPENAI_API_KEY on the api.", 422);
  const assetId = await renderBlock(b);
  await db().insert(blockArt).values({ blockId: b.id, assetId }).onConflictDoUpdate({ target: blockArt.blockId, set: { assetId, updatedAt: new Date() } });
  return c.json({ blockId: b.id, assetId });
});

adminRoutes.get("/blocks", async (c) => {
  const art = await db().select().from(blockArt);
  return c.json({ total: BLOCKS.length, withArt: art.length, images: hasImages() });
});
