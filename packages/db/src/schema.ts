import type { Compiled, DesignConfig, Feature, Firmware, OrderStatus, PartnerType, ProductSpec, ProjectNode } from "@craftr/core";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  imageUrl: text("image_url"),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  savedAddress: jsonb("saved_address").$type<ShippingAddress | null>(),
  createdAt,
});

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pin: string;
}

export interface GenState {
  step: number; // 0 idle, 1..5 running that plan step, 6 done
  error: string | null;
  startedAt: string | null;
  /** One line per plan step, written for this product. */
  plan: string[];
}

export interface Variant {
  assetId: string;
  style: DesignConfig["style"];
  color: string;
}

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prompt: text("prompt").notNull().default(""),
    description: text("description").notNull().default(""),
    origin: text("origin").$type<"prompt" | "template" | "blocks">().notNull().default("prompt"),
    features: jsonb("features").$type<Feature[]>().notNull().default([]),
    spec: jsonb("spec").$type<ProductSpec>().notNull(),
    nodes: jsonb("nodes").$type<ProjectNode[]>().notNull().default([]),
    design: jsonb("design").$type<DesignConfig>().notNull(),
    compiled: jsonb("compiled").$type<Compiled>().notNull(),
    firmware: jsonb("firmware").$type<Firmware | null>(),
    gen: jsonb("gen").$type<GenState>().notNull(),
    previewAssetId: text("preview_asset_id"),
    variants: jsonb("variants").$type<Variant[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (t) => [index("projects_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    changes: jsonb("changes").$type<string[]>().notNull().default([]),
    createdAt,
  },
  (t) => [index("messages_project_idx").on(t.projectId, t.createdAt)],
);

/** Generated images, stored in Postgres and served by the api with long cache headers. */
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"preview" | "variant" | "block">().notNull(),
  ref: text("ref"), // project id or block id
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
  createdAt,
});

export const blockArt = pgTable("block_art", {
  blockId: text("block_id").primaryKey(),
  assetId: text("asset_id").notNull(),
  updatedAt,
});

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<PartnerType>().notNull(),
  contact: text("contact").notNull().default(""),
  city: text("city").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt,
});

export interface OrderSnapshot {
  name: string;
  description: string;
  features: Feature[];
  spec: ProductSpec;
  nodes: ProjectNode[];
  design: DesignConfig;
  compiled: Compiled;
  firmware: Firmware | null;
  previewAssetId: string | null;
  version: number;
}

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(), // CRF-1042
    userId: text("user_id").notNull().references(() => users.id),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** Frozen copy of the design at checkout, so later edits never change what gets built. */
    snapshot: jsonb("snapshot").$type<OrderSnapshot>().notNull(),
    tier: text("tier").notNull(),
    qty: integer("qty").notNull(),
    unitInr: integer("unit_inr").notNull(),
    subtotalInr: integer("subtotal_inr").notNull(),
    shippingInr: integer("shipping_inr").notNull(),
    taxInr: integer("tax_inr").notNull(),
    totalInr: integer("total_inr").notNull(),
    shipping: jsonb("shipping").$type<ShippingAddress>().notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").$type<"simulated" | "paid" | "refunded">().notNull().default("simulated"),
    status: text("status").$type<OrderStatus>().notNull().default("confirmed"),
    designerId: text("designer_id").references(() => partners.id, { onDelete: "set null" }),
    printerId: text("printer_id").references(() => partners.id, { onDelete: "set null" }),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    etaFrom: timestamp("eta_from", { withTimezone: true }).notNull(),
    etaTo: timestamp("eta_to", { withTimezone: true }).notNull(),
    /** Minutes of human engineering time logged against this order: the metric the business tracks. */
    humanMinutes: integer("human_minutes").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index("orders_user_idx").on(t.userId, t.createdAt), index("orders_status_idx").on(t.status)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").$type<"stage" | "note" | "handoff" | "tracking">().notNull(),
    stage: text("stage").$type<OrderStatus>(),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    /** Internal events are only shown to admins. */
    internal: boolean("internal").notNull().default(false),
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull().default("Craftr"),
    createdAt,
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);
