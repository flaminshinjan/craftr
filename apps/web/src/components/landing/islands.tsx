"use client";

import clsx from "clsx";
import { ArrowRight, Box, Boxes, ChevronDown, Cog, Cpu, Layers, Leaf, Monitor, Plus, Radio, Search, Trash2, Wifi, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PENDING = "craftr:pending-prompt";
/** Carries an idea through sign-up; it is waiting in the workspace prompt afterwards. */
export function useStartWith() {
  const router = useRouter();
  return (idea: string) => {
    try {
      sessionStorage.setItem(PENDING, idea.trim());
    } catch {}
    router.push("/sign-up");
  };
}

export function PromptField({ initial, ideas, small }: { initial: string; ideas: string[]; small?: boolean }) {
  const start = useStartWith();
  const [value, setValue] = useState(initial);
  return (
    <div>
      <form
        className={clsx("flex items-center gap-3 rounded-[24px] border border-line bg-card py-3 pr-3 shadow-soft transition focus-within:border-line-2", small ? "pl-4" : "pl-6")}
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
      >
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={small ? 3 : 2} maxLength={2000} aria-label="Describe what you want to build" placeholder="describe your hardware idea..." className={clsx("min-w-0 flex-1 resize-none bg-transparent leading-snug outline-none placeholder:text-ink-3", small ? "text-[16px]" : "text-[18px]")} />
        <button type="submit" aria-label="Build it" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-tan text-white transition hover:bg-tan-dark">
          <ArrowRight className="size-6" />
        </button>
      </form>
      <div className={clsx("mt-5 flex-wrap gap-2.5", ideas.length ? "flex" : "hidden")}>
        {ideas.map((idea) => {
          const on = value.toLowerCase().startsWith(idea);
          return (
            <button key={idea} onClick={() => setValue(idea === ideas[2] ? initial : `${idea}.`)} aria-pressed={on} className={clsx("rounded-full border px-5 py-2.5 text-[14.5px] transition", on ? "border-transparent bg-sun-soft font-medium text-ink" : "border-line bg-card text-ink-2 hover:border-line-2 hover:text-ink")}>
              {idea}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A gallery card that starts a build of that kind of product. */
export function IdeaCard({ image, title, body, idea }: { image: string; title: string; body: string; idea: string }) {
  const start = useStartWith();
  return (
    <button onClick={() => start(idea)} className="lift group flex flex-col rounded-[28px] border border-line bg-card p-5 text-left sm:p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`A ${title.toLowerCase()} built from blocks`} width={360} height={340} loading="lazy" className="mx-auto aspect-[11/10] w-full max-w-[330px] object-contain" />
      <span className="mt-6 block font-display text-[clamp(20px,2vw,28px)] font-semibold tracking-tight">{title}</span>
      <span className="mt-2 flex items-end justify-between gap-4">
        <span className="max-w-[230px] text-[16px] leading-snug text-ink-3">{body}</span>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-[#8a6a3a] transition group-hover:bg-tan group-hover:text-white">
          <ArrowRight className="size-5" />
        </span>
      </span>
    </button>
  );
}

const CATS = {
  Sensors: { icon: Leaf, pill: "bg-leaf-soft text-leaf-dark", chip: "text-leaf" },
  Power: { icon: Zap, pill: "bg-sun-soft text-[#a8690f]", chip: "text-[#e2a21b]" },
  Connectivity: { icon: Wifi, pill: "bg-[#e9f0fc] text-[#2f5fc4]", chip: "text-[#4d79d8]" },
  Displays: { icon: Monitor, pill: "bg-lilac text-[#5a4fc7]", chip: "text-[#6f63d9]" },
  Other: { icon: Cog, pill: "bg-sand text-ink-2", chip: "text-ink-2" },
} as const;
type Cat = keyof typeof CATS;

const PARTS: { img: string; name: string; sub: string; cat: Cat }[] = [
  { img: "component_esp32", name: "ESP32", sub: "Wi-Fi + Bluetooth", cat: "Connectivity" },
  { img: "component_soil_moisture_sensor", name: "Soil Moisture Sensor", sub: "Analog / Digital", cat: "Sensors" },
  { img: "component_lipo_battery", name: "Li-Po Battery", sub: "3.7V 1000mAh", cat: "Power" },
  { img: "component_solar_panel", name: "Solar Panel", sub: "5V / 1W", cat: "Power" },
  { img: "component_oled_display", name: "OLED Display", sub: '0.96" I2C', cat: "Displays" },
  { img: "component_camera_module", name: "Camera Module", sub: "OV2640 2MP", cat: "Other" },
  { img: "component_gps_module", name: "GPS Module", sub: "NEO-6M", cat: "Connectivity" },
  { img: "component_temperature_sensor", name: "Temperature Sensor", sub: "DHT22", cat: "Sensors" },
];

/** The component library, searchable and filterable. `side` is the heading column that holds the category chips. */
export function ComponentBrowser({ children }: { children: React.ReactNode }) {
  const [cat, setCat] = useState<Cat | "All">("All");
  const [q, setQ] = useState("");
  const shown = PARTS.filter((p) => (cat === "All" || p.cat === cat) && `${p.name} ${p.sub} ${p.cat}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] lg:gap-10">
      <div>
        {children}
        <div className="mt-9 flex max-w-[560px] flex-wrap gap-3.5">
          {(Object.keys(CATS) as Cat[]).map((c) => {
            const I = c === "Connectivity" ? Radio : CATS[c].icon;
            return (
              <button key={c} onClick={() => setCat(cat === c ? "All" : c)} aria-pressed={cat === c} className={clsx("flex items-center gap-3 rounded-full border px-6 py-3.5 text-[17px] transition", cat === c ? "border-ink/20 bg-card shadow-soft" : "border-line bg-card/60 hover:border-line-2")}>
                <I className={clsx("size-5", CATS[c].chip)} /> {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[32px] border border-line bg-card/70 p-4 shadow-soft sm:p-6">
        <div className="flex gap-3">
          <label className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-card px-4">
            <Search className="size-5 shrink-0 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search components..." aria-label="Search components" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3" />
          </label>
          <label className="relative hidden sm:block">
            <span className="sr-only">Category</span>
            <select value={cat} onChange={(e) => setCat(e.target.value as Cat | "All")} className="h-14 appearance-none rounded-2xl border border-line bg-card pr-11 pl-4 text-[16px]">
              <option value="All">All categories</option>
              {(Object.keys(CATS) as Cat[]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
          </label>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {shown.map((p) => {
            const C = CATS[p.cat];
            return (
              <li key={p.name} className="lift flex flex-col rounded-3xl border border-line bg-card p-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/landing/${p.img}.png`} alt={p.name} width={180} height={160} loading="lazy" className="mx-auto h-[120px] w-auto object-contain sm:h-[140px]" />
                <span className="mt-3 text-[16px] leading-tight font-semibold">{p.name}</span>
                <span className="mt-1 text-[14px] text-ink-3">{p.sub}</span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className={clsx("flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 text-[11.5px] font-medium", C.pill)}>
                    <C.icon className="size-3.5 shrink-0" /> <span className="truncate">{p.cat}</span>
                  </span>
                  <Link href="/sign-up" aria-label={`Start a build with the ${p.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand transition hover:bg-line">
                    <Plus className="size-4" />
                  </Link>
                </span>
              </li>
            );
          })}
          {!shown.length && <li className="col-span-full py-10 text-center text-ink-3">No components match that search.</li>}
        </ul>
      </div>
    </div>
  );
}

const SWATCHES = [
  { key: "cream", hex: "#EFE9DC", name: "Cream" },
  { key: "green", hex: "#4FA35A", name: "Green" },
  { key: "tan", hex: "#E3B565", name: "Tan" },
  { key: "grey", hex: "#C9C9C6", name: "Grey" },
  { key: "charcoal", hex: "#444548", name: "Charcoal" },
];

/** Enclosure controls beside the render. Colour really swaps the render; `variants` lists which colours have one. */
export function DesignStudio({ children, variants }: { children: React.ReactNode; variants: string[] }) {
  const [tab, setTab] = useState("Enclosure");
  const [style, setStyle] = useState("Minimal");
  const [material, setMaterial] = useState("PLA");
  const [color, setColor] = useState("cream");
  const src = (k: string) => (variants.includes(k) ? `/landing/design_${k}.webp` : "/landing/design_smart_plant_monitor.png");
  const opt = (on: boolean) => clsx("flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-[15px] transition", on ? "border-tan bg-sun-soft/50 font-medium shadow-soft" : "border-line bg-card text-ink-2 hover:border-line-2");
  const thumbs = SWATCHES.filter((s) => s.key === "cream" || variants.includes(s.key)).slice(0, 4);
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div>
        {children}
        <div className="mt-9 rounded-[32px] border border-line bg-card p-5 shadow-soft sm:p-8">
          <div role="tablist" className="flex gap-2 border-b border-line pb-5">
            {[["Enclosure", Box], ["3D Model", Boxes], ["Exploded View", Layers]].map(([t, I]) => {
              const Icon = I as typeof Box;
              return (
                <button key={t as string} role="tab" aria-selected={tab === t} onClick={() => setTab(t as string)} className={clsx("flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[15px] transition sm:px-5", tab === t ? "border-tan/60 bg-sun-soft font-semibold" : "border-line text-ink-2")}>
                  <Icon className="size-[18px]" /> <span className={clsx(tab !== t && "hidden sm:inline")}>{t as string}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-5 text-[16px] font-semibold">Style</p>
          <div className="mt-2.5 grid max-w-[470px] grid-cols-3 gap-3.5">
            {["Minimal", "Rugged", "Compact"].map((s) => (
              <button key={s} onClick={() => setStyle(s)} aria-pressed={style === s} className={opt(style === s)}>
                <Box className={clsx("size-9", style === s ? "text-[#4d6fe0]" : "text-ink-2")} strokeWidth={1.3} /> {s}
              </button>
            ))}
          </div>
          <p className="mt-6 text-[16px] font-semibold">Material</p>
          <div className="mt-2.5 grid grid-cols-4 gap-3.5">
            {["PLA", "ABS", "PETG", "PC"].map((m) => (
              <button key={m} onClick={() => setMaterial(m)} aria-pressed={material === m} className={opt(material === m)}>
                <Box className="size-7 text-ink-3/60" strokeWidth={1.4} /> {m}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[16px] font-semibold">Color</p>
              <div className="mt-2.5 flex gap-4">
                {SWATCHES.map((s) => (
                  <button key={s.key} onClick={() => setColor(s.key)} aria-label={s.name} aria-pressed={color === s.key} title={s.name} className={clsx("size-12 rounded-full border-2 p-1 transition", color === s.key ? "border-tan" : "border-transparent")}>
                    <span className="block size-full rounded-full border border-black/10" style={{ background: s.hex }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[14px] text-ink-3">
              <p className="text-[16px] font-semibold text-ink">Dimensions</p>
              <p className="mt-2.5 rounded-xl border border-line px-3.5 py-2.5 tabular-nums">60 × 60 × 60 mm</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative min-w-0 flex-1">
          {SWATCHES.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s.key} src={src(s.key)} alt={s.key === color ? `Smart plant monitor enclosure in ${s.name.toLowerCase()}, ${style.toLowerCase()} style, ${material}` : ""} width={631} height={808} loading="lazy" className={clsx("drift soft-edge mx-auto aspect-[631/808] w-full max-w-[560px] object-contain transition-opacity duration-500", s.key === color ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0")} />
          ))}
        </div>
        <div className="hidden flex-col gap-4 sm:flex">
          {thumbs.map((s) => (
            <button key={s.key} onClick={() => setColor(s.key)} aria-label={`Show the ${s.name.toLowerCase()} enclosure`} aria-pressed={color === s.key} className={clsx("rounded-3xl border-2 bg-card p-2 transition", color === s.key ? "border-tan shadow-soft" : "border-line hover:border-line-2")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(s.key)} alt="" width={96} height={120} loading="lazy" className="h-[112px] w-[92px] object-contain" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const CODE: [string, string][][] = [
  [["c", "# Smart plant monitor"]],
  [["k", "from"], ["", " "], ["f", "machine"], ["", " "], ["k", "import"], ["", " ADC, Pin"]],
  [["k", "import"], ["", " time"]],
  [],
  [["", "moisture = "], ["f", "ADC"], ["", "("], ["n", "34"], ["", ")"]],
  [["", "led = Pin("], ["n", "2"], ["", ", Pin.OUT)"]],
  [],
  [["k", "while"], ["", " "], ["k", "True"], ["", ":"]],
  [["", "    value = "], ["f", "moisture"], ["", ".read()"]],
  [["", "    "], ["f", "print"], ["", "(f"], ["k", '"Moisture: {value}"'], ["", ")"]],
  [["", "    "], ["k", "if"], ["", " value < "], ["n", "2000"], ["", ":"]],
  [["", "        led.value("], ["n", "1"], ["", ")  "], ["c", "# turn on LED when dry"]],
  [["", "    "], ["k", "else"], ["", ":"]],
  [["", "        led.value("], ["n", "0"], ["", ")"]],
  [["", "    time.sleep("], ["n", "2"], ["", ")"]],
];
const TOK: Record<string, string> = { c: "text-[#2f8a3a]", k: "text-[#c0392b]", f: "text-[#2456d6]", n: "text-[#2456d6]", "": "" };
const LOGS = ["Connecting to device...", "Connected.", "Flashing firmware...", "Success! 🎉", "", "Moisture: 2450", "Moisture: 2431", "Moisture: 1890", "Moisture: 1923"];

/** The firmware editor demo. Flash replays the log, the way a real upload reads. */
export function FirmwareDemo() {
  const [shown, setShown] = useState(LOGS.length);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const flash = () => {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(LOGS.length);
    setShown(0);
    timer.current = setInterval(() => setShown((n) => (n >= LOGS.length ? (clearInterval(timer.current!), n) : n + 1)), 420);
  };
  return (
    <div aria-hidden={false}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[24px] font-semibold tracking-tight">Firmware</span>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-[13.5px] sm:flex">
            MicroPython (ESP32) <ChevronDown className="size-4" />
          </span>
          <button onClick={flash} className="flex items-center gap-2.5 rounded-xl bg-ink px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-black">
            <Cpu className="size-4" /> Flash
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
        <div className="border-b border-line px-6 py-3 text-[14px] font-semibold">main.py</div>
        <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-[1.75] sm:text-[14px]" aria-label="Example MicroPython firmware">
          <code>
            {CODE.map((line, i) => (
              <span key={i} className="block whitespace-pre">
                <span className="inline-block w-11 pr-4 text-right text-ink-3/70 select-none">{i + 1}</span>
                {line.map(([t, s], j) => (
                  <span key={j} className={TOK[t]}>
                    {s}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">Logs</span>
          <button onClick={() => setShown(0)} className="flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink">
            <Trash2 className="size-4" /> Clear
          </button>
        </div>
        <div className="mt-3 h-[212px] rounded-xl border border-line px-4 py-3 font-mono text-[12.5px] leading-[1.7] sm:pl-[46%] lg:pl-4 xl:pl-[40%]" aria-live="polite">
          {LOGS.slice(0, shown).map((l, i) => (
            <div key={i} className={l ? "" : "h-2"}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
