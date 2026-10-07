import type { Compiled, DesignConfig, Feature, Firmware, OrderStatus, PartnerType, ProductSpec, ProjectNode } from "@craftr/core";

export interface Me {
  id: string;
  email: string;
  name: string;
  imageUrl: string | null;
  role: "user" | "admin";
  savedAddress: Address | null;
  credits: number;
  plan: "free" | "maker" | "studio";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  changes: string[];
  createdAt: string;
}

export interface Variant {
  assetId: string;
  style: DesignConfig["style"];
  color: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  description: string;
  origin: "prompt" | "template" | "blocks";
  features: Feature[];
  spec: ProductSpec;
  nodes: ProjectNode[];
  design: DesignConfig;
  compiled: Compiled;
  firmware: Firmware | null;
  gen: { step: number; error: string | null; startedAt: string | null; plan: string[] };
  previewAssetId: string | null;
  variants: Variant[];
  version: number;
  updatedAt: string;
  messages?: Message[];
  ai?: { chat: boolean; images: boolean };
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  previewAssetId: string | null;
  design: DesignConfig;
  gen: Project["gen"];
  origin: Project["origin"];
  updatedAt: string;
  unitInr: number;
  outer: { w: number; h: number; d: number };
  blockCount: number;
}

export interface TemplateSummary {
  id: string;
  name: string;
  tagline: string;
  description: string;
  prompt: string;
  features: Feature[];
  blocks: string[];
  design: DesignConfig;
  shape: "box" | "round";
  outer: { w: number; h: number; d: number };
  unitInr: number;
  battery: string;
  previewAssetId: string | null;
}

export interface Address {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pin: string;
}

export interface OrderEvent {
  id: string;
  type: "stage" | "note" | "handoff" | "tracking";
  stage: OrderStatus | null;
  title: string;
  note: string;
  internal: boolean;
  actorName: string;
  createdAt: string;
}

export interface Snapshot {
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

export interface OrderBase {
  id: string;
  number: string;
  projectId: string | null;
  tier: string;
  qty: number;
  unitInr: number;
  subtotalInr: number;
  shippingInr: number;
  taxInr: number;
  totalInr: number;
  shipping: Address;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  carrier: string | null;
  trackingNumber: string | null;
  etaFrom: string;
  etaTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary extends OrderBase {
  name: string;
  description?: string;
  previewAssetId: string | null;
  customer?: { name: string; email: string };
  designerId?: string | null;
  printerId?: string | null;
  humanMinutes?: number;
}

export interface Order extends OrderBase {
  snapshot: Snapshot;
  events: OrderEvent[];
}

export interface AdminOrder extends Order {
  designerId: string | null;
  printerId: string | null;
  humanMinutes: number;
  customer: { id: string; name: string; email: string };
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  contact: string;
  city: string;
  phone: string;
  website: string;
  address: string;
  notes: string;
  active: boolean;
}

/** A print shop found by the web search, not yet saved as a partner. */
export interface FoundShop {
  name: string;
  area: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  services: string;
  note: string;
  source: string;
}
