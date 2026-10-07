import clsx from "clsx";
import { ArrowLeft, ArrowRight, Box, ChevronRight, CirclePlay, ClipboardCheck, CloudUpload, Code, Cog, Cpu, Droplet, Factory, FileCheck, Hand, Package, ReceiptText, RefreshCw, Sparkle, Sprout, Sun, Terminal, Thermometer, Upload, Wrench, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ComponentBrowser, DesignStudio, FirmwareDemo, IdeaCard, PromptField } from "./islands";
import { MobileLanding } from "./mobile";
import { AppFrame, Eyebrow, Feature, Headline, Lede, PrimaryCta, Section, container } from "./primitives";

const NAV = [
  ["Build", "#build"],
  ["Components", "#components"],
  ["Pricing", "#pricing"],
  ["Resources", "#how"],
];
/** Add a URL to show that icon in the footer. Left empty until the accounts exist. */
const SOCIAL: { name: string; href: string; path: string }[] = [];

const Brand = ({ size = 40 }: { size?: number }) => (
  <Link href="/" className="flex items-center gap-2.5">
    <Image src="/brand/sunflower-sm.png" alt="" width={size} height={size} priority />
    <span className="font-display text-[26px] font-semibold tracking-tight">Craftr</span>
  </Link>
);

const img = (name: string) => `/landing/${name}.png`;

/** Phones get their own composition of the same story; tablets and up get the desktop one. */
export function Landing({ designVariants }: { designVariants: string[] }) {
  return (
    <>
      <div className="md:hidden">
        <MobileLanding designVariants={designVariants} />
      </div>
      <Desktop designVariants={designVariants} />
    </>
  );
}

