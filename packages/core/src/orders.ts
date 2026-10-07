export const ORDER_STAGES = [
  { id: "confirmed", label: "Order confirmed", headline: "Order Confirmed", done: "We've received your order.", active: "We've received your order and are getting it ready for review." },
  { id: "design_review", label: "Design review", headline: "In Design Review", done: "A designer checked your enclosure for printability.", active: "A designer is checking your enclosure and wiring before anything is made." },
  { id: "sourcing", label: "Components sourced", headline: "Sourcing Components", done: "All electronic components have been sourced.", active: "We're sourcing the electronic components for your build." },
  { id: "printing", label: "3D printing enclosure", headline: "In Fabrication", done: "Your enclosure has been printed.", active: "Your order is currently being fabricated. We're 3D printing your enclosure and preparing components." },
  { id: "assembly", label: "Assembly", headline: "In Assembly", done: "All parts assembled and firmware flashed.", active: "We're assembling all parts and flashing the firmware." },
  { id: "testing", label: "Quality testing", headline: "In Quality Testing", done: "Your unit passed its functional tests.", active: "Each unit is being tested for full functionality." },
  { id: "shipping", label: "Shipping", headline: "On Its Way", done: "Your order has shipped.", active: "Your order is packed and on its way to you." },
  { id: "delivered", label: "Delivered", headline: "Delivered", done: "Delivered. Enjoy your build!", active: "Delivered. Enjoy your build!" },
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number]["id"];
export type OrderStatus = OrderStage | "cancelled";
export const STAGE_IDS = ORDER_STAGES.map((s) => s.id) as OrderStage[];
export const stageIndex = (s: string) => STAGE_IDS.indexOf(s as OrderStage);
export const stageMeta = (s: string) => ORDER_STAGES[Math.max(0, stageIndex(s))];

export const PARTNER_TYPES = ["designer", "printer", "assembler", "courier"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const formatInr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
