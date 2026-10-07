"use client";

import { getBlock, type DesignConfig } from "@craftr/core";
import clsx from "clsx";
import { Activity, BatteryFull, Bell, Bluetooth, Box, CircleDot, Cpu, Droplet, Leaf, Lightbulb, Loader2, Magnet, MapPin, Mic, Monitor, MonitorSmartphone, Move3d, Radar, RotateCw, Smartphone, Sparkles, Sun, Thermometer, Timer, ToggleRight, TriangleAlert, Usb, Vibrate, Volume2, Wifi, Zap, type LucideIcon } from "lucide-react";
import { assetUrl, useBlockArt } from "@/lib/api";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity, "battery-full": BatteryFull, bell: Bell, bluetooth: Bluetooth, "circle-dot": CircleDot, cpu: Cpu, droplet: Droplet, leaf: Leaf, lightbulb: Lightbulb, magnet: Magnet, "map-pin": MapPin, mic: Mic, monitor: Monitor, "monitor-smartphone": MonitorSmartphone, "move-3d": Move3d, radar: Radar, "rotate-cw": RotateCw, smartphone: Smartphone, sparkles: Sparkles, sun: Sun, thermometer: Thermometer, timer: Timer, "toggle-right": ToggleRight, usb: Usb, vibrate: Vibrate, "volume-2": Volume2, wifi: Wifi, zap: Zap,
};

export function Icon({ name, ...rest }: { name: string } & React.ComponentProps<LucideIcon>) {
  const I = ICONS[name] ?? Box;
  return <I {...rest} />;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "dark" | "light" | "tan" | "ghost"; size?: "sm" | "md" | "lg"; loading?: boolean };

export function Button({ variant = "light", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-[13px]",
        size === "md" && "h-11 px-4",
        size === "lg" && "h-14 px-6 text-base",
        variant === "dark" && "bg-ink text-white shadow-soft hover:bg-black",
        variant === "light" && "border border-line bg-card shadow-soft hover:border-line-2 hover:bg-white",
        variant === "tan" && "bg-tan text-white hover:bg-tan-dark",
        variant === "ghost" && "text-ink-2 hover:bg-sand hover:text-ink",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Card = ({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => <div {...rest} className={clsx("rounded-2xl border border-line bg-card", className)} />;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx("animate-spin text-ink-3", className ?? "size-5")} />;

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-3 text-ink-3">
      <Spinner /> {label}…
    </div>
  );
}

export function Notice({ tone = "error", children, className }: { tone?: "error" | "warn" | "info" | "ok"; children: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug", tone === "error" && "bg-rose-soft text-rose", tone === "warn" && "bg-sun-soft text-[#8a6410]", tone === "info" && "bg-sand text-ink-2", tone === "ok" && "bg-leaf-soft text-leaf-dark", className)}>
      {(tone === "error" || tone === "warn") && <TriangleAlert className="mt-px size-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/sunflower-sm.png" alt="" className="size-12 opacity-80" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-ink-2">{body}</p>
      {action}
    </Card>
  );
}

/** A block's picture: generated art when an admin has made it, otherwise a drawn tile in the block's colour. */
export function BlockArt({ blockId, size = 56, className }: { blockId: string; size?: number; className?: string }) {
  const art = useBlockArt();
  const b = getBlock(blockId);
  const id = art?.[blockId];
  if (id) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={assetUrl(id)} alt="" width={size} height={size} className={clsx("shrink-0 object-contain", className)} style={{ width: size, height: size }} />;
  }
  const c = b?.color ?? "#C9AE8C";
  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <div className="absolute inset-[8%] rounded-[26%]" style={{ background: `linear-gradient(145deg, ${c}33, ${c}66)`, boxShadow: `inset 0 -${size * 0.08}px 0 ${c}40, inset 0 ${size * 0.04}px 0 #ffffffaa, 0 ${size * 0.06}px ${size * 0.14}px -${size * 0.04}px ${c}80` }} />
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: c }}>
        <Icon name={b?.icon ?? "box"} style={{ width: size * 0.4, height: size * 0.4, filter: "brightness(0.7)" }} strokeWidth={2} />
      </div>
    </div>
  );
}

/** A product picture: the generated render when there is one, otherwise a small drawn device in the chosen colour. */
export function Thumb({ assetId, design, className }: { assetId?: string | null; design?: Pick<DesignConfig, "color">; className?: string }) {
  if (assetId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={assetUrl(assetId)} alt="" className={clsx("object-cover", className)} />;
  }
  const c = design?.color ?? "#F2EBDD";
  return (
    <div className={clsx("flex items-center justify-center bg-sand", className)} aria-hidden>
      <svg viewBox="0 0 100 100" className="h-3/5 w-3/5">
        <ellipse cx="50" cy="88" rx="30" ry="5" fill="#00000012" />
        <rect x="20" y="24" width="60" height="60" rx="16" fill={c} stroke="#00000014" />
        <rect x="20" y="24" width="60" height="30" rx="16" fill="#ffffff30" />
        <rect x="34" y="40" width="32" height="22" rx="5" fill="#2b2f2c" />
        <circle cx="50" cy="72" r="3" fill="#00000030" />
      </svg>
    </div>
  );
}

export function Chip({ icon, children, className }: { icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-[13.5px]", className)}>
      {icon && <Icon name={icon} className="size-4 text-leaf" />}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx("inline-flex rounded-2xl border border-line bg-sand/50 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={clsx("flex items-center gap-2 rounded-xl px-5 py-2 text-[13.5px] transition", o.value === value ? "bg-card font-semibold shadow-soft" : "text-ink-2 hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const fmtDate = (d: string | Date, withYear = true) => new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
