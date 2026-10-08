import { getBlock } from "./blocks";
import { COLORS } from "./layout";
import type { DesignConfig, Feature, ProductSpec, ProjectDoc, ProjectNode } from "./types";

export const DEFAULT_DESIGN: DesignConfig = { style: "slim", material: "rPETG", color: COLORS[0], auto: true, width: 60, height: 60, depth: 30 };

export const DEFAULT_SPEC: ProductSpec = {
  use_case: "",
  dimensions: "As small as the parts allow",
  target_cost_inr: null,
  power_source: "usb",
  battery_target: "",
  battery_target_hours: null,
  duty: "always_on",
  connectivity: ["Wi-Fi"],
  inputs: [],
  outputs: [],
  environment: "Indoor",
  mounting: "Freestanding",
  enclosure_style: "minimal",
  manufacturing_method: "FDM 3D printing",
};

/** Spreads blocks around the controller for the Build with Blocks canvas. */
export function arrange(nodes: ProjectNode[]): ProjectNode[] {
  const isMcu = (n: ProjectNode) => getBlock(n.blockId)?.iface === "mcu";
  const order = ["Input", "Output", "Connect", "Power"];
  const others = nodes.filter((n) => !isMcu(n)).sort((a, b) => order.indexOf(getBlock(a.blockId)?.group ?? "") - order.indexOf(getBlock(b.blockId)?.group ?? ""));
  const r = others.length > 6 ? 360 : 300;
  return [
    ...nodes.filter(isMcu).map((n, i) => ({ ...n, x: i * 40, y: i * 40 })),
    ...others.map((n, i) => {
      const a = -Math.PI * 0.75 + (i / Math.max(1, others.length)) * Math.PI * 2;
      return { ...n, x: Math.round(Math.cos(a) * r * 1.25), y: Math.round(Math.sin(a) * r * 0.85) };
    }),
  ];
}

export const nodesFromBlocks = (blockIds: string[]): ProjectNode[] =>
  arrange(blockIds.filter((id) => getBlock(id)).map((blockId, i) => ({ id: `n${i + 1}`, blockId, x: 0, y: 0 })));

export function nextNodeId(nodes: ProjectNode[]): string {
  const max = nodes.reduce((m, n) => Math.max(m, Number(n.id.replace(/\D/g, "")) || 0), 0);
  return `n${max + 1}`;
}

const FEATURE_FOR: [string, Feature][] = [
  ["wifi", { icon: "wifi", label: "Wi-Fi" }],
  ["soil_moisture", { icon: "droplet", label: "Soil Moisture" }],
  ["temperature", { icon: "thermometer", label: "Temperature" }],
  ["microphone", { icon: "mic", label: "Microphone" }],
  ["display", { icon: "monitor", label: "Display" }],
  ["motion", { icon: "move-3d", label: "Motion" }],
  ["gps", { icon: "map-pin", label: "GPS" }],
  ["magsafe", { icon: "magnet", label: "MagSafe" }],
  ["battery", { icon: "battery-full", label: "Rechargeable" }],
  ["solar", { icon: "sun", label: "Solar" }],
];

export function deriveFeatures(nodes: ProjectNode[]): Feature[] {
  const tags = new Set(nodes.flatMap((n) => getBlock(n.blockId)?.tags ?? []));
  return FEATURE_FOR.filter(([t]) => tags.has(t)).map(([, f]) => f).slice(0, 5);
}

export interface Template extends ProjectDoc {
  id: string;
  prompt: string;
  tagline: string;
}

const tpl = (t: Omit<Template, "nodes" | "design" | "spec" | "features"> & { blocks: string[]; design?: Partial<DesignConfig>; spec: Partial<ProductSpec> }): Template => {
  const nodes = nodesFromBlocks(t.blocks);
  const { blocks: _b, design, spec, ...rest } = t;
  return { ...rest, nodes, design: { ...DEFAULT_DESIGN, ...design }, spec: { ...DEFAULT_SPEC, ...spec }, features: deriveFeatures(nodes) };
};

