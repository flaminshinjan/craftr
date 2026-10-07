import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";
export { schema };

let cached: ReturnType<typeof create> | null = null;
const create = (url: string) => drizzle(neon(url), { schema });

/** Lazy so that importing this package never throws when DATABASE_URL is missing. */
export function db() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = create(url);
  }
  return cached;
}
export type Db = ReturnType<typeof db>;
