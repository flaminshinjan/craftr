"use client";

import clsx from "clsx";
import { ArrowRight, Box, ChevronDown, Copy, FileText, IndianRupee, Menu, Plus, Search, Trash2, Wrench, X, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStartWith } from "./islands";
import { MOBILE_NAV } from "./nav";

const img = (name: string) => `/landing/${name}.png`;


/** Brand on the left, hamburger on the right; the menu opens as a full-width sheet. */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => void (document.body.style.overflow = "");
  }, [open]);
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#fbf8f3]/92 backdrop-blur-md">
      <div className="flex h-[68px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/sunflower-sm.png" alt="" width={36} height={36} priority />
          <span className="font-display text-[25px] font-bold tracking-tight">Craftr</span>
        </Link>
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="m-menu" className="flex size-11 items-center justify-center rounded-xl">
          {open ? <X className="size-7" /> : <Menu className="size-7" strokeWidth={1.8} />}
        </button>
      </div>
      {open && (
        <nav id="m-menu" aria-label="Main" className="pop absolute inset-x-0 top-full flex h-[calc(100dvh-68px)] flex-col gap-1 border-t border-line bg-[#fbf8f3] px-5 py-4">
          {MOBILE_NAV.map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)} className="flex h-14 items-center border-b border-line text-[19px] font-medium">
              {label}
            </a>
          ))}
          <Link href="/sign-in" className="flex h-14 items-center border-b border-line text-[19px] font-medium">
            Sign in
          </Link>
          <Link href="/sign-up" className="mt-5 flex h-14 items-center justify-center gap-3 rounded-full bg-ink text-[18px] font-medium text-white">
            Get started <ArrowRight className="size-5" />
          </Link>
        </nav>
      )}
    </header>
  );
}

const PARTS = [
  { img: "component_esp32", name: "ESP32", sub: "Wi-Fi • Bluetooth", cat: "MCU" },
  { img: "component_soil_moisture_sensor", name: "Soil Moisture Sensor", sub: "Analog / Digital", cat: "Sensors" },
  { img: "component_lipo_battery", name: "Li-Po Battery", sub: "3.7V • 1000mAh", cat: "Power" },
  { img: "component_solar_panel", name: "Solar Panel", sub: "5V • 1W", cat: "Power" },
  { img: "component_oled_display", name: "OLED Display", sub: '0.96" • I2C', cat: "Display" },
  { img: "component_temperature_sensor", name: "Temperature Sensor", sub: "DHT22", cat: "Sensors" },
  { img: "component_gps_module", name: "GPS Module", sub: "NEO-6M", cat: "Connectivity" },
  { img: "component_camera_module", name: "Camera Module", sub: "OV2640 • 2MP", cat: "Other" },
];
const CATS = ["All", "MCU", "Sensors", "Connectivity", "Power", "Display", "Other"];

