import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

/** In local dev Clerk can run "keyless": the web app writes temporary keys to disk and we reuse them. */
function keylessSecret(): string | undefined {
  if (isProd) return undefined;
  for (const p of ["../web/.clerk/.tmp/keyless.json", "apps/web/.clerk/.tmp/keyless.json"]) {
    const file = resolve(process.cwd(), p);
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, "utf8")).secretKey;
      } catch {}
    }
  }
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4747),
  get clerkSecret() {
    return process.env.CLERK_SECRET_KEY || keylessSecret();
  },
  anthropicKey: process.env.ANTHROPIC_API_KEY || undefined,
  openaiKey: process.env.OPENAI_API_KEY || undefined,
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  dodoKey: process.env.DODO_PAYMENTS_API_KEY || undefined,
  dodoWebhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || undefined,
  dodoMode: (process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode") as "live_mode" | "test_mode",
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3737").split(",").map((s) => s.trim().replace(/\/$/, "")),
  /** Local scripted testing only: trust an x-dev-user header. Never honoured in production. */
  devBypass: !isProd && process.env.DEV_AUTH_BYPASS === "1",
};
