import { getBlock, type BlockDef, type Compiled, type DesignConfig, type ProjectNode } from "@craftr/core";
import { assets, db } from "@craftr/db";
import { nanoid } from "nanoid";
import OpenAI, { toFile } from "openai";
import { env } from "../env";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: env.openaiKey, timeout: 180_000, maxRetries: 0 }));
export const hasImages = () => !!env.openaiKey;


const COMMON = { size: "1024x1024", quality: "medium", output_format: "webp", output_compression: 85 } as const;

/** Makes one image. With a reference picture the model redraws that exact object instead of inventing one. */
async function generate(kind: "preview" | "variant" | "block", ref: string, prompt: string, opts: { transparent?: boolean; reference?: Buffer } = {}): Promise<string> {
  const res = opts.reference
    ? await openai().images.edit({ model: env.imageModel, image: await toFile(opts.reference, "model.png", { type: "image/png" }), prompt, input_fidelity: "high", ...COMMON })
    : await openai().images.generate({ model: env.imageModel, prompt, background: opts.transparent ? "transparent" : "opaque", n: 1, ...COMMON });
  const data = res.data?.[0]?.b64_json;
  if (!data) throw new Error("The image model returned no image.");
  const id = nanoid(16);
  await db().insert(assets).values({ id, kind, ref, mime: "image/webp", data });
  return id;
}

/** Decodes the browser's snapshot of the 3D model. Returns nothing for anything that is not a modest PNG. */
export function decodeReference(dataUrl: unknown): Buffer | undefined {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > 6_000_000) return undefined;
  const buf = Buffer.from(dataUrl.slice(22), "base64");
  return buf.length > 1000 && buf.subarray(1, 4).toString() === "PNG" ? buf : undefined;
}

const COLOR_NAME: Record<string, string> = { "#F2EBDD": "warm cream", "#5FA052": "leaf green", "#D9B98E": "soft tan", "#C9C9C6": "light grey", "#3F4043": "charcoal" };
const STYLE_LOOK = { minimal: "clean, with soft rounded edges", rugged: "sturdy, with thick walls", compact: "slim and tight-fitting" };

/** Describes what is visible on the outside, from the real layout, so the picture matches the design. */
function exterior(nodes: ProjectNode[], compiled: Compiled): string {
  const seen = new Set<string>();
  const bits: string[] = [];
  for (const n of nodes) {
    const b = getBlock(n.blockId);
    if (!b || seen.has(b.id)) continue;
    seen.add(b.id);
    if (b.id === "oled_096") bits.push('a small black OLED screen behind a rectangular window, switched on and showing exactly two lines of large, crisp white text: "24°C" on the first line and "62%" on the second, perfectly legible and nothing else on the screen');
    else if (b.category === "display") bits.push("a small colour screen behind a square window, switched on");
    else if (b.id === "button") bits.push("one round push-button cap, flush with the front");
    else if (b.id === "rotary_encoder") bits.push("a round control knob on the front");
    else if (b.id === "led") bits.push("a tiny status LED");
    else if (b.id === "rgb_led") bits.push("a soft warm ring of light glowing through the thin front wall");
    else if (b.id === "mic_inmp441") bits.push("a pinhole microphone opening");
    else if (b.id === "speaker_amp") bits.push("a round speaker opening on the back");
    else if (b.id === "soil_moisture") bits.push("a flat black circuit-board soil probe with a pointed tip extending straight down from the bottom");
    else if (b.id === "solar_panel") bits.push("a small dark solar panel on top");
    else if (b.id === "pir") bits.push("a small white dome sensor on the front");
    else if (b.id === "bh1750") bits.push("a small round light-sensor opening");
  }
  if (compiled.layout.cutouts.some((c) => c.face === "right")) bits.push("a USB-C port on the right side");
  return bits.join("; ");
}

export function renderPrompt(p: { name: string; description: string; nodes: ProjectNode[]; design: DesignConfig; compiled: Compiled }, hasReference: boolean): string {
  const { w, h, d } = p.compiled.layout.outer;
  const round = p.compiled.layout.shape === "round";
  const pocket = p.compiled.layout.pocket;
  const form = round ? `a round puck ${w} mm across and ${d} mm thick` : p.compiled.layout.card ? `a flat slab ${w} × ${h} mm and ${d} mm thick, the size of a bank card, made to sit on the back of a phone` : `a rounded box ${w} × ${h} × ${d} mm`;
  const colour = COLOR_NAME[p.design.color] ?? `colour ${p.design.color}`;
  return `${hasReference ? "The attached image is a plain CAD preview of a real device. Redraw it as a photorealistic studio product photograph of that same object. Keep its exact shape, proportions and viewing angle, and keep every opening, button, screen and port exactly where the preview shows it. Do not add, remove, enlarge or move any feature." : "A photorealistic studio product photograph of a small electronic device, seen from a front three-quarter angle."}

The device: "${p.name}". ${p.description}
It is ${form}: a 3D-printed enclosure in matte ${colour} ${p.design.material} plastic${hasReference ? ", whatever colour the preview uses" : ""}, ${STYLE_LOOK[p.design.style]}, with the fine, slightly grainy surface of a good-quality print and a thin seam where the front cover meets the body. It is small enough to sit in a hand.
Visible details: ${[pocket ? `a shallow card pocket moulded onto the front face with a thumb notch at the top, holding ${pocket.cards} bank card${pocket.cards > 1 ? "s" : ""} that stick out above it` : "", exterior(p.nodes, p.compiled)].filter(Boolean).join("; ") || "clean, plain faces"}.

Shot on a seamless warm off-white backdrop with soft, diffused studio light and a gentle natural shadow underneath. Realistic materials and scale, sharp focus on the device. Nothing else in the frame: no props, no hands, no text, no logos, no labels.`;
}

export const renderPreview = (projectId: string, p: Parameters<typeof renderPrompt>[0], kind: "preview" | "variant" = "preview", reference?: Buffer) => generate(kind, projectId, renderPrompt(p, !!reference), { reference });

export const renderBlock = (b: BlockDef) =>
  generate(
    "block",
    b.id,
    `Soft 3D clay-style icon of an electronics part: ${b.name} (${b.subtitle}). ${b.description} Show it as a single friendly, slightly chunky, accurate miniature of the real module, ${b.size.w} × ${b.size.d} × ${b.size.h} mm in proportion, with its recognisable components and connectors. Three-quarter isometric view, centred with padding, soft studio lighting, smooth matte materials, soft shadow directly underneath only. Transparent background. No text, no labels, no hands.`,
    { transparent: true },
  );
