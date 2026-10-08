import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BLOCKS, catalogForPrompt, composeFirmware, getBlock, type Compiled, type Firmware, type ProductSpec, type ProjectNode } from "@craftr/core";
import { z } from "zod";
import { env } from "../env";

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: env.anthropicKey }));
export const hasClaude = () => !!env.anthropicKey;

const ICONS = ["wifi", "bluetooth", "droplet", "thermometer", "mic", "monitor", "battery-full", "sun", "map-pin", "magnet", "bell", "move-3d", "lightbulb", "volume-2", "smartphone", "zap", "leaf", "timer", "radar", "sparkles"] as const;

const SpecSchema = z.object({
  use_case: z.string(),
  dimensions: z.string(),
  target_cost_inr: z.number().nullable(),
  power_source: z.enum(["battery", "usb", "solar_battery"]),
  battery_target: z.string(),
  battery_target_hours: z.number().nullable(),
  duty: z.enum(["always_on", "periodic", "event_driven"]),
  connectivity: z.array(z.string()),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  environment: z.string(),
  mounting: z.string(),
  enclosure_style: z.string(),
  manufacturing_method: z.string(),
});

const DesignSchema = z.object({
  name: z.string(),
  description: z.string(),
  reply: z.string(),
  blocks: z.array(z.object({ block_id: z.string(), reason: z.string() })),
  spec: SpecSchema,
  enclosure: z.object({ shape: z.enum(["box", "round", "card"]), pocket_cards: z.number(), style: z.enum(["minimal", "rugged", "compact"]), color: z.string(), face_color: z.string(), stand: z.boolean(), material: z.enum(["PLA", "ABS", "PETG", "PC"]) }),
  features: z.array(z.object({ icon: z.enum(ICONS), label: z.string() })),
  plan: z.object({ components: z.string(), enclosure: z.string(), firmware: z.string(), bom: z.string(), manufacturing: z.string() }),
});
export type ProductDesign = z.infer<typeof DesignSchema>;

const SYSTEM = `You are Craftr's product engineer. Craftr turns a plain-English idea into a small electronic device that can actually be built: off-the-shelf modules wired to an ESP32, inside a 3D-printed enclosure. No custom PCBs.

The people you work with understand products and software but not hardware. Speak in outcomes ("lasts about two weeks on a charge"), never in GPIO numbers or part jargon unless asked.

You may only use blocks from this catalogue. Never invent a part. If the idea needs something the catalogue lacks, build the closest device you can and say plainly what is missing.

Catalogue (id | name | category | price | size | interface | tags | description):
${catalogForPrompt()}

Engineering rules that Craftr's validator enforces after you answer, so follow them now:
- Exactly one controller (category mcu). Prefer a tiny board for small or battery devices, and an S3 board when there is audio.
- A battery needs the charger_tp4056 block, unless the controller has the onboard_charger tag.
- Only one I2S microphone, one I2S speaker, one serial device and one SPI display per device. Never two blocks with the same I2C address.
- Small controllers have few pins; do not overload them.
- Pick the smallest battery that meets the stated battery life, and say what the tradeoff is.
- To charge a phone the device needs magsafe_charger, powerbank_module and a power bank cell: lipo_5000 (6.5 mm thick, the slim default), lipo_10000 (12 mm) or lipo_20000 (24 mm, a brick). Use the capacity the customer asks for; when they give none use lipo_5000, and say in the reply that 10000 and 20000 mAh are available and how much thicker they make it. lipo_3000 is only for when they ask for the thinnest possible. magsafe_charger already contains the magnet ring, so never add magsafe_ring beside it, and powerbank_module replaces charger_tp4056.
- The enclosure generator can make exactly this and nothing else: a box, a round puck or a phone-back card; openings for the chosen parts; and, on the card shape, an outside card pocket. Never promise a strap, clip, hinge, lens, cable channel or any other feature in the description, reply or plan. If the idea needs one, say it is not available yet.
- Add only what the idea needs. Fewer blocks means a cheaper, smaller device that is more likely to work first time.`;

async function parse<T extends z.ZodType>(schema: T, system: string, user: string, effort: "low" | "medium"): Promise<z.infer<T>> {
  const res = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort, format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request. Try describing the product differently.");
  if (!res.parsed_output) throw new Error("The model returned something Craftr could not read. Try again.");
  return res.parsed_output;
}

