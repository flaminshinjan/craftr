import clsx from "clsx";
import { ArrowRight, Box, Cpu, Factory, Folder, Hammer, ReceiptText, Settings, Shapes } from "lucide-react";
import { AuthLink } from "@/components/auth-link";

export const container = "mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-14 2xl:px-20";

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={clsx("scroll-mt-24 py-16 sm:py-24", className)}>
      <div className={clsx(container, "reveal")}>{children}</div>
    </section>
  );
}

/** The small labelled pill that opens each section. */
export function Eyebrow({ icon, children, caps, className }: { icon: React.ReactNode; children: React.ReactNode; caps?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5 rounded-full bg-sand px-4 py-2 text-[15px] font-medium text-[#6b4f2a]", caps && "text-[13px] tracking-[0.14em] uppercase", className)}>
      <span className="text-[#c98f12] [&>svg]:size-[18px]">{icon}</span>
      {children}
    </span>
  );
}

export function Headline({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return <Tag className={clsx("display text-[clamp(38px,5vw,76px)] text-ink", className)}>{children}</Tag>;
}

export const Lede = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={clsx("text-[clamp(17px,1.7vw,23px)] leading-[1.45] text-ink-3", className)}>{children}</p>;

/** Icon tile + title + one line, used for the short benefit lists. */
export function Feature({ icon, tone = "leaf", title, children, large }: { icon: React.ReactNode; tone?: "leaf" | "tan" | "blue"; title: string; children: React.ReactNode; large?: boolean }) {
  return (
    <li className="flex items-center gap-5">
      <span className={clsx("flex shrink-0 items-center justify-center rounded-2xl [&>svg]:size-6", large ? "size-[72px] [&>svg]:size-7" : "size-14", tone === "leaf" && "bg-leaf-soft text-leaf", tone === "tan" && "bg-sun-soft text-[#b9772a]", tone === "blue" && "bg-[#e9f0fc] text-[#3b6fd4]")}>{icon}</span>
      <span>
        <span className="block text-[19px] font-semibold tracking-tight text-ink">{title}</span>
        <span className="block text-[15.5px] leading-snug text-ink-3">{children}</span>
      </span>
    </li>
  );
}

export function PrimaryCta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <AuthLink mode="sign-up" className={clsx("inline-flex h-[60px] items-center gap-4 rounded-full bg-ink px-8 text-[18px] font-medium text-white shadow-soft transition hover:bg-black", className)}>
      {children} <ArrowRight className="size-5" />
    </AuthLink>
  );
}

/** The Craftr workspace, drawn in HTML, that frames the builder and firmware demos. */
export function AppFrame({ active, children, className }: { active: string; children: React.ReactNode; className?: string }) {
  const top = [["Build", Hammer], ["Components", Box], ["Design", Shapes], ["Firmware", Cpu], ["BOM & Cost", ReceiptText], ["Manufacturing", Factory]] as const;
  return (
    <div className={clsx("flex overflow-hidden rounded-[28px] border border-line bg-paper shadow-lift", className)}>
      <div className="hidden w-[210px] shrink-0 flex-col border-r border-line px-3 py-6 sm:flex" aria-hidden>
        <div className="mb-5 flex items-center gap-2 px-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sunflower-sm.png" alt="" width={30} height={30} />
          <span className="font-display text-[21px] font-semibold tracking-tight">Craftr</span>
        </div>
        {top.map(([t, I]) => (
          <span key={t} className={clsx("flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[14.5px]", t === active ? "bg-sand font-semibold text-ink" : "text-ink-2")}>
            <I className="size-[18px]" strokeWidth={t === active ? 2.1 : 1.7} /> {t}
          </span>
        ))}
        <span className="mx-2.5 my-4 border-t border-line" />
        {([["Projects", Folder], ["Settings", Settings]] as const).map(([t, I]) => (
          <span key={t} className="flex items-center gap-3.5 px-3 py-2.5 text-[14.5px] text-ink-2">
            <I className="size-[18px]" strokeWidth={1.7} /> {t}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
    </div>
  );
}
