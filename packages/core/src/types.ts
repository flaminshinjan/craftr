export type BlockCategory = "mcu" | "sensor" | "connectivity" | "power" | "display" | "audio" | "input" | "output" | "other";
export type BlockGroup = "Compute" | "Input" | "Output" | "Connect" | "Power";
export type Iface = "mcu" | "i2c" | "adc" | "gpio" | "i2s_in" | "i2s_out" | "uart" | "spi" | "power" | "none";
export type Mount = "internal" | "front" | "back" | "bottom_external" | "top_external";
export type Face = "front" | "back" | "left" | "right" | "top" | "bottom";

export interface McuPinMap {
  i2c: { sda: number; scl: number };
  adc: number[];
  gpio: number[];
  i2s: { bclk: number; ws: number; din: number; dout: number };
  uart: { tx: number; rx: number };
  spi: { sck: number; mosi: number };
}

export interface BlockPin {
  name: string;
  desc: string;
  kind: "power" | "gnd" | "analog" | "digital" | "bus";
}

export interface Cutout {
  shape: "rect" | "circle";
  w: number;
  h: number;
  /** A circle drawn as a field of small holes, for sound to pass through. */
  grille?: boolean;
}

export interface MicroPythonDriver {
  imports?: string[];
  /** Lines run once at boot. Placeholders: {PIN} {SDA} {SCL} {BCLK} {WS} {SD} {TX} {RX} and named signals. */
  setup: string[];
  /** Body of a read function; must end in a return. */
  read?: { name: string; body: string[]; fields: string[] };
  /** Body of an action function that takes one argument `value`. */
  act?: { name: string; body: string[] };
}

export interface BlockDef {
  id: string;
  name: string;
  subtitle: string;
  role: string;
  category: BlockCategory;
  group: BlockGroup;
  description: string;
  /** Capabilities used to match a product need to a block. */
  tags: string[];
  /** Board lying flat: w along X, d along Y, h is thickness. Millimetres. */
  size: { w: number; d: number; h: number };
  massG: number;
  mount: Mount;
  /** Opening the enclosure needs on the face this block is mounted to. */
  cutout?: Cutout;
  /** True when the part is a disc or ring, so only its diameter (w) matters for fitting. */
  round?: boolean;
  /** A connector that has to reach the right-hand wall (USB). */
  port?: Cutout;
  iface: Iface;
  /** Signal names this block needs from the MCU, in order. */
  signals: string[];
  i2cAddr?: string;
  voltage: { min: number; max: number };
  activeMa: number;
  sleepUa: number;
  /** Battery capacity, for battery blocks. */
  capacityMah?: number;
  /** Peak current this block can supply, for regulators and chargers. */
  supplyMa?: number;
  pinmap?: McuPinMap;
  specs: [string, string][];
  pins: BlockPin[];
  priceInr: number;
  vendor: string;
  /** Tint used for the block art and for its wires. */
  color: string;
  icon: string;
  driver?: MicroPythonDriver;
}

export interface ProductSpec {
  use_case: string;
  dimensions: string;
  target_cost_inr: number | null;
  power_source: "battery" | "usb" | "solar_battery";
  battery_target: string;
  battery_target_hours: number | null;
  duty: "always_on" | "periodic" | "event_driven";
  connectivity: string[];
  inputs: string[];
  outputs: string[];
  environment: string;
  mounting: string;
  enclosure_style: string;
  manufacturing_method: string;
}

export interface ProjectNode {
  id: string;
  blockId: string;
  x: number;
  y: number;
}

export type EnclosureStyle = "minimal" | "rugged" | "compact";
/** rPLA and rPETG are recycled-content filaments, and are what new designs use. ABS and PC remain only for older designs. */
export type Material = "rPLA" | "rPETG" | "PLA" | "PETG" | "ABS" | "PC";
/** chalk: a dead-matte, slightly powdery surface from matte-grade filament. smooth: the usual soft sheen. */
export type Finish = "chalk" | "smooth";

/** box: rounded box. round: puck. card: a flat slab the size of a phone's back, for wallets and battery packs. */
export type EnclosureShape = "box" | "round" | "card";

