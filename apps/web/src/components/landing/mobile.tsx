import { DEFAULT_DESIGN, DEFAULT_SPEC, compile, nodesFromBlocks } from "@craftr/core";
import clsx from "clsx";
import { ArrowRight, Box, BoxSelect, Check, CircleCheck, CirclePlay, ClipboardList, Code, Cog, Cpu, Droplet, Factory, MessageSquareMore, Play, ReceiptText, Settings, ShieldCheck, Sparkle, Sun, Tag, Thermometer, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PromptField } from "./islands";
import { MOBILE_NAV } from "./nav";
import { MobileBom, MobileComponents, MobileDesign, MobileFirmware, MobileHeader, MobileProduct } from "./mobile-islands";

const img = (name: string) => `/landing/${name}.png`;

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={clsx("scroll-mt-20 px-5 py-14", className)}>
      <div className="reveal">{children}</div>
    </section>
  );
}

const Eyebrow = ({ icon, children, tone = "tan" }: { icon: React.ReactNode; children: React.ReactNode; tone?: "tan" | "leaf" }) => (
  <span className={clsx("inline-flex h-10 items-center gap-2.5 rounded-full px-4 text-[13px] font-semibold tracking-[0.12em] uppercase", tone === "tan" ? "bg-sand text-[#6b4f2a] [&>svg]:text-[#c98f12]" : "bg-leaf-soft text-leaf-dark [&>svg]:text-leaf")}>
    <span className="contents [&>svg]:size-[18px]">{icon}</span> {children}
  </span>
);

