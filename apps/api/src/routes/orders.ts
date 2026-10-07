import { ORDER_STAGES, orderTotals } from "@craftr/core";
import { db, orderEvents, orders, users, type ShippingAddress } from "@craftr/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { requireUser, type AppEnv } from "../auth";
import { bad, ownProject } from "../lib";

export const orderRoutes = new Hono<AppEnv>().use(requireUser);

const LEAD_DAYS: Record<string, [number, number]> = { prototype: [7, 10], small_batch: [14, 21], batch: [28, 42] };
const METHODS = ["card", "upi", "netbanking"];
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

function cleanAddress(a: Partial<ShippingAddress> | undefined): ShippingAddress {
  const s = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
  const out = { fullName: s(a?.fullName, 80), phone: s(a?.phone, 20), email: s(a?.email, 120), address: s(a?.address, 300), city: s(a?.city, 60), state: s(a?.state, 60), pin: s(a?.pin, 6) };
  if (!out.fullName || !out.address || !out.city || !out.state) bad("Fill in your name and full address.");
  if (out.phone.replace(/\D/g, "").length < 10) bad("Enter a valid phone number.");
  if (!/^\d{6}$/.test(out.pin)) bad("PIN code must be 6 digits.");
  return out;
}

orderRoutes.get("/", async (c) => {
  const rows = await db().select().from(orders).where(eq(orders.userId, c.get("user").id)).orderBy(desc(orders.createdAt));
  return c.json(rows.map(({ snapshot, ...o }) => ({ ...o, name: snapshot.name, description: snapshot.description, previewAssetId: snapshot.previewAssetId })));
});

orderRoutes.get("/address", (c) => c.json(c.get("user").savedAddress ?? null));

orderRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ projectId: string; tier: string; shipping: Partial<ShippingAddress>; paymentMethod: string; saveAddress?: boolean }>();
  const p = await ownProject(user, body.projectId);
  if (p.userId !== user.id) bad("You can only order your own projects.");
  const errors = p.compiled.checks.filter((k) => k.level === "error");
  if (errors.length) bad(`Fix this before ordering: ${errors[0].title}. ${errors[0].detail}`, 422);
  if (!p.nodes.length) bad("This project has no components yet.", 422);
  const tier = p.compiled.pricing.tiers.find((t) => t.id === body.tier) ?? bad("Unknown manufacturing option.");
  if (!METHODS.includes(body.paymentMethod)) bad("Choose a payment method.");
  const shipping = cleanAddress(body.shipping);
  const totals = orderTotals(tier.unitInr, tier.qty);
  const [from, to] = LEAD_DAYS[tier.id];

  const id = nanoid(12);
  // Order numbers are sequential; retry if two checkouts race for the same one.
  for (let attempt = 0; ; attempt++) {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(orders);
    try {
      await db().insert(orders).values({
        id,
        number: `CRF-${1042 + n + attempt}`,
        userId: user.id,
        projectId: p.id,
        snapshot: { name: p.name, description: p.description, features: p.features, spec: p.spec, nodes: p.nodes, design: p.design, compiled: p.compiled, firmware: p.firmware, previewAssetId: p.previewAssetId, version: p.version },
        tier: tier.id,
        qty: tier.qty,
        unitInr: tier.unitInr,
        subtotalInr: totals.subtotal,
        shippingInr: totals.shipping,
        taxInr: totals.tax,
        totalInr: totals.total,
        shipping,
        paymentMethod: body.paymentMethod,
        paymentStatus: "simulated",
        etaFrom: days(from),
        etaTo: days(to),
      });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
  await db().insert(orderEvents).values({ id: nanoid(12), orderId: id, type: "stage", stage: "confirmed", title: ORDER_STAGES[0].label, note: ORDER_STAGES[0].done });
  if (body.saveAddress) await db().update(users).set({ savedAddress: shipping }).where(eq(users.id, user.id));
  return c.json({ id });
});

orderRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const [o] = await db().select().from(orders).where(and(eq(orders.id, c.req.param("id")), eq(orders.userId, user.id)));
  if (!o) bad("Order not found.", 404);
  const events = await db().select().from(orderEvents).where(and(eq(orderEvents.orderId, o.id), eq(orderEvents.internal, false))).orderBy(asc(orderEvents.createdAt));
  // Partner assignments and time tracking stay on the admin side.
  const { designerId, printerId, humanMinutes, ...rest } = o;
  return c.json({ ...rest, events });
});