export function designProduct(prompt: string): Promise<ProductDesign> {
  return parse(
    DesignSchema,
    SYSTEM,
    `Design this product:\n\n<idea>\n${prompt}\n</idea>\n\nReturn:
- name: a short product name in Title Case.
- description: one or two sentences a customer would read, describing what it does.
- reply: one friendly sentence confirming what you are about to build, plus any assumption you had to make. Shown in the chat.
- blocks: the catalogue blocks to use, each with a one-line reason.
- spec: the structured product spec. battery_target_hours is the battery life the user wants in hours, or null when it runs from USB. duty is how the device behaves: always_on, periodic (wakes every few minutes, sleeps in between) or event_driven (sleeps until a button or motion).
- enclosure: shape, pocket_cards, style, a hex colour that suits the product, face_color, stand, and a print material. stand is true only for a box that is read on a desk or shelf (clocks, displays, monitors): it adds a wedge underneath so the face leans back 12 degrees towards the reader. It is false for anything handheld, worn, flipped over, wall-mounted, stuck in soil, or any round or card shape. The front is a flat panel set into the body and printed as its own part: face_color is its hex colour, or an empty string to match the body. A near-black panel (#1B1B1A) on a light body hides a screen and its sensors behind one dark face and usually looks best on anything with a display; use a matching panel for plain objects. Shape is "card" for anything that lies flat on the back of a phone or is carried like a wallet (wallets, battery packs, card holders): a 66 × 102 mm slab as thin as the parts allow. Shape is "round" for pucks, dials and coin-like things. Otherwise "box". pocket_cards is how many bank cards an outside pocket should hold (1 to 3) and is only possible on the card shape; use 0 when there is no pocket.
- features: three to five short chips for the summary card.
- plan: one short line per step describing what Craftr will do for this specific product.`,
    "medium",
  );
}

const EditSchema = z.object({
  reply: z.string(),
  changes: z.array(z.string()),
  add_blocks: z.array(z.string()),
  remove_blocks: z.array(z.string()),
  name: z.string().nullable(),
  description: z.string().nullable(),
  design: z.object({
    shape: z.enum(["box", "round", "card"]).nullable(),
    pocket_cards: z.number().nullable(),
    style: z.enum(["minimal", "rugged", "compact"]).nullable(),
    material: z.enum(["PLA", "ABS", "PETG", "PC"]).nullable(),
    color: z.string().nullable(),
    face_color: z.string().nullable(),
    stand: z.boolean().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    depth: z.number().nullable(),
  }),
  spec: z.object({
    power_source: z.enum(["battery", "usb", "solar_battery"]).nullable(),
    battery_target: z.string().nullable(),
    battery_target_hours: z.number().nullable(),
    duty: z.enum(["always_on", "periodic", "event_driven"]).nullable(),
  }),
  rewrite_firmware: z.boolean(),
});
export type ProductEdit = z.infer<typeof EditSchema>;

export interface ProjectContext {
  name: string;
  description: string;
  spec: ProductSpec;
  nodes: ProjectNode[];
  design: { shape?: string; style: string; material: string; color: string };
  compiled: Compiled;
}

function describe(p: ProjectContext): string {
  const { outer, minOuter } = p.compiled.layout;
  return `Product: ${p.name}
Description: ${p.description}
Blocks in the design: ${p.nodes.map((n) => n.blockId).join(", ") || "(none)"}
Enclosure: ${p.design.shape ?? "box"}, ${p.design.style}, ${p.design.material}, colour ${p.design.color}, ${outer.w} × ${outer.h} × ${outer.d} mm (smallest possible with these parts: ${minOuter.w} × ${minOuter.h} × ${minOuter.d} mm)
Power: ${p.compiled.power.batteryLabel}, average ${p.compiled.power.avgMa} mA, behaviour ${p.spec.duty}
Prototype price: ₹${p.compiled.pricing.unitInr} (parts ₹${p.compiled.pricing.bomInr})
Validator: ${p.compiled.checks.filter((c) => c.level !== "ok").map((c) => `[${c.level}] ${c.title}: ${c.detail}`).join(" | ") || "all checks pass"}`;
}