export interface DesignConfig {
  /** Rounded box, or a round puck whose diameter is `width`. */
  shape?: EnclosureShape;
  /** Cards the outside pocket should hold (0 for no pocket). Only on the card shape. */
  pocketCards?: number;
  style: EnclosureStyle;
  material: Material;
  /** Surface finish. Left out, it is chalk. */
  finish?: Finish;
  color: string;
  /** A wedge under a box so it leans back on a desk. Ignored on other shapes. */
  stand?: boolean;
  /** Colour of the front panel, which is printed as its own part. Left out, it matches the body. */
  face?: string;
  /** When true the outer size follows the components; when false the user's numbers are used. */
  auto: boolean;
  width: number;
  height: number;
  depth: number;
}

export interface Feature {
  icon: string;
  label: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  kind: "i2c" | "analog" | "digital" | "i2s" | "uart" | "spi" | "power";
  color: string;
  label: string;
  pins: { a: string; b: string }[];
}

export interface Check {
  id: string;
  level: "ok" | "warn" | "error";
  title: string;
  detail: string;
}

export interface Placement {
  nodeId: string;
  blockId: string;
  /** Centre of the part, enclosure centre is the origin. X width, Y height, Z depth (front is +Z). */
  pos: [number, number, number];
  size: [number, number, number];
  /** Set when the part was turned 90° in the plane of its layer to fit. */
  rotated?: boolean;
  layer: "back" | "power" | "logic" | "front" | "external";
}

export interface PlacedCutout {
  nodeId: string;
  label: string;
  face: Face;
  shape: "rect" | "circle";
  w: number;
  h: number;
  grille?: boolean;
  /** Position on the face, centred origin. u is horizontal, v is vertical (or depth for top/bottom). */
  u: number;
  v: number;
}

export interface CardPocket {
  /** Outside size of the pocket on the front face, and the height of its centre above the enclosure centre. */
  w: number;
  h: number;
  y: number;
  /** How far it stands off the front face, and the depth of the slot inside it. */
  d: number;
  slot: number;
  cards: number;
}

export interface Layout {
  /** The shell the viewer builds: a card is a box with a fixed footprint. */
  shape: "box" | "round";
  card: boolean;
  /** True when the body carries a wedge underneath and leans back. */
  stand: boolean;
  pocket: CardPocket | null;
  outer: { w: number; h: number; d: number };
  minOuter: { w: number; h: number; d: number };
  wall: number;
  radius: number;
  /** Corner radius of the cavity: as round as the parts in the corners allow. */
  innerRadius: number;
  clearance: number;
  placements: Placement[];
  cutouts: PlacedCutout[];
  fits: boolean;
  shellVolumeCm3: number;
  massG: number;
}

export interface BomRow {
  key: string;
  blockId: string | null;
  name: string;
  detail: string;
  qty: number;
  unitInr: number;
  totalInr: number;
}

export interface Tier {
  id: "prototype" | "small_batch" | "batch";
  name: string;
  qty: number;
  leadTime: string;
  unitInr: number;
  perks: string[];
}

export interface Pricing {
  bomInr: number;
  unitInr: number;
  deliveryDays: [number, number];
  tiers: Tier[];
}

export interface PowerEstimate {
  avgMa: number;
  peakMa: number;
  capacityMah: number | null;
  batteryHours: number | null;
  batteryLabel: string;
}

export interface Compiled {
  edges: Edge[];
  /** nodeId -> signal name -> MCU pin label, e.g. "GPIO21". */
  pinmap: Record<string, Record<string, string>>;
  checks: Check[];
  layout: Layout;
  bom: BomRow[];
  pricing: Pricing;
  power: PowerEstimate;
}

export interface FirmwareFile {
  name: string;
  content: string;
}

export interface Firmware {
  language: "micropython" | "arduino";
  files: FirmwareFile[];
  source: "template" | "ai";
  generatedAt: string;
}

export interface ProjectDoc {
  name: string;
  description: string;
  features: Feature[];
  spec: ProductSpec;
  nodes: ProjectNode[];
  design: DesignConfig;
}
