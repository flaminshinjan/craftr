import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../env";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: env.openaiKey, timeout: 240_000, maxRetries: 0 }));

const Shop = z.object({
  name: z.string(),
  area: z.string().describe("Neighbourhood or locality, e.g. Kotturpuram"),
  city: z.string(),
  address: z.string().describe("Street address as published, or an empty string"),
  phone: z.string().describe("Phone number as published, with country code, or an empty string when none was found. Never guess."),
  website: z.string().describe("Their own website, or an empty string"),
  services: z.string().describe("Processes and materials they offer, e.g. FDM, SLA, MJF, PETG. One short line."),
  note: z.string().describe("One sentence on why they suit low-volume electronics enclosures: turnaround, minimum order, rating."),
  source: z.string().describe("The page the phone number or listing was read from"),
});
const Result = z.object({ shops: z.array(Shop) });
export type FoundShop = z.infer<typeof Shop>;

const tidyPhone = (p: string) => (p.replace(/\D/g, "").length >= 8 ? p.replace(/[^\d+\s-]/g, "").trim() : "");
const tidyUrl = (u: string) => (/^https?:\/\/\S+$/.test(u.trim()) ? u.trim() : "");

/** Looks up 3D printing services near a place with a live web search. Phone numbers are whatever the web lists, so they are unverified. */
export async function findPrintShops(location: string): Promise<FoundShop[]> {
  const res = await openai().responses.parse({
    model: env.searchModel,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content:
          "You find 3D printing service bureaus for a hardware prototyping company that sends out small electronics enclosures, 1 to 5 units per design, and needs fast FDM and SLA turnaround. Search the web. Return up to 10 real businesses that print for customers, nearest to the given location first. Skip shops that only sell printers or filament. Every phone number, address and website must come from a page you read; leave a field empty when you could not find it. Never invent or guess a phone number.",
      },
      { role: "user", content: `Location: ${location}` },
    ],
    text: { format: zodTextFormat(Result, "print_shops") },
  });
  const shops = res.output_parsed?.shops ?? [];
  return shops.filter((s) => s.name.trim()).map((s) => ({ ...s, phone: tidyPhone(s.phone), website: tidyUrl(s.website), source: tidyUrl(s.source) }));
}