export function editProduct(project: ProjectContext, history: { role: "user" | "assistant"; content: string }[], message: string): Promise<ProductEdit> {
  const past = history.slice(-8).map((m) => `${m.role === "user" ? "Customer" : "Craftr"}: ${m.content}`).join("\n");
  return parse(
    EditSchema,
    SYSTEM,
    `Current design:\n${describe(project)}\n\nConversation so far:\n${past || "(none)"}\n\nThe customer now says:\n<message>\n${message}\n</message>\n\nDecide what to change. Return:
- reply: what you did and the tradeoff it carries, in one to three plain sentences. If they only asked a question, answer it and change nothing. If a validator error exists, fix it or explain it.
- changes: a short list of the concrete changes, for example "Swapped the 1000 mAh battery for 2000 mAh". Empty when nothing changed.
- add_blocks / remove_blocks: catalogue ids. To swap a part, remove the old id and add the new one.
- name, description: new values, or null to keep them.
- design: only the fields to change, null for the rest. stand adds or removes the wedge that leans a box back on a desk. face_color is the hex colour of the front panel, or an empty string to make it match the body. Shape is box, round (a puck whose diameter is its width) or card (a 66 × 102 mm phone-back slab, which is the only shape that can carry pocket_cards). Width, height and depth are outer millimetres; set them only when the customer asks for a size, and never below the smallest possible size.
- spec: only the fields to change, null for the rest.
- rewrite_firmware: true when the device should behave differently, not merely when parts change (Craftr rewires and regenerates driver code on its own).`,
    "low",
  );
}

const stripFence = (s: string) => s.replace(/^\s*```[a-zA-Z+]*\n/, "").replace(/\n```\s*$/, "").trim() + "\n";