/** Proven Builds: designs that go through the same compiler as everything else, no model needed. */
export const TEMPLATES: Template[] = [
  tpl({
    id: "magsafe-voice-note",
    name: "MagSafe Voice Note",
    tagline: "Hold the button, speak, and the note lands on your phone.",
    prompt: "Make me a small MagSafe voice-note device with one button, rechargeable battery, microphone, and phone sync.",
    description: "A puck that snaps to the back of your phone. Hold the button to record a voice note; it syncs over Bluetooth when you let go.",
    blocks: ["xiao_esp32s3", "mic_inmp441", "button", "led", "lipo_500", "magsafe_ring"],
    design: { shape: "round", style: "slim", color: "#F2EBDD", face: "#1B1B1A", material: "rPETG" },
    spec: { use_case: "Capture voice notes with one press and sync them to a phone", power_source: "battery", battery_target: "1 week of normal use", battery_target_hours: 72, duty: "event_driven", connectivity: ["Bluetooth LE", "Wi-Fi"], inputs: ["Button", "Microphone"], outputs: ["Status LED"], mounting: "MagSafe, back of phone", enclosure_style: "compact" },
  }),
  tpl({
    id: "magsafe-wallet-power-bank",
    name: "MagSafe Wallet Power Bank",
    tagline: "Carries your cards and tops up your phone.",
    prompt: "I want a MagSafe wallet plus power bank for my iPhone.",
    description: "A slab that snaps to the back of your iPhone, holds two cards in a front pocket and wirelessly tops up the phone from its own battery. Recharges over USB-C.",
    blocks: ["esp32_c3_supermini", "magsafe_charger", "powerbank_module", "lipo_5000", "led"],
    design: { shape: "card", pocketCards: 2, style: "slim", color: "#3F4043", material: "rPETG" },
    spec: { use_case: "Carry cards and wirelessly top up an iPhone", power_source: "battery", battery_target: "", battery_target_hours: null, duty: "event_driven", connectivity: ["Bluetooth LE"], inputs: [], outputs: ["Status LED", "Wireless phone charging"], mounting: "MagSafe, back of phone", enclosure_style: "compact" },
  }),
  tpl({
    id: "smart-plant-monitor",
    name: "Smart Plant Monitor",
    tagline: "Tells you when your plant needs water.",
    prompt: "Build a smart plant monitor that measures soil moisture and sends data to my phone.",
    description: "A Wi-Fi connected plant monitor that measures soil moisture and temperature and sends data to your phone, all in a compact enclosure.",
    blocks: ["esp32_c3_supermini", "soil_moisture", "sht31", "oled_096", "lipo_1000", "charger_tp4056"],
    design: { style: "slim", color: "#F2EBDD", face: "#1B1B1A", material: "rPETG" },
    spec: { use_case: "Monitor soil moisture and temperature for a house plant", power_source: "battery", battery_target: "2 weeks", battery_target_hours: 336, duty: "periodic", connectivity: ["Wi-Fi"], inputs: ["Soil moisture", "Temperature", "Humidity"], outputs: ["OLED display", "Phone notifications"], environment: "Indoor, near soil and water", mounting: "Stakes into the pot" },
  }),
  tpl({
    id: "pomodoro-cube",
    name: "Pomodoro Cube",
    tagline: "Flip it to start a focus session.",
    prompt: "Make me a physical focus timer cube that starts when I flip it and glows as time runs out.",
    description: "A focus timer you flip to start. The light ring drains as the session runs and a soft beep tells you when to take a break.",
    blocks: ["esp32_c3_supermini", "mpu6050", "rgb_led", "buzzer", "lipo_500", "charger_tp4056"],
    // A true cube, so it sits the same way on every face.
    design: { style: "minimal", color: "#D9B98E", material: "rPLA", auto: false, width: 52, height: 52, depth: 52 },
    spec: { use_case: "Tabletop focus timer controlled by orientation", power_source: "battery", battery_target: "1 week", battery_target_hours: 40, duty: "event_driven", connectivity: ["Bluetooth LE"], inputs: ["Orientation"], outputs: ["Light ring", "Beep"], mounting: "Sits on a desk" },
  }),
  tpl({
    id: "room-climate-display",
    name: "Room Climate Display",
    tagline: "Temperature and humidity at a glance.",
    prompt: "A small desk display that shows room temperature and humidity and logs it over Wi-Fi.",
    description: "A USB-powered desk display with a precise climate sensor. Shows temperature and humidity and logs them over Wi-Fi.",
    blocks: ["esp32_c3_supermini", "sht31", "oled_096", "bh1750"],
    // Landscape, like a small desk clock.
    design: { style: "slim", color: "#5FA052", face: "#1B1B1A", stand: true, material: "rPLA" },
    spec: { use_case: "Show and log room temperature and humidity", power_source: "usb", duty: "always_on", connectivity: ["Wi-Fi"], inputs: ["Temperature", "Humidity", "Ambient light"], outputs: ["OLED display"], mounting: "Sits on a desk" },
  }),
  // ───────── Simple lifestyle builds: few parts, an afternoon each ─────────
  tpl({
    id: "motion-night-light",
    name: "Motion Night Light",
    tagline: "Glows softly when you walk past in the dark.",
    prompt: "Make a night light that turns on when someone walks past, but only when the room is dark.",
    description: "A small light for a hallway or bedside. It senses movement and the room's brightness, and glows warm for a minute when you pass in the dark. Plugs into any USB-C charger.",
    blocks: ["esp32_c3_supermini", "pir", "bh1750", "rgb_led"],
    design: { style: "slim", color: "#F2EBDD", material: "rPLA" },
    spec: { use_case: "Light a hallway or bedside when someone passes at night", power_source: "usb", duty: "event_driven", connectivity: [], inputs: ["Motion", "Room brightness"], outputs: ["Warm light"], environment: "Indoor", mounting: "Sits on a shelf or sticks to a wall" },
  }),
  tpl({
    id: "wifi-desk-clock",
    name: "Wi-Fi Desk Clock",
    tagline: "Always the right time, no setting it.",
    prompt: "Build a small desk clock that sets itself over Wi-Fi and shows the time and date.",
    description: "A little clock that leans back on your desk and keeps exact time from the internet. Press the button to switch between time, date and a timer. Plugs into USB-C.",
    blocks: ["esp32_c3_supermini", "oled_096", "button"],
    design: { style: "slim", color: "#D9B98E", face: "#1B1B1A", stand: true, material: "rPLA" },
    spec: { use_case: "Show the time and date on a desk", power_source: "usb", duty: "always_on", connectivity: ["Wi-Fi"], inputs: ["Button"], outputs: ["OLED display"], environment: "Indoor desk", mounting: "Leans back on its feet" },
  }),
  tpl({
    id: "mood-light-puck",
    name: "Mood Light",
    tagline: "Tap to change the colour of the room.",
    prompt: "Make a small rechargeable mood light I can tap to change colours.",
    description: "A palm-sized rechargeable light. Tap the button to step through colours, hold it to dim. Runs for a few hours on a charge.",
    blocks: ["esp32_c3_supermini", "rgb_led", "button", "lipo_500", "charger_tp4056"],
    design: { shape: "round", style: "slim", color: "#C9C9C6", material: "rPLA" },
    spec: { use_case: "Ambient coloured light for a room or bedside", power_source: "battery", battery_target: "3 hours of light", battery_target_hours: 3, duty: "always_on", connectivity: [], inputs: ["Button"], outputs: ["Coloured light"], environment: "Indoor", mounting: "Sits on a table" },
  }),
  tpl({
    id: "decision-cube",
    name: "Shake to Decide",
    tagline: "Shake it for an answer.",
    prompt: "Make a little pocket gadget I can shake to get a random answer, a dice roll or a coin flip.",
    description: "A slim pocket slab for settling things. Shake it and the screen shows a dice roll, a coin flip or a yes or no. Rechargeable over USB-C.",
    blocks: ["esp32_c3_supermini", "mpu6050", "oled_096", "lipo_500", "charger_tp4056"],
    design: { style: "slim", color: "#5FA052", face: "#1B1B1A", material: "rPLA" },
    spec: { use_case: "Give a random answer when shaken", power_source: "battery", battery_target: "2 days", battery_target_hours: 48, duty: "event_driven", connectivity: [], inputs: ["Shake"], outputs: ["OLED display"], environment: "Indoor, handheld", mounting: "Held in the hand" },
  }),
  tpl({
    id: "water-reminder",
    name: "Water Reminder",
    tagline: "Nudges you to drink through the day.",
    prompt: "Make something that sits on my desk and reminds me to drink water every hour.",
    description: "A desk puck that glows blue and gives a short buzz every hour until you tap it. Tap when you drink, and the ring fills up through the day.",
    blocks: ["esp32_c3_supermini", "rgb_led", "vibration_motor", "button", "lipo_500", "charger_tp4056"],
    design: { shape: "round", style: "slim", color: "#F2EBDD", material: "rPLA" },
    spec: { use_case: "Remind someone to drink water at regular intervals", power_source: "battery", battery_target: "3 days", battery_target_hours: 72, duty: "periodic", connectivity: [], inputs: ["Button"], outputs: ["Light ring", "Vibration"], environment: "Indoor desk", mounting: "Sits on a desk" },
  }),
  tpl({
    id: "busy-light",
    name: "Busy Light",
    tagline: "Turn the dial: free, busy or do not disturb.",
    prompt: "Make a desk light that shows whether I am free or busy, set with a dial.",
    description: "A light for your desk or door. Turn the dial to green, amber or red so people know whether they can interrupt. Plugs into USB-C.",
    blocks: ["esp32_c3_supermini", "rgb_led", "rotary_encoder"],
    design: { style: "slim", color: "#3F4043", material: "rPLA" },
    spec: { use_case: "Show availability to people nearby", power_source: "usb", duty: "always_on", connectivity: [], inputs: ["Dial"], outputs: ["Coloured light"], environment: "Indoor desk", mounting: "Sits on a desk" },
  }),
];
