"use client";

import { useUser } from "@clerk/nextjs";
import { orderTotals } from "@craftr/core";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, CreditCard, Landmark, Leaf, Lock, Pencil, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotReady, ProjectPage } from "@/components/project-parts";
import { PageHead } from "@/components/shell";
import { Card, Notice, Spinner, Thumb, inr } from "@/components/ui";
import { errorText, useApi, useMe } from "@/lib/api";
import { useTier } from "@/lib/tier";
import type { Address, Project } from "@/lib/types";

const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
const METHODS = [
  { id: "card", name: "Card", hint: "Credit or Debit card (Visa, Mastercard, RuPay)", icon: CreditCard },
  { id: "upi", name: "UPI", hint: "Pay using any UPI app (Google Pay, PhonePe, Paytm)", icon: Smartphone },
  { id: "netbanking", name: "Net Banking", hint: "Pay directly from your bank account", icon: Landmark },
];
const EMPTY: Address = { fullName: "", phone: "", email: "", address: "", city: "", state: "", pin: "" };

export default function Page() {
  return <ProjectPage active="manufacturing">{(p, s) => (p.nodes.length ? <Checkout p={p} /> : <NotReady project={p} generating={s.generating} />)}</ProjectPage>;
}

function Checkout({ p }: { p: Project }) {
  const api = useApi();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useUser();
  const { data: me } = useMe();
  const [tierId] = useTier(p.id);
  const [a, setA] = useState<Address>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState("card");
  const [saveAddress, setSaveAddress] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tier = p.compiled.pricing.tiers.find((t) => t.id === tierId) ?? p.compiled.pricing.tiers[0];
  const totals = orderTotals(tier.unitInr, tier.qty);
  const blocked = p.compiled.checks.find((c) => c.level === "error");

  // Start from the account's name and email so there is less to type.
  useEffect(() => {
    if (touched) return;
    setA((cur) => ({ ...cur, fullName: cur.fullName || user?.fullName || "", email: cur.email || user?.primaryEmailAddress?.emailAddress || "" }));
  }, [user, touched]);

  const field = (k: keyof Address) => ({ value: a[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (setTouched(true), setA((cur) => ({ ...cur, [k]: e.target.value }))) });
  const input = "mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-tan";

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id } = await api<{ id: string }>("/orders", { body: { projectId: p.id, tier: tier.id, shipping: a, paymentMethod: method, saveAddress } });
      qc.invalidateQueries({ queryKey: ["me"] });
      router.push(`/orders/${id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={pay} className="mx-auto max-w-[1180px]">
      <PageHead title="checkout" subtitle={`Complete your order to get your ${p.name}.`} back={`/p/${p.id}/manufacturing`} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-4 text-[22px] font-semibold">
              <span className="flex size-10 items-center justify-center rounded-full bg-sand text-base">1</span> Shipping address
            </h2>
            {me?.savedAddress && (
              <button type="button" onClick={() => (setTouched(true), setA(me.savedAddress!))} className="text-[14px] text-ink-2 underline underline-offset-4">
                Use saved address
              </button>
            )}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-6">
            <label className="text-[14px] font-medium sm:col-span-6">
              Full name
              <input required autoComplete="name" className={input} {...field("fullName")} />
            </label>
            <label className="text-[14px] font-medium sm:col-span-3">
              Phone number
              <input required type="tel" autoComplete="tel" placeholder="+91 98765 43210" className={input} {...field("phone")} />
            </label>
            <label className="text-[14px] font-medium sm:col-span-3">
              Email <span className="font-normal text-ink-3">(optional)</span>
              <input type="email" autoComplete="email" className={input} {...field("email")} />
            </label>
            <label className="text-[14px] font-medium sm:col-span-6">
              Address
              <textarea required rows={2} autoComplete="street-address" className={clsx(input, "h-auto py-3")} {...field("address")} />
            </label>
            <label className="text-[14px] font-medium sm:col-span-2">
              City
              <input required autoComplete="address-level2" className={input} {...field("city")} />
            </label>
            <label className="text-[14px] font-medium sm:col-span-2">
              State
              <select required autoComplete="address-level1" className={input} {...field("state")}>
                <option value="" disabled>
                  Select
                </option>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-[14px] font-medium sm:col-span-2">
              PIN code
              <input required inputMode="numeric" pattern="\d{6}" maxLength={6} title="6 digit PIN code" autoComplete="postal-code" className={input} {...field("pin")} />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-3 text-[14px] text-ink-2">
            <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-5 accent-ink" /> Save this address for future orders
          </label>

          <h2 className="mt-8 flex items-center gap-4 border-t border-line pt-7 text-[22px] font-semibold">
            <span className="flex size-10 items-center justify-center rounded-full bg-sand text-base">2</span> Payment method
          </h2>
          <div className="mt-5 flex flex-col gap-3" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <label key={m.id} className={clsx("flex cursor-pointer items-center gap-5 rounded-2xl border px-5 py-4 transition", method === m.id ? "border-tan bg-sand/40" : "border-line bg-card")}>
                <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="size-5 accent-ink" />
                <m.icon className="size-7" strokeWidth={1.6} />
                <span>
                  <span className="block text-[16px] font-semibold">{m.name}</span>
                  <span className="block text-[13.5px] text-ink-3">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-7 lg:sticky lg:top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-semibold">Order summary</h2>
            <Link href={`/p/${p.id}/bom`} className="flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-[13.5px] font-medium">
              <Pencil className="size-3.5" /> Edit cart
            </Link>
          </div>
          <div className="mt-4 flex gap-5 border-b border-line pb-6">
            <Thumb assetId={p.previewAssetId} design={p.design} className="size-32 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.name}</div>
              <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-3">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-sand px-3 py-1 text-[13px]">Qty: {tier.qty}</span>
                <span className="font-semibold tabular-nums">{inr(tier.unitInr)}{tier.qty > 1 && " each"}</span>
              </div>
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-3 text-[16px]">
            {[["Product cost", totals.subtotal], ["Shipping", totals.shipping], ["Tax (GST 18%)", totals.tax]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-medium tabular-nums">{inr(v as number)}</dd>
              </div>
            ))}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-5">
              <dt className="text-[22px] font-semibold">Total</dt>
              <dd className="text-[28px] font-semibold tabular-nums">{inr(totals.total)}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-2xl bg-sand/60 p-5">
            <div className="flex items-center gap-3 font-semibold">
              <Leaf className="size-4 text-leaf" /> What's included
            </div>
            {[`${p.name} (pre-assembled, firmware flashed)`, "USB-C charging cable", "Quick start guide", "Design files and source code"].map((x) => (
              <div key={x} className="mt-2 flex items-center gap-3 pl-1 text-[14px] text-ink-2">
                <Check className="size-3.5" /> {x}
              </div>
            ))}
          </div>
          {blocked && <Notice className="mt-4">This design has a problem that must be fixed before it can be built: {blocked.title}.</Notice>}
          {error && <Notice className="mt-4">{error}</Notice>}
          <button type="submit" disabled={busy || !!blocked} className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-ink text-[18px] font-semibold text-white hover:bg-black disabled:opacity-50">
            {busy ? <Spinner className="size-5 text-white" /> : <Lock className="size-4" />} Pay {inr(totals.total)}
          </button>
          <p className="mt-4 flex items-start justify-center gap-2.5 text-center text-[13px] text-ink-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              <b className="font-semibold text-ink-2">Test mode.</b> Payments are simulated for now: no money is taken and no card details are asked for. Your order is still created and tracked.
            </span>
          </p>
        </Card>
      </div>
    </form>
  );
}