export async function writeFirmware(input: { name: string; description: string; nodes: ProjectNode[]; spec: ProductSpec; compiled: Compiled; language: Firmware["language"]; instructions?: string }): Promise<Firmware> {
  const baseline = composeFirmware(input).files[0].content;
  const wiring = input.nodes
    .map((n) => {
      const b = getBlock(n.blockId);
      const pins = input.compiled.pinmap[n.id];
      return b ? `- ${b.name} (${b.subtitle}): ${pins ? Object.entries(pins).map(([k, v]) => `${k}=${v}`).join(", ") : "no signal pins"}` : null;
    })
    .filter(Boolean)
    .join("\n");
  const arduino = input.language === "arduino";
  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    output_config: { effort: "low" },
    system: `You write firmware for small ESP32 devices built from off-the-shelf modules. The code must run on real hardware first time: use only widely available libraries, keep it in one file, handle sensor and network failures without crashing, and comment it briefly for a reader who is new to embedded code. Aim for under 250 lines: working behaviour matters more than completeness. Use exactly the pins you are given. Reply with the source file only: no prose, no markdown fences.`,
    messages: [
      {
        role: "user",
        content: `Write the ${arduino ? "Arduino C++ (ESP32 Arduino core) sketch" : "MicroPython main.py"} for this product.

Product: ${input.name}
What it does: ${input.description}
Use case: ${input.spec.use_case}
Behaviour: ${input.spec.duty}${input.spec.duty === "periodic" ? " (wake, measure, report, deep-sleep)" : input.spec.duty === "event_driven" ? " (idle until the user or a sensor triggers it)" : ""}
Connectivity: ${input.spec.connectivity.join(", ") || "none"}
Inputs: ${input.spec.inputs.join(", ") || "none"}
Outputs: ${input.spec.outputs.join(", ") || "none"}
${input.instructions ? `Extra instructions from the customer: ${input.instructions}\n` : ""}
Wiring (already assigned and validated, do not change):
${wiring}

Here is a baseline composed from each module's verified MicroPython driver snippet. The pins and driver calls in it are correct. ${arduino ? "Port it to Arduino C++ with the equivalent standard libraries, and" : "Keep those driver calls, and"} turn it into the actual product behaviour described above:

${baseline}`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined to write this firmware.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (!text.trim()) throw new Error("The model returned no firmware.");
  return { language: input.language, files: [{ name: arduino ? "main.ino" : "main.py", content: stripFence(text) }], source: "ai", generatedAt: new Date().toISOString() };
}

/** Used when there is no Anthropic key: matches words in the idea to block tags, so the app still works end to end. */
export function designByKeywords(prompt: string): ProductDesign {
  const p = prompt.toLowerCase();
  const has = (...w: string[]) => w.some((x) => p.includes(x));
  const ids = new Set<string>();
  const audio = has("voice", "microphone", "mic ", "record", "audio", "speaker", "sound");
  const small = has("small", "tiny", "magsafe", "wearable", "pocket", "keychain", "tracker");
  if (has("soil", "plant", "irrigation", "garden")) ids.add("soil_moisture");
  if (has("temperature", "climate", "weather", "plant", "humidity")) ids.add(has("precise", "accurate") ? "sht31" : "dht22");
  if (has("light sensor", "brightness", "lux")) ids.add("bh1750");
  if (has("motion", "tilt", "flip", "shake", "cube", "step")) ids.add("mpu6050");
  if (has("presence", "pir", "door", "someone", "intruder", "pet")) ids.add("pir");
  if (has("voice", "microphone", "mic ", "record")) ids.add("mic_inmp441");
  if (has("button", "press", "click", "voice")) ids.add("button");
  if (has("knob", "dial")) ids.add("rotary_encoder");
  if (has("screen", "display", "oled", "show", "clock")) ids.add("oled_096");
  if (has("glow", "rgb", "light ring", "lamp", "timer", "pomodoro")) ids.add("rgb_led");
  if (has("led", "indicator", "voice")) ids.add("led");
  if (has("beep", "buzz", "alarm", "alert", "timer", "pomodoro")) ids.add("buzzer");
  if (has("speaker", "play", "talk")) ids.add("speaker_amp");
  if (has("gps", "location", "track")) ids.add("gps");
  if (has("magsafe")) ids.add("magsafe_ring");
  const solar = has("solar");
  const battery = solar || has("battery", "rechargeable", "portable", "wireless", "magsafe", "tracker", "wearable", "plant", "outdoor");
  const mcu = audio ? (small ? "xiao_esp32s3" : "esp32_s3_devkit") : small ? "esp32_c3_supermini" : "esp32_devkit";
  ids.add(mcu);
  if (battery) {
    ids.add(small ? "lipo_500" : "lipo_1000");
    if (!getBlock(mcu)!.tags.includes("onboard_charger")) ids.add("charger_tp4056");
  }
  if (solar) ids.add("solar_panel");
  const subject = prompt.replace(/^(make|build|create|design)( me)?( a| an)?/i, "").replace(/^\s*(a|an)\s+/i, "").trim().split(/\s+(that|which|with|to|for)\s+/i)[0].slice(0, 40) || "Device";
  const name = subject.replace(/\b\w/g, (c) => c.toUpperCase());
  const periodic = has("monitor", "log", "weather", "plant");
  return {
    name,
    description: prompt.trim().replace(/^\w/, (c) => c.toUpperCase()),
    reply: `Got it! Here's a plan for your ${subject.toLowerCase()}. (No Anthropic key is configured, so blocks were picked by keyword matching, not by Claude.)`,
    blocks: [...ids].map((block_id) => ({ block_id, reason: "Matched from the description" })),
    spec: {
      use_case: prompt.trim(),
      dimensions: small ? "Pocket sized" : "As small as the parts allow",
      target_cost_inr: null,
      power_source: solar ? "solar_battery" : battery ? "battery" : "usb",
      battery_target: battery ? "A few days" : "",
      battery_target_hours: battery ? 48 : null,
      duty: periodic ? "periodic" : has("button", "voice", "flip", "press") ? "event_driven" : "always_on",
      connectivity: has("bluetooth", "phone") ? ["Bluetooth LE", "Wi-Fi"] : ["Wi-Fi"],
      inputs: [...ids].map((i) => getBlock(i)!).filter((b) => b.group === "Input").map((b) => b.name),
      outputs: [...ids].map((i) => getBlock(i)!).filter((b) => b.group === "Output").map((b) => b.name),
      environment: has("outdoor", "garden", "solar") ? "Outdoor" : "Indoor",
      mounting: has("magsafe") ? "MagSafe" : "Freestanding",
      enclosure_style: small ? "compact" : "minimal",
      manufacturing_method: "FDM 3D printing",
    },
    enclosure: { shape: has("wallet", "power bank", "powerbank", "card holder") ? "card" : has("magsafe", "puck", "round") ? "round" : "box", pocket_cards: has("wallet", "card holder") ? 2 : 0, style: small ? "compact" : "minimal", color: "#F2EBDD", face_color: "", stand: false, material: "PETG" },
    features: [],
    plan: { components: "Choose sensors, MCU, power, and connectivity modules", enclosure: "Create a compact enclosure around the parts", firmware: "Read sensors and drive outputs", bom: "Estimate prototype cost and source parts", manufacturing: "Finalize design files and manufacturing plan" },
  };
}

export const KNOWN_BLOCK_IDS = new Set(BLOCKS.map((b) => b.id));
