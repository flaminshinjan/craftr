/**
 * Credits pay for the AI work (planning, firmware, pictures). Hardware orders are priced separately.
 *
 * One credit sells for ₹1. Each action is priced at MARGIN × what it costs Craftr to run,
 * so every plan and pack carries the same margin. `costInr` values are estimates of model spend
 * per action; tune them here as real usage data comes in and every price follows.
 */
export const MARGIN = 5;
export const CREDIT_INR = 1;
export const SIGNUP_CREDITS = 150;

export const ACTIONS = {
  generate: { label: "Build from a prompt", detail: "Plan, components, enclosure and firmware", costInr: 20 },
  chat: { label: "Change something by chat", detail: "One edit request", costInr: 4 },
  firmware: { label: "Rewrite firmware", detail: "Regenerate or switch language", costInr: 10 },
  render: { label: "Product picture", detail: "One photo-style render", costInr: 5 },
  variants: { label: "Colour variants", detail: "Three renders in other colours", costInr: 15 },
} as const;
export type ActionId = keyof typeof ACTIONS;

export const creditsFor = (a: ActionId) => Math.ceil((ACTIONS[a].costInr * MARGIN) / CREDIT_INR);

export interface Plan {
  id: "free" | "maker" | "studio";
  name: string;
  priceInr: number;
  /** Credits added at the start of every billing month. */
  credits: number;
  blurb: string;
  perks: string[];
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", priceInr: 0, credits: 0, blurb: "Try Craftr with your first build on us.", perks: [`${SIGNUP_CREDITS} credits when you sign up`, "Build with Blocks and all manual editing", "Order prototypes at product cost"] },
  { id: "maker", name: "Maker", priceInr: 199, credits: 200, blurb: "For a couple of builds a month.", perks: ["200 credits every month", "About 2 builds from a prompt", "Unused credits roll over while subscribed"] },
  { id: "studio", name: "Studio", priceInr: 499, credits: 500, blurb: "For people shipping hardware regularly.", perks: ["500 credits every month", "About 5 builds from a prompt", "Unused credits roll over while subscribed"] },
];

export interface Pack {
  id: "pack_100" | "pack_500";
  name: string;
  priceInr: number;
  credits: number;
}

export const PACKS: Pack[] = [
  { id: "pack_100", name: "100 credits", priceInr: 99, credits: 100 },
  { id: "pack_500", name: "500 credits", priceInr: 499, credits: 500 },
];

export const getPlan = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0];
