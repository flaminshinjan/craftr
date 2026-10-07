import { createClerkClient, verifyToken } from "@clerk/backend";
import { db, users } from "@craftr/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { env } from "./env";

export type User = typeof users.$inferSelect;
export type AppEnv = { Variables: { user: User } };

async function upsert(id: string, load: () => Promise<{ email: string; name: string; imageUrl: string | null }>): Promise<User> {
  const [existing] = await db().select().from(users).where(eq(users.id, id));
  if (existing) {
    // ADMIN_EMAILS can be changed after a user first signed in.
    if (existing.role !== "admin" && env.adminEmails.includes(existing.email.toLowerCase())) {
      const [u] = await db().update(users).set({ role: "admin" }).where(eq(users.id, id)).returning();
      return u;
    }
    return existing;
  }
  const info = await load();
  const role = env.adminEmails.includes(info.email.toLowerCase()) ? "admin" : "user";
  const [created] = await db().insert(users).values({ id, ...info, role }).onConflictDoUpdate({ target: users.id, set: info }).returning();
  return created;
}

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const dev = c.req.header("x-dev-user");
  if (env.devBypass && dev) {
    c.set("user", await upsert(`dev_${dev}`, async () => ({ email: dev.includes("@") ? dev : `${dev}@dev.local`, name: dev.split("@")[0], imageUrl: null })));
    return next();
  }

  const token = c.req.header("authorization")?.replace(/^Bearer /i, "");
  const secretKey = env.clerkSecret;
  if (!token) throw new HTTPException(401, { message: "Sign in to continue." });
  if (!secretKey) throw new HTTPException(500, { message: "CLERK_SECRET_KEY is not configured on the api." });

  let sub: string;
  try {
    sub = (await verifyToken(token, { secretKey })).sub;
  } catch {
    throw new HTTPException(401, { message: "Your session expired. Sign in again." });
  }
  c.set(
    "user",
    await upsert(sub, async () => {
      const u = await createClerkClient({ secretKey }).users.getUser(sub);
      const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
      return { email, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || email.split("@")[0], imageUrl: u.imageUrl ?? null };
    }),
  );
  return next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") throw new HTTPException(403, { message: "Admins only." });
  return next();
});