export function MobileComponents() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const match = PARTS.filter((p) => (cat === "All" || p.cat === cat) && `${p.name} ${p.sub} ${p.cat}`.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = all || q || cat !== "All" ? match : match.slice(0, 4);
  return (
    <>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-7 flex h-[58px] items-center gap-3 rounded-[20px] border border-line bg-card pr-2 pl-4 shadow-soft">
        <Search className="size-5 shrink-0 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search components..." aria-label="Search components" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3" />
        <button type="submit" aria-label="Search" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-tan text-white">
          <ArrowRight className="size-5" />
        </button>
      </form>
      {/* Chips scroll sideways and run to the screen edge. */}
      <div className="scroll-thin -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Category">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={clsx("h-11 shrink-0 rounded-full border px-5 text-[15px] transition", cat === c ? "border-transparent bg-sand font-semibold" : "border-line bg-card text-ink")}>
            {c}
          </button>
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {shown.map((p) => (
          <li key={p.name} className="flex flex-col rounded-[22px] border border-line/70 bg-card p-3.5 transition active:scale-[0.98]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(p.img)} alt={p.name} width={180} height={160} loading="lazy" className="mx-auto h-[122px] w-auto object-contain" />
            <span className="mt-2 block text-[14.5px] leading-tight font-semibold">{p.name}</span>
            <span className="mt-auto flex items-center justify-between gap-1 pt-1">
              <span className="text-[12.5px] leading-snug text-ink-3">{p.sub}</span>
              <Link href="/sign-up" aria-label={`Start a build with the ${p.name}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand/80">
                <Plus className="size-5" />
              </Link>
            </span>
          </li>
        ))}
        {!shown.length && <li className="col-span-2 py-8 text-center text-ink-3">No components match that search.</li>}
      </ul>
      {match.length > shown.length || all ? (
        <button onClick={() => setAll((a) => !a)} className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-line bg-card text-[16px] font-medium">
          {all ? "Show fewer" : "View all components"} <ArrowRight className={clsx("size-4 transition", all && "-rotate-90")} />
        </button>
      ) : null}
      <p className="mt-5 flex items-start gap-3.5 px-2 text-[14px] leading-snug text-ink-3">
        <Box className="mt-0.5 size-6 shrink-0" strokeWidth={1.5} /> All components are sourced from trusted hardware suppliers and ready for your next build.
      </p>
    </>
  );
}

const SWATCHES = [
  { key: "cream", hex: "#EFE9DC", name: "Cream" },
  { key: "green", hex: "#4FA35A", name: "Green" },
  { key: "tan", hex: "#E3B565", name: "Tan" },
  { key: "grey", hex: "#C9C9C6", name: "Grey" },
  { key: "charcoal", hex: "#444548", name: "Charcoal" },
];

export function MobileDesign({ variants }: { variants: string[] }) {
  const [tab, setTab] = useState("Enclosure");
  const [style, setStyle] = useState("Minimal");
  const [material, setMaterial] = useState("PETG");
  const [color, setColor] = useState("cream");
  const [dims, setDims] = useState({ Width: 60, Height: 60, Depth: 60 });
  const src = (k: string) => (variants.includes(k) ? `/landing/design_${k}.webp` : "/landing/design_smart_plant_monitor.png");
  const opt = (on: boolean) => clsx("flex flex-col items-center gap-1.5 rounded-2xl border py-3.5 text-[14.5px] transition", on ? "border-tan bg-card font-medium text-ink shadow-soft" : "border-line bg-card/60 text-ink-2");
  return (
    <>
      <div role="tablist" className="mt-7 grid grid-cols-3 rounded-[22px] border border-line bg-card/60 p-1.5">
        {["Enclosure", "3D Model", "Exploded View"].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("h-12 rounded-2xl text-[14.5px] transition", tab === t ? "bg-card font-semibold shadow-soft" : "text-ink-2")}>
            {t}
          </button>
        ))}
      </div>
      <div className="relative mx-auto mt-2 aspect-[631/720] w-full max-w-[420px]">
        {SWATCHES.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.key} src={src(s.key)} alt={s.key === color ? `Smart plant monitor enclosure in ${s.name.toLowerCase()}` : ""} width={631} height={808} loading="lazy" className={clsx("drift soft-edge absolute inset-0 size-full object-contain transition-opacity duration-500", s.key === color ? "opacity-100" : "opacity-0")} />
        ))}
      </div>
      <div className="-mt-4 rounded-[26px] border border-line/70 bg-card p-5 shadow-soft">
        <p className="text-[16px] font-semibold">Style</p>
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {["Minimal", "Rugged", "Compact"].map((s) => (
            <button key={s} onClick={() => setStyle(s)} aria-pressed={style === s} className={opt(style === s)}>
              <Box className={clsx("size-8", style === s ? "text-[#5b6fe6]" : "text-ink-3")} strokeWidth={1.4} /> {s}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[16px] font-semibold">Material</p>
        <div className="mt-2.5 grid grid-cols-4 gap-2.5">
          {["PLA", "ABS", "PETG", "PC"].map((m) => (
            <button key={m} onClick={() => setMaterial(m)} aria-pressed={material === m} className={opt(material === m)}>
              <Box className={clsx("size-7", material === m ? "text-ink" : "text-ink-3/50")} strokeWidth={1.5} /> {m}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-b border-line pb-5 max-[359px]:flex-col max-[359px]:items-start">
          <p className="text-[16px] font-semibold">Color</p>
          <div className="flex gap-1.5">
            {SWATCHES.map((s) => (
              <button key={s.key} onClick={() => setColor(s.key)} aria-label={s.name} aria-pressed={color === s.key} className={clsx("size-11 rounded-full border-2 p-1 transition", color === s.key ? "border-tan" : "border-transparent")}>
                <span className="block size-full rounded-full border border-black/10" style={{ background: s.hex }} />
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 text-[16px] font-semibold">Dimensions</p>
        <div className="mt-2 grid grid-cols-3 divide-x divide-line">
          {(Object.keys(dims) as (keyof typeof dims)[]).map((k) => (
            <label key={k} className="px-3 first:pl-1 last:pr-1">
              <span className="block text-[13px] text-ink-2">{k}</span>
              <span className="block text-[16px] font-medium tabular-nums">{dims[k]} mm</span>
              <input type="range" min={40} max={120} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: Number(e.target.value) })} aria-label={`${k} in millimetres`} className="m-range mt-2 w-full" style={{ "--fill": `${((dims[k] - 40) / 80) * 100}%` } as React.CSSProperties} />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

const CODE: [string, string][][] = [
  [["c", "# Smart plant monitor"]],
  [["k", "from"], ["", " "], ["f", "machine"], ["", " "], ["k", "import"], ["f", " ADC"], ["", ", "], ["f", "Pin"]],
  [["k", "import"], ["f", " time"]],
  [],
  [["", "moisture = "], ["f", "ADC"], ["", "("], ["f", "34"], ["", ")"]],
  [["", "led = Pin(2, Pin.OUT)"]],
  [],
  [["k", "while"], ["", " "], ["k", "True"], ["", ":"]],
  [["", "    value = moisture.read()"]],
  [["", "    print("], ["k", 'f"Moisture: '], ["", "{value}"], ["k", '"'], ["", ")"]],
  [["", "    time.sleep(5)"]],
];
const TOK: Record<string, string> = { c: "text-[#5c9a4a]", k: "text-[#d6336c]", f: "text-[#2456d6]", "": "text-[#27324a]" };
const LOGS = ["Connecting to device...", "Connected.", "Flashing firmware...", "Writing 123456 bytes...", "Success! 🎉"];

export function MobileFirmware() {
  const [shown, setShown] = useState(LOGS.length);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  const flash = () => {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(LOGS.length);
    setShown(0);
    timer.current = setInterval(() => setShown((n) => (n >= LOGS.length ? (clearInterval(timer.current!), n) : n + 1)), 450);
  };
  const text = CODE.map((l) => l.map(([, s]) => s).join("")).join("\n");
  return (
    <div className="relative mt-7 rounded-[26px] border border-line/70 bg-card/70 p-3 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="flex h-12 shrink-0 items-center gap-1.5 rounded-t-2xl border border-b-0 border-line bg-card px-2.5 text-[14px] font-medium">
          <span aria-hidden className="size-4 rounded-[5px] bg-gradient-to-br from-[#3f7fc4] from-50% to-[#f2c230] to-50%" /> main.py <span className="size-2 rounded-full bg-[#5fb768]" />
        </span>
        <span className="ml-auto flex h-11 min-w-0 items-center gap-1 rounded-xl border border-line bg-card px-2.5 text-[12.5px] whitespace-nowrap">
          MicroPython <span className="hidden min-[420px]:inline">(ESP32)</span> <ChevronDown className="size-4 shrink-0" />
        </span>
        <button onClick={flash} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[15px] font-semibold text-white active:bg-black">
          <Zap className="size-4" fill="currentColor" /> Flash
        </button>
      </div>
      <div className="relative -mt-px rounded-2xl rounded-tl-none border border-line bg-card">
        <button onClick={() => navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1400)))} aria-label={copied ? "Copied" : "Copy code"} className="absolute top-1 right-1 flex size-11 items-center justify-center text-ink-3">
          <Copy className={clsx("size-[18px]", copied && "text-leaf")} />
        </button>
        <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-[1.9]" aria-label="Example MicroPython firmware">
          <code>
            {CODE.map((line, i) => (
              <span key={i} className="block whitespace-pre">
                <span className="inline-block w-9 pr-3 text-right text-ink-3/70 select-none">{i + 1}</span>
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
      <div className="mt-3 w-[66%] rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[14.5px] font-semibold">
            <FileText className="size-4" /> Logs
          </span>
          <button onClick={() => setShown(0)} className="flex h-9 items-center gap-1.5 text-[13.5px] text-ink-2">
            <Trash2 className="size-4" /> Clear
          </button>
        </div>
        <ul className="h-[136px] px-3.5 py-2.5 font-mono text-[11.5px] leading-[2]" aria-live="polite">
          {LOGS.slice(0, shown).map((l) => (
            <li key={l} className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="size-2 shrink-0 rounded-full bg-[#6cb35a]" /> {l}
            </li>
          ))}
        </ul>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img("hero_smart_plant_monitor")} alt="The plant monitor the firmware runs on" width={363} height={335} loading="lazy" className="drift pointer-events-none absolute -right-5 -bottom-7 w-[46%]" />
    </div>
  );
}

const BOM: [string | null, string, number][] = [
  ["component_esp32", "ESP32 Dev Module", 450],
  ["component_soil_moisture_sensor", "Soil Moisture Sensor", 120],
  ["component_lipo_battery", "Li-Po Battery (1000mAh)", 220],
  ["product_smart_plant_monitor", "3D Printed Enclosure", 80],
  [null, "Misc (wires, screws, etc.)", 50],
];
/** Indicative conversion for the demo table only. */
const RATES = { INR: { per: 1, sign: "₹", digits: 0 }, USD: { per: 1 / 85, sign: "$", digits: 2 } } as const;

export function MobileBom() {
  const [cur, setCur] = useState<keyof typeof RATES>("INR");
  const r = RATES[cur];
  const money = (inr: number) => `${r.sign}${(inr * r.per).toLocaleString(cur === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: r.digits, maximumFractionDigits: r.digits })}`;
  return (
    <div className="rounded-[26px] border border-line/70 bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="tight text-[21px] font-bold">Bill of Materials</h3>
        <label className="relative">
          <span className="sr-only">Currency</span>
          <IndianRupee className={clsx("pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2", cur !== "INR" && "hidden")} />
          <select value={cur} onChange={(e) => setCur(e.target.value as keyof typeof RATES)} className={clsx("h-11 appearance-none rounded-xl border border-line bg-card pr-9 text-[15px] font-medium", cur === "INR" ? "pl-9" : "pl-4")}>
            <option>INR</option>
            <option>USD</option>
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        </label>
      </div>
      <table className="mt-3.5 w-full overflow-hidden rounded-2xl border border-line text-[14.5px] [border-collapse:separate] [border-spacing:0]">
        <thead>
          <tr className="text-left text-[13.5px] text-ink-2">
            <th className="px-3.5 py-3 font-medium" colSpan={2}>
              Component
            </th>
            <th className="px-2 py-3 text-center font-medium">Qty</th>
            <th className="px-3.5 py-3 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {BOM.map(([image, name, price]) => (
            <tr key={name}>
              <td className="w-[58px] border-t border-line py-2 pl-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {image ? <img src={img(image)} alt="" width={44} height={40} loading="lazy" className="h-10 w-11 object-contain" /> : <span className="flex h-10 w-11 items-center justify-center text-ink-3"><Wrench className="size-5" /></span>}
              </td>
              <td className="border-t border-line py-2 pr-1 leading-tight">{name}</td>
              <td className="border-t border-line px-2 text-center tabular-nums">1</td>
              <td className="border-t border-line px-3.5 text-right tabular-nums">{money(price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-sand/70 px-4 py-4">
        <span className="text-[16px] font-semibold">Estimated Total</span>
        <span className="tight text-[24px] font-bold tabular-nums">{money(BOM.reduce((s, x) => s + x[2], 0))}</span>
      </div>
    </div>
  );
}

/** A proven-build card: render on the left, details and price on the right. Tapping starts that build. */
export function MobileProduct({ image, title, body, price, idea }: { image: string; title: string; body: string; price: string; idea: string }) {
  const start = useStartWith();
  return (
    <button onClick={() => start(idea)} className="flex w-full items-center gap-3 rounded-[24px] border border-line/60 bg-card/80 p-3 text-left transition active:scale-[0.99]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img(image)} alt={`A ${title.toLowerCase()} built from blocks`} width={180} height={170} loading="lazy" className="aspect-square w-[34%] shrink-0 object-contain" />
      <span className="min-w-0 flex-1 py-1">
        <span className="tight block text-[17.5px] leading-tight font-bold">{title}</span>
        <span className="mt-1.5 block text-[14px] leading-snug text-ink-2">{body}</span>
        <span className="mt-3 flex items-center justify-between gap-1.5">
          <span className="flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-line bg-card px-2.5 text-[12.5px] whitespace-nowrap">
            <Box className="size-3.5 shrink-0 text-leaf" /> <b className="font-semibold">{price}</b> <span className="truncate text-ink-2">prototype</span>
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sand text-[#7a5a2e]">
            <ArrowRight className="size-5" />
          </span>
        </span>
      </span>
    </button>
  );
}
