import { ACTIONS, creditsFor, type ActionId } from "@craftr/core";
import { creditLedger, db, users } from "@craftr/db";
import { and, eq, gte, sql } from "drizzle-orm";
import DodoPayments from "dodopayments";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import type { User } from "./auth";
import { env } from "./env";

let client: DodoPayments | null = null;
export const hasBilling = () => !!env.dodoKey;
export const dodo = () => (client ??= new DodoPayments({ bearerToken: env.dodoKey, webhookKey: env.dodoWebhookKey ?? null, environment: env.dodoMode }));

/** Adds (or removes) credits and records why. The balance never goes below zero. */
export async function adjust(userId: string, delta: number, reason: string, ref?: string | null): Promise<number | null> {
  const [row] = await db()
    .update(users)
    .set({ credits: sql`${users.credits} + ${delta}` })
    .where(delta < 0 ? and(eq(users.id, userId), gte(users.credits, -delta)) : eq(users.id, userId))
    .returning({ credits: users.credits });
  if (!row) return null;
  await db().insert(creditLedger).values({ id: nanoid(14), userId, delta, balance: row.credits, reason, ref: ref ?? null });
  return row.credits;
}

/**
 * Charges for an AI action before it runs. Returns a refund function to call if the action fails,
 * so people only pay for work they actually received. Admins are not charged.
 */
export async function charge(user: User, action: ActionId, ref?: string): Promise<() => Promise<void>> {
  // Nothing is charged until payments are connected, so nobody can run out with no way to top up.
  if (user.role === "admin" || !hasBilling()) return async () => {};
  const cost = creditsFor(action);
  const left = await adjust(user.id, -cost, ACTIONS[action].label, ref);
  if (left === null) throw new HTTPException(402, { message: `This needs ${cost} credits and you have ${user.credits}. Add credits on the Billing page to continue.` });
  let refunded = false;
  return async () => {
    if (refunded) return;
    refunded = true;
    await adjust(user.id, cost, `Refund: ${ACTIONS[action].label}`, ref);
  };
}