const Headline = ({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) => <Tag className={clsx("display mt-4 text-[clamp(27px,8.7vw,40px)]", className)}>{children}</Tag>;
const Lede = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={clsx("mt-3 text-[17.5px] leading-[1.4] text-ink-3", className)}>{children}</p>;

/** Three short value points side by side in one soft card. */
function Trio({ items, className }: { items: [React.ReactNode, "leaf" | "tan", string, string][]; className?: string }) {
  return (
    <ul className={clsx("grid grid-cols-3 divide-x divide-line rounded-[26px] border border-line/60 bg-card px-1 py-5 shadow-soft", className)}>
      {items.map(([icon, tone, title, body]) => (
        <li key={title} className="flex flex-col items-center px-2 text-center">
          <span className={clsx("flex size-12 items-center justify-center rounded-2xl [&>svg]:size-6", tone === "leaf" ? "bg-leaf-soft text-leaf" : "bg-sun-soft text-[#c98f12]")}>{icon}</span>
          <span className="mt-3 text-[13.5px] leading-tight font-semibold">{title}</span>
          <span className="mt-1 text-[12px] leading-snug text-ink-3">{body}</span>
        </li>
      ))}
    </ul>
  );
}

function Reading({ icon, label, value, pct, tone, className }: { icon: React.ReactNode; label: string; value: string; pct: number; tone: "leaf" | "sun"; className?: string }) {
  return (
    <div className={clsx("absolute z-10 w-[124px] rounded-2xl border border-line/60 bg-card/95 p-2.5 shadow-soft", className)}>
      <div className="flex items-center gap-2">
        <span className={clsx("[&>svg]:size-6", tone === "leaf" ? "text-[#6f9f5a]" : "text-[#f2a91c]")}>{icon}</span>
        <span>
          <span className="block text-[10.5px] leading-tight text-ink-2">{label}</span>
          <span className="block text-[14px] leading-tight font-medium">{value}</span>
        </span>
      </div>
      <span className="mt-2 block h-1.5 rounded-full bg-line">
        <span className={clsx("block h-full rounded-full", tone === "leaf" ? "bg-[#8fb07c]" : "bg-[#f5b62c]")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

const Device = ({ className, priority }: { className?: string; priority?: boolean }) => (
  <Image src="/landing/design_cream.webp" alt="A smart plant monitor: a cream cube with a screen showing soil moisture, and a plant growing from the top" width={1024} height={1536} priority={priority} sizes="(max-width: 767px) 90vw, 1px" className={clsx("drift soft-edge", className)} />
);
const Sunflower = ({ className }: { className?: string }) => <Image src="/brand/sunflower.png" alt="" width={256} height={256} sizes="(max-width: 767px) 30vw, 1px" className={clsx("pointer-events-none absolute", className)} />;

/**
 * Prototype prices come from the same pricing engine the app uses, for a representative set of
 * blocks, so a visitor sees a figure close to what they will be quoted after signing in.
 */
const from = (blocks: string[], battery: boolean) => {
  const { pricing } = compile({ nodes: nodesFromBlocks(blocks), design: DEFAULT_DESIGN, spec: { ...DEFAULT_SPEC, power_source: battery ? "battery" : "usb" } });
  return `from ₹${pricing.unitInr.toLocaleString("en-IN")}`;
};
const PRICE = {
  plant: from(["esp32_devkit", "soil_moisture", "dht22", "oled_096", "lipo_1000", "charger_tp4056"], true),
  pet: from(["esp32_c3_supermini", "gps", "led", "lipo_500", "charger_tp4056"], true),
  weather: from(["esp32_devkit", "sht31", "bh1750", "oled_096", "solar_panel", "lipo_1000", "charger_tp4056"], true),
  home: from(["esp32_devkit", "pir", "dht22", "led"], false),
};

const STEPS: [React.ReactNode, string, string][] = [
  [<MessageSquareMore key="i" className="text-[#8fb07c]" />, "Describe", "Tell Craftr what you want to build."],
  [<Box key="i" className="text-[#d9a45a]" />, "Design", "Get a complete design and 3D model."],
  [<Code key="i" className="text-[#6f9f5a]" />, "Code", "Generate firmware ready to flash."],
  [<Cog key="i" className="text-[#f2a91c]" />, "Build", "See the BOM, costs, and manufacturing steps."],
];
const PLAN: [React.ReactNode, string, boolean][] = [
  [<Cpu key="i" />, "Select components", true],
  [<Box key="i" />, "Design enclosure", true],
  [<Code key="i" />, "Write firmware", true],
  [<ReceiptText key="i" />, "Review BOM & cost", true],
  [<Factory key="i" />, "Prepare for manufacturing", false],
];
const RAIL: [React.ReactNode, string][] = [
  [<ClipboardList key="i" />, "Review"],
  [<Tag key="i" />, "Quote"],
  [<Settings key="i" />, "Fabrication"],
  [<BoxSelect key="i" />, "Assembly"],
  [<CircleCheck key="i" />, "Testing"],
  [<Truck key="i" />, "Shipping"],
];

export function MobileLanding({ designVariants }: { designVariants: string[] }) {
  return (
    <div className="landing overflow-x-clip bg-[#fbf8f3] text-ink">
      <MobileHeader />
      <main>
        {/* 1. Hero */}
        <section className="px-5 pt-9 pb-10">
          <div className="text-center">
            <h1 className="display text-[clamp(40px,13.6vw,60px)]">
              from idea to
              <br />
              real device.
            </h1>
            <p className="mx-auto mt-4 max-w-[340px] text-[18.5px] leading-[1.35] text-ink-3">Design, simulate, and manufacture custom hardware with the help of AI.</p>
            <div className="mt-6 flex justify-center gap-2.5">
              <Link href="/sign-up" className="flex h-[52px] items-center gap-2.5 rounded-full bg-ink px-5 text-[16px] font-medium text-white shadow-soft active:bg-black">
                Start building <ArrowRight className="size-[18px]" />
              </Link>
              <a href="#m-build" className="flex h-[52px] items-center gap-2 rounded-full border border-line bg-card px-4 text-[16px] font-medium">
                <CirclePlay className="size-[22px]" strokeWidth={1.7} /> Watch demo
              </a>
            </div>
          </div>
          <div className="relative -mx-5 mt-6 aspect-[10/11.4] overflow-hidden">
            <Device priority className="absolute top-[9%] left-1/2 h-[92%] w-auto max-w-none -translate-x-[42%]" />
            <Sunflower className="drift top-[20%] left-[3%] w-[27%] [animation-delay:-3s]" />
            <Reading icon={<Droplet fill="currentColor" />} label="Soil Moisture" value="42%" pct={45} tone="leaf" className="top-[3%] left-[14%]" />
            <Reading icon={<Sun fill="currentColor" />} label="Light Level" value="1,200 lux" pct={62} tone="sun" className="top-[4%] right-[4%]" />
            <Reading icon={<Thermometer />} label="Temperature" value="24.3°C" pct={48} tone="leaf" className="top-[33%] right-[1%]" />
          </div>
          <Trio
            className="relative -mt-6"
            items={[
              [<Sparkle key="i" />, "leaf", "AI guided builder", "Turn your idea into a hardware plan in minutes."],
              [<Box key="i" />, "tan", "Real components", "Use actual, sourced hardware parts."],
              [<Factory key="i" />, "tan", "Manufacturing ready", "Go from prototype to production."],
            ]}
          />
        </section>

        {/* 2. AI Builder */}
        <Section id="m-build">
          <Eyebrow tone="tan" icon={<Sparkle className="!text-leaf" />}>
            AI Builder
          </Eyebrow>
          <Headline>
            just describe
            <br />
            what you want to build.
          </Headline>
          <Lede>Craftr turns your idea into a complete hardware plan — with components, designs, firmware, and a bill of materials.</Lede>
          <div className="mt-6">
            <PromptField initial="a smart plant monitor that measures soil moisture and sends data to my phone" ideas={[]} small />
          </div>
          <ol className="mt-6 grid grid-cols-4 gap-2">
            {STEPS.map(([icon, title, body], i) => (
              <li key={title} className="relative flex flex-col items-center rounded-[18px] border border-line/60 bg-card px-1.5 pt-7 pb-3 text-center">
                <span className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-sand text-[12px] font-semibold">{i + 1}</span>
                <span className="[&>svg]:size-9 [&>svg]:[stroke-width:1.6]">{icon}</span>
                <span className="mt-2 text-[13.5px] font-semibold">{title}</span>
                <span className="mt-1 text-[10.5px] leading-snug text-ink-3">{body}</span>
              </li>
            ))}
          </ol>
          <div className="relative -mx-5 mt-5 overflow-hidden px-5 pt-3 pb-4">
            <Device className="absolute top-0 -left-[14%] h-full w-auto max-w-none" />
            <div className="relative ml-auto w-[63%] rounded-[22px] border border-line/60 bg-card/95 p-3 shadow-soft">
              <p className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf">
                  <Sparkle className="size-5" />
                </span>
                Got it! Here's a plan for your smart plant monitor.
              </p>
              <ul className="mt-2.5 rounded-2xl border border-line/70">
                {PLAN.map(([icon, label, done], i) => (
                  <li key={label} className={clsx("flex items-center gap-2 px-2 py-2 text-[12px] leading-tight", i > 0 && "border-t border-line/70")}>
                    <span className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full", done ? "bg-[#63a85a] text-white" : "border-[1.5px] border-line-2")}>{done && <Check className="size-3" strokeWidth={3} />}</span>
                    <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4", i % 2 === 0 ? "bg-leaf-soft text-leaf-dark" : "bg-sun-soft text-[#c98f12]")}>{icon}</span>
                    {label}
                    <span className="sr-only">{done ? " (done)" : " (next)"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 3. Components */}
        <Section id="m-components">
          <Eyebrow icon={<Box />}>Components</Eyebrow>
          <Headline>
            real components.
            <br />
            endless possibilities.
          </Headline>
          <MobileComponents />
        </Section>

        {/* 4. Design */}
        <Section id="m-design">
          <div className="text-center">
            <Eyebrow icon={<Box />}>Design</Eyebrow>
            <Headline className="text-[clamp(30px,9.6vw,44px)]">design it your way.</Headline>
            <Lede className="mx-auto max-w-[330px]">Customize every detail in 3D, from style and material to color and dimensions.</Lede>
          </div>
          <MobileDesign variants={designVariants} />
        </Section>

        {/* 5. Firmware */}
        <Section id="m-firmware">
          <Eyebrow icon={<Cpu />}>Firmware</Eyebrow>
          <Headline className="text-[clamp(36px,11.6vw,54px)]">
            write and test
            <br />
            firmware.
          </Headline>
          <Lede>Build, upload, and test your device firmware directly in Craftr. No complex setup required.</Lede>
          <MobileFirmware />
          <Trio
            className="mt-12"
            items={[
              [<Code key="i" />, "leaf", "Edit in your browser", "Clean, powerful editor with device support."],
              [<Play key="i" />, "tan", "Flash in one click", "Build and upload firmware instantly."],
              [<Settings key="i" />, "tan", "See live output", "View logs and debug your device in real time."],
            ]}
          />
        </Section>

        {/* 6. BOM & cost */}
        <Section id="m-pricing">
          <Eyebrow icon={<Box />}>BOM & Cost</Eyebrow>
          <Headline className="text-[clamp(36px,11.6vw,54px)]">
            instant BOM
            <br />
            and pricing.
          </Headline>
          <Lede>Get a complete bill of materials with real-time costs from sourced parts.</Lede>
          {/* The core parts laid out on a platform, composed from the individual component renders. */}
          <div className="relative mx-auto mt-5 aspect-[10/6.4] w-full max-w-[440px]" role="img" aria-label="An ESP32, a soil moisture sensor, a battery and the printed enclosure laid out together">
            <span className="absolute inset-x-[6%] bottom-[2%] h-[62%] rounded-[50%] bg-gradient-to-b from-[#f6efe2] to-[#e9dfcc] shadow-[0_14px_22px_-12px_rgba(90,70,30,0.35),inset_0_-8px_0_#e0d4bd]" />
            {/* eslint-disable @next/next/no-img-element */}
            <img src={img("component_esp32")} alt="" width={200} height={172} loading="lazy" className="absolute top-[14%] left-[12%] w-[36%]" />
            <img src={img("product_smart_plant_monitor")} alt="" width={363} height={335} loading="lazy" className="absolute top-0 right-[6%] w-[40%]" />
            <img src={img("component_soil_moisture_sensor")} alt="" width={178} height={175} loading="lazy" className="absolute top-[40%] left-[30%] w-[27%]" />
            <img src={img("component_lipo_battery")} alt="" width={186} height={166} loading="lazy" className="absolute top-[50%] left-[52%] w-[30%]" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <MobileBom />
        </Section>

        {/* 7. Manufacturing */}
        <Section id="m-manufacturing">
          <Eyebrow icon={<Factory />}>Manufacturing</Eyebrow>
          <Headline>
            go from prototype
            <br />
            to product.
          </Headline>
          <Lede>Get instant quotes, source components, handle assembly, and ensure quality testing — all in one place.</Lede>
          <ol className="mt-6 grid grid-cols-6" aria-label="Manufacturing process">
            {RAIL.map(([icon, label], i) => (
              <li key={label} className="relative flex flex-col items-center gap-2">
                {i > 0 && <span aria-hidden className="absolute top-[22px] right-[calc(50%+25px)] left-[calc(-50%+25px)] h-px bg-line-2" />}
                <span className={clsx("flex size-11 items-center justify-center rounded-full [&>svg]:size-5 [&>svg]:[stroke-width:1.6]", i === 0 ? "bg-sun-soft text-[#8a5a1e] ring-1 ring-tan/40" : "bg-sand/80 text-ink-2")}>{icon}</span>
                <span className={clsx("text-[10.5px]", i === 0 ? "font-semibold" : "text-ink-2")}>{label}</span>
              </li>
            ))}
          </ol>
          {/* The supplied scene, with the stray mock-up text in its lower-left corner clipped away. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img("manufacturing_factory_scene")} alt="A block-style factory line: robot arms assemble plant monitors, which are boxed and stacked on a pallet" width={867} height={842} loading="lazy" className="mx-auto mt-4 w-full max-w-[460px]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 30% 100%, 30% 64%, 0 64%)", maskImage: "linear-gradient(to left, transparent 0%, black 10%)", WebkitMaskImage: "linear-gradient(to left, transparent 0%, black 10%)" }} />
          <Link href="/sign-up" className="mt-5 flex h-[60px] items-center justify-center gap-4 rounded-full bg-ink text-[18px] font-medium text-white shadow-soft active:bg-black">
            Get manufacturing quote <ArrowRight className="size-5" />
          </Link>
          <ul className="mt-7 grid grid-cols-3 divide-x divide-line">
            {(
              [
                [<Sparkle key="i" />, "leaf", "Instant quotes", "See pricing in minutes based on your design."],
                [<Box key="i" />, "tan", "Global sourcing", "We source reliable components for you."],
                [<ShieldCheck key="i" />, "tan", "Quality tested", "Assembly and testing to production standards."],
              ] as const
            ).map(([icon, tone, title, body]) => (
              <li key={title} className="flex flex-col items-center px-2 text-center">
                <span className={clsx("flex size-12 items-center justify-center rounded-2xl [&>svg]:size-6", tone === "leaf" ? "bg-leaf-soft text-leaf" : "bg-sun-soft text-[#c98f12]")}>{icon}</span>
                <span className="mt-3 text-[13.5px] leading-tight font-semibold">{title}</span>
                <span className="mt-1 text-[12px] leading-snug text-ink-3">{body}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 8. Products */}
        <Section id="m-products">
          <Eyebrow icon={<Box />}>Products</Eyebrow>
          <Headline>
            real products.
            <br />
            endless possibilities.
          </Headline>
          <Lede>start from proven builds and customize them.</Lede>
          <div className="mt-6 flex flex-col gap-3.5">
            <MobileProduct image="product_smart_plant_monitor" title="Smart Plant Monitor" body="Measures soil moisture and sends data to your phone." price={PRICE.plant} idea="Build a smart plant monitor that measures soil moisture and sends data to my phone." />
            <MobileProduct image="product_pet_tracker" title="Pet Tracker" body="Track your pet's location with GPS and BLE." price={PRICE.pet} idea="Make me a pet tracker with GPS and Bluetooth that clips to a collar." />
            <MobileProduct image="product_weather_station" title="Weather Station" body="Monitor temperature, humidity and air quality." price={PRICE.weather} idea="Build a small weather station that measures temperature, humidity and light and logs it over Wi-Fi." />
            <MobileProduct image="product_home_automation" title="Home Automation Hub" body="Control lights, sensors and more from one hub." price={PRICE.home} idea="Make a home automation hub that detects presence and reports to my phone." />
          </div>
        </Section>

        {/* 9. Final CTA */}
        <section id="m-start" className="scroll-mt-20 overflow-hidden px-5 pt-14">
          <div className="reveal text-center">
            <h2 className="display text-[clamp(38px,12.4vw,56px)]">
              ready to build
              <br />
              your next
              <br />
              device?
            </h2>
            <p className="mx-auto mt-4 max-w-[320px] text-[18.5px] leading-[1.35] text-ink-3">Describe your idea today and hold a working prototype in a couple of weeks.</p>
            <Link href="/sign-up" className="mx-auto mt-6 flex h-[60px] w-fit items-center gap-4 rounded-full bg-ink px-9 text-[19px] font-medium text-white shadow-soft active:bg-black">
              Get started <ArrowRight className="size-5" />
            </Link>
          </div>
          <div className="relative -mx-5 mt-4 aspect-[10/9.4] overflow-hidden">
            <Device className="absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-[40%]" />
            <Sunflower className="drift top-[12%] left-[5%] w-[27%] [animation-delay:-3s]" />
          </div>
        </section>
      </main>
      <footer className="mx-5 flex items-center gap-4 border-t border-line py-7 max-[439px]:flex-col max-[439px]:items-stretch max-[439px]:gap-1">
        <Link href="/" className="flex shrink-0 items-center gap-2 border-line min-[440px]:border-r min-[440px]:pr-4">
          <Image src="/brand/sunflower-sm.png" alt="" width={32} height={32} />
          <span className="font-display text-[21px] font-bold tracking-tight">Craftr</span>
        </Link>
        <nav aria-label="Footer" className="flex flex-1 justify-between gap-x-2 text-[13.5px] text-ink-2">
          {MOBILE_NAV.map(([label, href]) => (
            <a key={label} href={href} className="flex h-11 items-center">
              {label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
