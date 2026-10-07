import { ACTIONS, MARGIN, PACKS, PLANS, SIGNUP_CREDITS, creditsFor, getPlan, type ActionId } from "@craftr/core";
import { billingProducts, creditLedger, db, users, webhookEvents } from "@craftr/db";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser, type AppEnv } from "../auth";
import { adjust, dodo, hasBilling } from "../billing";
import { env } from "../env";
import { bad } from "../lib";

export const billingRoutes = new Hono<AppEnv>();

const catalog = () => ({
  margin: MARGIN,
  signupCredits: SIGNUP_CREDITS,
  plans: PLANS,
  packs: PACKS,
  actions: (Object.keys(ACTIONS) as ActionId[]).map((id) => ({ id, label: ACTIONS[id].label, detail: ACTIONS[id].detail, credits: creditsFor(id) })),
});

/** Public: what things cost. Used by the Billing page and anywhere a price is shown. */
billingRoutes.get("/catalog", (c) => c.json(catalog()));

billingRoutes.get("/", requireUser, async (c) => {
  const u = c.get("user");
  const ledger = await db().select().from(creditLedger).where(eq(creditLedger.userId, u.id)).orderBy(desc(creditLedger.createdAt)).limit(30);
  return c.json({ ...catalog(), credits: u.credits, plan: u.plan, planRenewsAt: u.planRenewsAt, canManage: !!u.dodoCustomerId, configured: hasBilling(), testMode: env.dodoMode === "test_mode", unlimited: u.role === "admin", ledger });
});

/** Finds the Dodo product for a plan or pack, creating it the first time it is needed. */
async function productId(key: string, name: string, priceInr: number, recurring: boolean): Promise<string> {
  const [have] = await db().select().from(billingProducts).where(and(eq(billingProducts.key, `${env.dodoMode}:${key}`)));
  if (have) return have.productId;
  const base = { currency: "INR" as const, price: priceInr * 100, discount: 0, purchasing_power_parity: false, tax_inclusive: true };
  const product = await dodo().products.create({
    name: `Craftr ${name}`,
    description: recurring ? "Monthly credits for building hardware with Craftr." : "One-time credit top-up for Craftr.",
    tax_category: "saas",
    price: recurring ? { ...base, type: "recurring_price", payment_frequency_count: 1, payment_frequency_interval: "Month", subscription_period_count: 10, subscription_period_interval: "Year" } : { ...base, type: "one_time_price", pay_what_you_want: false },
    metadata: { craftr_key: key },
  });
  await db().insert(billingProducts).values({ key: `${env.dodoMode}:${key}`, productId: product.product_id, mode: env.dodoMode }).onConflictDoNothing();
  return product.product_id;
}

billingRoutes.post("/checkout", requireUser, async (c) => {
  const u = c.get("user");
  if (!hasBilling()) bad("Payments are not set up yet: DODO_PAYMENTS_API_KEY is missing on the api.", 422);
  const { kind, id } = await c.req.json<{ kind: "plan" | "pack"; id: string }>();
  const item = (kind === "plan" ? PLANS.find((p) => p.id === id && p.priceInr > 0) : kind === "pack" ? PACKS.find((p) => p.id === id) : undefined) ?? bad("Unknown plan or pack.");
  if (kind === "plan" && u.plan !== "free") bad("You already have a subscription. Use Manage subscription to change or cancel it.", 409);
  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: await productId(item.id, item.name, item.priceInr, kind === "plan"), quantity: 1 }],
    customer: u.dodoCustomerId ? { customer_id: u.dodoCustomerId } : { email: u.email, name: u.name || u.email },
    metadata: { user_id: u.id, kind, item: item.id },
    return_url: `${env.webOrigins[0]}/billing?paid=1`,
  });
  if (!session.checkout_url) bad("Dodo Payments did not return a checkout link. Try again.", 422);
  return c.json({ url: session.checkout_url });
});

billingRoutes.post("/portal", requireUser, async (c) => {
  const u = c.get("user");
  if (!hasBilling() || !u.dodoCustomerId) bad("There is no subscription to manage yet.", 422);
  const portal = await dodo().customers.customerPortal.create(u.dodoCustomerId!);
  return c.json({ url: portal.link });
});

type Meta = { user_id?: string; kind?: string; item?: string };

/** Dodo calls this when a payment or subscription changes. Credits are only ever granted here. */
billingRoutes.post("/webhook", async (c) => {
  if (!env.dodoWebhookKey) return c.json({ error: "Webhook key not configured." }, 503);
  const body = await c.req.text();
  let event;
  try {
    event = dodo().webhooks.unwrap(body, { headers: { "webhook-id": c.req.header("webhook-id") ?? "", "webhook-signature": c.req.header("webhook-signature") ?? "", "webhook-timestamp": c.req.header("webhook-timestamp") ?? "" } });
  } catch {
    return c.json({ error: "Bad signature." }, 401);
  }
  // A delivery that was already handled is acknowledged and skipped.
  const [fresh] = await db().insert(webhookEvents).values({ id: c.req.header("webhook-id")!, type: event.type }).onConflictDoNothing().returning();
  if (!fresh) return c.json({ ok: true, duplicate: true });

  if (event.type === "payment.succeeded") {
    const m = (event.data.metadata ?? {}) as Meta;
    const pack = PACKS.find((p) => p.id === m.item);
    if (m.kind === "pack" && pack && m.user_id) {
      await adjust(m.user_id, pack.credits, `Bought ${pack.name}`, event.data.payment_id);
      await db().update(users).set({ dodoCustomerId: event.data.customer.customer_id }).where(eq(users.id, m.user_id));
    }
  } else if (event.type === "subscription.active" || event.type === "subscription.renewed" || event.type === "subscription.plan_changed") {
    const s = event.data;
    const m = (s.metadata ?? {}) as Meta;
    const [mapped] = await db().select().from(billingProducts).where(eq(billingProducts.productId, s.product_id));
    const plan = PLANS.find((p) => p.id === (mapped?.key.split(":")[1] ?? m.item) && p.priceInr > 0);
    if (m.user_id && plan) {
      await db().update(users).set({ plan: plan.id, planRenewsAt: new Date(s.next_billing_date), dodoSubscriptionId: s.subscription_id, dodoCustomerId: s.customer.customer_id }).where(eq(users.id, m.user_id));
      // One grant per billing period, however many events describe it.
      const period = `${s.subscription_id}:${s.next_billing_date.slice(0, 10)}`;
      const [given] = await db().select({ id: creditLedger.id }).from(creditLedger).where(and(eq(creditLedger.userId, m.user_id), eq(creditLedger.ref, period)));
      if (!given && event.type !== "subscription.plan_changed") await adjust(m.user_id, plan.credits, `${plan.name} plan: monthly credits`, period);
    }
  } else if (event.type === "subscription.cancelled" || event.type === "subscription.expired" || event.type === "subscription.failed") {
    const m = (event.data.metadata ?? {}) as Meta;
    // Credits already granted are kept; only the plan ends.
    if (m.user_id) await db().update(users).set({ plan: getPlan("free").id, planRenewsAt: null, dodoSubscriptionId: null }).where(and(eq(users.id, m.user_id), eq(users.dodoSubscriptionId, event.data.subscription_id)));
  }
  return c.json({ ok: true });
});