function Desktop({ designVariants }: { designVariants: string[] }) {
  return (
    <div className="landing hidden overflow-x-clip bg-[#fbf8f3] text-ink md:block">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Builder />
        <Section id="components">
          <ComponentBrowser>
            <Eyebrow icon={<Box />}>Real Components</Eyebrow>
            <Headline className="mt-7 text-[clamp(34px,4.5vw,72px)]">
              real components.
              <br />
              endless possibilities.
            </Headline>
            <Lede className="mt-6 max-w-[620px]">Use actual, sourced hardware components to design, prototype, and build real devices — from environmental sensors to wireless modules.</Lede>
          </ComponentBrowser>
        </Section>
        <Section id="design">
          <DesignStudio variants={designVariants}>
            <Eyebrow icon={<Box />}>Design in 3D</Eyebrow>
            <Headline className="mt-6">Design in 3D.</Headline>
            <Lede className="mt-5 max-w-[640px]">Customize your enclosure in real time. Choose a style, material, and color, and see your design come to life instantly.</Lede>
          </DesignStudio>
        </Section>
        <Firmware />
        <Bom />
        <Manufacturing />
        <Products />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 bg-[#fbf8f3]/85 backdrop-blur-md">
      <div className={clsx(container, "flex items-center justify-between py-5")}>
        <Brand />
        <nav aria-label="Main" className="hidden items-center gap-10 text-[16.5px] md:flex">
          {NAV.map(([label, href]) => (
            <a key={label} href={href} className="text-ink transition hover:text-ink-2">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3 sm:gap-7">
          <Link href="/sign-in" className="text-[16.5px] hover:text-ink-2">
            Sign in
          </Link>
          <Link href="/sign-up" className="flex h-12 items-center gap-3 rounded-full bg-ink px-5 text-[16px] font-medium text-white transition hover:bg-black sm:h-[52px] sm:px-7">
            Get started <ArrowRight className="size-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Reading({ icon, label, value, pct, tone, className }: { icon: React.ReactNode; label: string; value: string; pct: number; tone: "leaf" | "sun"; className?: string }) {
  return (
    <div className={clsx("absolute w-[168px] rounded-2xl border border-line/70 bg-card/95 p-3.5 shadow-soft backdrop-blur-sm", className)}>
      <div className="flex items-center gap-3">
        <span className={clsx("[&>svg]:size-7", tone === "leaf" ? "text-[#6f9f5a]" : "text-[#f2a91c]")}>{icon}</span>
        <span>
          <span className="block text-[12.5px] text-ink-2">{label}</span>
          <span className="block text-[17px] font-medium">{value}</span>
        </span>
      </div>
      <span className="mt-2.5 block h-1.5 rounded-full bg-line">
        <span className={clsx("block h-full rounded-full", tone === "leaf" ? "bg-[#8fb07c]" : "bg-[#f5b62c]")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section className={clsx(container, "grid items-center gap-10 pt-10 pb-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:pt-20 lg:pb-28")}>
      <div>
        <Headline as="h1" className="text-[clamp(46px,6.9vw,108px)]">
          turn ideas into
          <br />
          real hardware.
        </Headline>
        <Lede className="mt-7 max-w-[700px] text-[clamp(18px,2vw,27px)]">Design, program, and manufacture custom devices with AI — from a simple idea to something real.</Lede>
        <div className="mt-9 flex flex-wrap gap-4">
          <PrimaryCta className="h-[68px] px-9 text-[20px]">Start building</PrimaryCta>
          <a href="#build" className="inline-flex h-[68px] items-center gap-3.5 rounded-full border border-line bg-card px-8 text-[20px] font-medium transition hover:border-line-2">
            <CirclePlay className="size-6" strokeWidth={1.6} /> Watch a demo
          </a>
        </div>
        <ul className="mt-12 grid gap-6 border-t border-line pt-10 sm:grid-cols-[auto_auto_auto] sm:justify-start sm:gap-0 sm:divide-x sm:divide-line lg:w-[124%]">
          {[
            [<Sparkle key="i" />, "leaf", "AI-powered", "Go from idea to design in minutes."],
            [<Box key="i" />, "tan", "Real components", "Use actual, sourced hardware parts."],
            [<Factory key="i" />, "tan", "Prototype to production", "Build one or scale to thousands."],
          ].map(([icon, tone, title, body]) => (
            <li key={title as string} className="flex items-start gap-4 sm:px-7 sm:first:pl-0">
              <span className={clsx("flex size-14 shrink-0 items-center justify-center rounded-2xl [&>svg]:size-6", tone === "leaf" ? "bg-leaf-soft text-leaf-dark" : "bg-sun-soft text-[#b9772a]")}>{icon}</span>
              <span>
                <span className="block text-[17px] font-semibold whitespace-nowrap">{title}</span>
                <span className="mt-0.5 block max-w-[190px] text-[15px] leading-snug text-ink-3">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto aspect-[10/11] w-full max-w-[680px]">
        {/* The supplied hero render is 363 px wide and blurs at this size, so the hero uses the sharper render of the same device on its platform. */}
        <Image src="/landing/design_cream.webp" alt="A smart plant monitor: a cream cube with a screen showing soil moisture, and a plant growing from the top" width={1024} height={1536} priority sizes="(min-width: 1024px) 560px, 90vw" className="drift soft-edge absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2" />
        <Reading icon={<Droplet fill="currentColor" />} label="Soil Moisture" value="42%" pct={45} tone="leaf" className="top-[4%] left-[-2%]" />
        <Reading icon={<Sun fill="currentColor" />} label="Light Level" value="1,200 lux" pct={62} tone="sun" className="top-[5%] right-0 hidden sm:block" />
        <Reading icon={<Thermometer />} label="Temperature" value="24.3°C" pct={48} tone="leaf" className="right-[-3%] bottom-[30%] hidden sm:block" />
      </div>
    </section>
  );
}

const STEPS = [
  ["Describe", "Tell Craftr what you want to build in plain language."],
  ["Choose components", "Craftr suggests the best components for your idea, with real-time compatibility checks."],
  ["Design enclosure", "Generate a custom enclosure that fits your components, ready for manufacturing."],
  ["Write firmware", "Craftr generates the firmware for your device, configured for your chosen components."],
  ["Manufacture", "Review the full BOM, get a quote, and have your device manufactured and delivered."],
];

function StepVisual({ n }: { n: number }) {
  if (n === 0)
    return (
      <div className="flex h-full items-center">
        <div className="-rotate-3 rounded-2xl border border-line bg-card p-4 pr-3 shadow-lift">
          <p className="max-w-[170px] text-[14.5px] leading-snug text-ink-2">a plant monitor that measures soil moisture and sends data to my phone</p>
          <span className="mt-1 ml-auto flex size-9 items-center justify-center rounded-xl bg-tan text-white">
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    );
  if (n === 1)
    return (
      <div className="grid h-full grid-cols-2 place-items-center gap-1">
        {["component_esp32", "component_lipo_battery", "component_soil_moisture_sensor", "component_solar_panel"].map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c} src={img(c)} alt="" width={120} height={105} loading="lazy" className="h-[86px] w-auto object-contain" />
        ))}
      </div>
    );
  if (n === 2)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img("product_smart_plant_monitor")} alt="" width={363} height={335} loading="lazy" className="mx-auto h-full w-auto object-contain" />;
  if (n === 3)
    return (
      <pre className="h-full overflow-hidden rounded-2xl bg-[#232528] p-4 font-mono text-[11.5px] leading-[1.6] text-white/90">
        <span className="text-[#ff7b72]">from</span> machine <span className="text-[#ff7b72]">import</span> <span className="text-[#79c0ff]">ADC</span>
        {"\n"}
        <span className="text-[#ff7b72]">import</span> time{"\n\n"}moisture = <span className="text-[#79c0ff]">ADC</span>(<span className="text-[#ffa657]">34</span>){"\n\n"}
        <span className="text-[#ff7b72]">while</span> <span className="text-[#ffa657]">True</span>:{"\n"}
        {"  "}value = moisture.read(){"\n"}
        {"  "}send_data(value){"\n"}
        {"  "}time.sleep(<span className="text-[#ffa657]">5</span>)
      </pre>
    );
  // The packed boxes at the end of the factory line.
  return <div role="img" aria-label="Boxed devices on a pallet" className="h-full w-full bg-no-repeat" style={{ backgroundImage: `url(${img("manufacturing_factory_scene")})`, backgroundSize: "235%", backgroundPosition: "97% 99%", maskImage: "linear-gradient(to bottom, transparent 4%, black 38%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 4%, black 38%)" }} />;
}

function HowItWorks() {
  return (
    <Section id="how" className="text-center">
      <Eyebrow icon={<Image src="/brand/sunflower-sm.png" alt="" width={26} height={26} />} className="bg-sand text-ink">
        How it works
      </Eyebrow>
      <Headline className="mx-auto mt-6 max-w-[1000px] text-[clamp(40px,6.2vw,96px)]">
        from idea to device
        <br />
        in a few simple steps.
      </Headline>
      <Lede className="mx-auto mt-6 max-w-[840px] text-ink-2">Craftr handles the entire hardware creation process with AI, so you can go from a simple idea to a real, working device.</Lede>
      <ol className="mt-14 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="relative flex flex-col rounded-[28px] border border-line/70 bg-card p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-sand text-[17px] font-semibold">{i + 1}</span>
            <h3 className="mt-5 text-[clamp(18px,1.45vw,23px)] font-semibold tracking-tight whitespace-nowrap">{title}</h3>
            <p className="mt-2 min-h-[88px] text-[16px] leading-snug text-ink-3">{body}</p>
            <div className="mt-5 h-[190px]">
              <StepVisual n={i} />
            </div>
            {i < 4 && <ChevronRight aria-hidden className="absolute top-[42%] -right-[14px] z-10 hidden size-5 rounded-full bg-[#fbf8f3] text-ink-3 lg:block" />}
          </li>
        ))}
      </ol>
    </Section>
  );
}

const PLAN: [React.ReactNode, string][] = [
  [<Sprout key="i" />, "Select components"],
  [<Box key="i" />, "Design enclosure"],
  [<Code key="i" />, "Write firmware"],
  [<ReceiptText key="i" />, "Review BOM & cost"],
  [<Hand key="i" />, "Prepare for manufacturing"],
];

function Builder() {
  return (
    <Section id="build">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div>
          <Eyebrow icon={<Sparkle fill="currentColor" />} caps>
            AI Builder
          </Eyebrow>
          <Headline className="mt-6">
            just describe
            <br />
            what you want
            <br />
            to build.
          </Headline>
          <Lede className="mt-6 max-w-[560px]">Craftr turns your idea into a complete hardware plan — with components, design, firmware, and manufacturing steps, powered by AI.</Lede>
          <div className="mt-8 max-w-[620px]">
            <PromptField initial="a smart plant monitor that measures soil moisture and sends data to my phone." ideas={["a pet tracker", "a temperature logger", "a smart plant monitor", "a door lock"]} />
          </div>
        </div>
        <AppFrame active="Build">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3 text-[17px] font-semibold">
              <ArrowLeft className="size-4" /> smart plant monitor
            </span>
            <Upload className="size-4 text-ink-2" />
          </div>
          <p className="mt-4 rounded-2xl bg-lilac px-4 py-3.5 text-[14.5px]">build a smart plant monitor that measures soil moisture and sends data to my phone.</p>
          <p className="mt-6 text-[14px] text-ink-2">Got it! Here's a plan for your smart plant monitor.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
            <ul className="flex flex-col gap-3.5 pt-2">
              {PLAN.map(([icon, label]) => (
                <li key={label} className="flex items-center gap-3.5 text-[14.5px] whitespace-nowrap">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sun-soft text-[#e08a12] [&>svg]:size-5">{icon}</span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-line bg-card/70">
              <div className="flex gap-1 p-1.5 text-[13px] whitespace-nowrap">
                {["Preview", "Schematic", "3D Model", "App"].map((t, i) => (
                  <span key={t} className={clsx("flex-1 rounded-xl px-1 py-2 text-center", i === 0 ? "border border-line bg-card font-semibold shadow-soft" : "text-ink-2")}>
                    {t}
                  </span>
                ))}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img("hero_smart_plant_monitor")} alt="" width={363} height={335} loading="lazy" className="mx-auto w-[86%] py-3" />
            </div>
          </div>
          <div className="mt-4 flex max-w-[360px] items-center justify-between rounded-2xl border border-line bg-card py-2 pr-2 pl-5 text-[15px] text-ink-3">
            Ask or make changes...
            <span className="flex size-10 items-center justify-center rounded-xl bg-tan/70 text-white">
              <ArrowRight className="size-4" />
            </span>
          </div>
        </AppFrame>
      </div>
    </Section>
  );
}

function Firmware() {
  return (
    <Section id="firmware">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div className="lg:pt-10">
          <Eyebrow icon={<Cpu />}>Firmware</Eyebrow>
          <Headline className="mt-7">
            write and test
            <br />
            firmware.
          </Headline>
          <Lede className="mt-6 max-w-[590px]">Program your device with MicroPython or Arduino, test it in real time, and flash it directly from Craftr. No complex setup, just build.</Lede>
          <ul className="mt-10 flex flex-col gap-7">
            <Feature large icon={<Zap />} title="Built-in editor">
              Write, edit, and manage firmware right in your browser.
            </Feature>
            <Feature large tone="tan" icon={<Terminal />} title="Real-time logs">
              See output, sensor data, and debug messages as your device runs.
            </Feature>
            <Feature large tone="blue" icon={<CloudUpload />} title="One-click flashing">
              Connect your device and flash firmware in seconds.
            </Feature>
          </ul>
        </div>
        <div className="relative">
          <AppFrame active="Firmware">
            <FirmwareDemo />
          </AppFrame>
          {/* The supplied scene, with the stray mock-up text at its top and left edge clipped away. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img("firmware_builder_scene")} alt="A block-style maker with a laptop, flashing firmware to a plant monitor over USB" width={586} height={419} loading="lazy" className="pointer-events-none absolute -bottom-10 -left-6 hidden w-[52%] max-w-[430px] lg:-left-[26%] lg:block" style={{ clipPath: "inset(15% 0 0 16%)" }} />
        </div>
      </div>
    </Section>
  );
}

const BOM: [string | null, string, number][] = [
  ["component_esp32", "ESP32 Dev Module", 450],
  ["component_soil_moisture_sensor", "Soil Moisture Sensor", 120],
  ["component_lipo_battery", "Li-Po Battery (1000mAh)", 220],
  ["product_smart_plant_monitor", "3D Printed Enclosure", 80],
  [null, "Misc. (wires, screws, etc.)", 50],
];

function Bom() {
  const total = BOM.reduce((s, r) => s + r[2], 0);
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  return (
    <Section id="pricing">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1fr)]">
        <div>
          <Eyebrow icon={<Box />} caps className="text-ink-2">
            BOM & Pricing
          </Eyebrow>
          <Headline className="mt-7">
            instant BOM
            <br />
            and pricing.
          </Headline>
          <Lede className="mt-6 max-w-[520px]">Get a complete bill of materials with live cost estimates from real suppliers. Update your design and see prices instantly.</Lede>
          <ul className="mt-8 flex flex-col gap-5">
            <Feature icon={<Zap fill="currentColor" />} title="Live component pricing">
              Real-time costs from trusted suppliers
            </Feature>
            <Feature tone="tan" icon={<Box />} title="Full bill of materials">
              Everything you need to build
            </Feature>
            <Feature icon={<RefreshCw />} title="Updates automatically">
              Prices refresh as you iterate
            </Feature>
          </ul>
        </div>
        <div className="rounded-[32px] border border-line bg-card p-5 shadow-soft sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-[clamp(24px,2.4vw,34px)] font-semibold tracking-tight">Bill of Materials</h3>
            <span className="flex items-center gap-2.5 rounded-2xl border border-line px-4 py-3 text-[15px] font-medium">
              <RefreshCw className="size-4" /> Live pricing <span className="size-3 rounded-full bg-[#5fb768]" />
            </span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[540px] text-[17px]">
              <thead>
                <tr className="bg-sand/60 text-left text-[16px] font-medium">
                  <th className="rounded-l-xl px-6 py-4 font-medium" colSpan={2}>
                    Component
                  </th>
                  <th className="px-4 py-4 text-center font-medium">Qty</th>
                  <th className="px-4 py-4 font-medium">Unit Price</th>
                  <th className="rounded-r-xl px-6 py-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {BOM.map(([image, name, price]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="w-[104px] py-3 pl-4">
                      <span className="flex h-[66px] w-[84px] items-center justify-center rounded-2xl bg-sand/70">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {image ? <img src={img(image)} alt="" width={64} height={56} loading="lazy" className="h-[52px] w-auto object-contain" /> : <Wrench className="size-6 text-ink-3" />}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{name}</td>
                    <td className="px-4 text-center tabular-nums">1</td>
                    <td className="px-4 tabular-nums">{inr(price)}</td>
                    <td className="px-6 tabular-nums">{inr(price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-3">
                    <span className="flex items-center justify-end gap-16 rounded-2xl bg-sand/60 px-8 py-5">
                      <span className="text-[20px] font-semibold">Estimated Total</span>
                      <span className="font-display text-[30px] font-semibold tabular-nums">{inr(total)}</span>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}

const FLOW: [React.ReactNode, string, string][] = [
  [<FileCheck key="i" />, "Review", "Confirm designs, specs, and quantity."],
  [<ReceiptText key="i" />, "Quote", "Get an instant manufacturing quote."],
  [<Cog key="i" />, "Fabrication", "We source parts and manufacture your devices."],
  [<ClipboardCheck key="i" />, "Testing", "Every unit is tested for quality and performance."],
  [<Package key="i" />, "Shipping", "We deliver to your door, ready to deploy."],
];

function Manufacturing() {
  return (
    <Section id="manufacturing">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div>
          <Headline className="text-[clamp(42px,5.8vw,90px)]">
            Manufacture
            <br />
            with a click.
          </Headline>
          <Lede className="mt-7 max-w-[680px]">From prototype to production, Craftr handles the entire manufacturing process — so you can go from idea to real hardware, without the hassle.</Lede>
          <ol className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-5">
            {FLOW.map(([icon, title, body], i) => (
              <li key={title} className="relative">
                <span className="flex size-[76px] items-center justify-center rounded-2xl border border-line/70 bg-card text-[#c08a3e] shadow-soft [&>svg]:size-8">{icon}</span>
                {i < 4 && (
                  <span aria-hidden className="absolute top-[38px] right-2 left-[88px] hidden items-center sm:flex">
                    <span className="h-px flex-1 border-t border-dashed border-line-2" />
                    <ChevronRight className="size-5 rounded-full bg-line p-0.5 text-white" />
                    <span className="h-px flex-1 border-t border-dashed border-line-2" />
                  </span>
                )}
                <h3 className="mt-5 text-[19px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 max-w-[150px] text-[15px] leading-snug text-ink-3">{body}</p>
              </li>
            ))}
          </ol>
        </div>
        {/* The supplied scene, with the stray mock-up text in its lower-left corner clipped away. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img("manufacturing_factory_scene")} alt="A block-style factory line: robot arms assemble plant monitors, which are boxed and stacked on a pallet" width={867} height={842} loading="lazy" className="mx-auto w-full max-w-[760px] lg:-mr-10 lg:max-w-none lg:scale-110" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 30% 100%, 30% 64%, 0 64%)", maskImage: "linear-gradient(to left, transparent 1%, black 12%)", WebkitMaskImage: "linear-gradient(to left, transparent 1%, black 12%)" }} />
      </div>
    </Section>
  );
}

function Products() {
  return (
    <Section id="products" className="text-center">
      <Eyebrow icon={<Box />} caps>
        Real Products
      </Eyebrow>
      <Headline className="mt-6 text-[clamp(34px,5.6vw,88px)]">real products. endless possibilities.</Headline>
      <Lede className="mx-auto mt-6 max-w-[900px] text-ink-2">From everyday tools to complex systems, Craftr helps you design, program, and manufacture real hardware for any idea.</Lede>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <IdeaCard image={img("product_smart_plant_monitor")} title="Smart Plant Monitor" body="Measure soil moisture and get real-time updates on your phone." idea="Build a smart plant monitor that measures soil moisture and sends data to my phone." />
        <IdeaCard image={img("product_pet_tracker")} title="Pet Tracker" body="Keep track of your pets with GPS and activity monitoring." idea="Make me a pet tracker with GPS and activity monitoring that clips to a collar." />
        <IdeaCard image={img("product_weather_station")} title="Weather Station" body="Monitor temperature, humidity, air quality, and more." idea="Build a small weather station that measures temperature, humidity and light and logs it over Wi-Fi." />
        <IdeaCard image={img("product_home_automation")} title="Home Automation" body="Control lights, switches and sensors around your home." idea="Make a home automation sensor that detects presence and reports to my phone." />
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section id="start" className="relative isolate scroll-mt-24 overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 aspect-[3/2] max-h-full bg-cover bg-bottom opacity-90 saturate-[0.8]" style={{ backgroundImage: "url(/landing/cta_world.webp)" }} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fbf8f3] from-25% via-[#fbf8f3]/75 via-55% to-transparent" />
      <div className={clsx(container, "reveal flex flex-col items-center pt-24 pb-[min(36vw,520px)] text-center")}>
        <Image src="/brand/sunflower-sm.png" alt="" width={56} height={56} />
        <p className="mt-4 flex items-center gap-6 text-[13px] tracking-[0.3em] text-ink-2 uppercase">
          <span className="hidden h-px w-10 bg-ink-3 sm:block" /> Ideas today. Real devices tomorrow. <span className="hidden h-px w-10 bg-ink-3 sm:block" />
        </p>
        <Headline className="mt-8 text-[clamp(44px,6.4vw,100px)]">
          ready to build
          <br />
          something real?
        </Headline>
        <Lede className="mt-7 max-w-[620px] text-ink-2">Join makers, engineers, and founders building physical products with AI.</Lede>
        <PrimaryCta className="mt-9 h-[76px] px-14 text-[24px]">Get started</PrimaryCta>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img("product_smart_plant_monitor")} alt="" width={363} height={335} loading="lazy" className="drift pointer-events-none absolute bottom-[6%] left-[6%] hidden w-[min(24vw,330px)] md:block" />
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-[#fbf8f3]">
      <div className={clsx(container, "flex flex-wrap items-center justify-between gap-x-10 gap-y-5 py-9")}>
        <Brand size={36} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-10 gap-y-2 text-[16px]">
          {NAV.map(([label, href]) => (
            <a key={label} href={href} className="hover:text-ink-2">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-6 text-[14px] text-ink-2">
          {SOCIAL.map((s) => (
            <a key={s.name} href={s.href} aria-label={s.name} target="_blank" rel="noreferrer" className="text-ink hover:text-ink-2">
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
                <path d={s.path} />
              </svg>
            </a>
          ))}
          <span>© {new Date().getFullYear()} Craftr. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
