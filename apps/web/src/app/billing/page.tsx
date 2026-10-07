"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Coins, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHead, Shell } from "@/components/shell";
import { Button, Card, Loading, Notice, fmtDate, inr } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";

interface Billing {
  margin: number;
  signupCredits: number;
  plans: { id: string; name: string; priceInr: number; credits: number; blurb: string; perks: string[] }[];
  packs: { id: string; name: string; priceInr: number; credits: number }[];
  actions: { id: string; label: string; detail: string; credits: number }[];
  credits: number;
  plan: string;
  planRenewsAt: string | null;
  canManage: boolean;
  configured: boolean;
  testMode: boolean;
  unlimited: boolean;
  ledger: { id: string; delta: number; balance: number; reason: string; createdAt: string }[];
}

export default function BillingPage() {
  const api = useApi();
  const qc = useQueryClient();
  const [justPaid, setJustPaid] = useState(false);
  // After returning from checkout the credits arrive by webhook, so poll briefly until they land.
  const q = useQuery({ queryKey: ["billing"], queryFn: () => api<Billing>("/billing"), refetchInterval: justPaid ? 2500 : false });
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("paid")) return;
    setJustPaid(true);
    const t = setTimeout(() => setJustPaid(false), 40_000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => void qc.invalidateQueries({ queryKey: ["me"] }), [q.data?.credits, q.data?.plan, qc]);

  const go = useMutation({
    mutationFn: (body: { kind: "plan" | "pack"; id: string } | "portal") => (body === "portal" ? api<{ url: string }>("/billing/portal", { method: "POST" }) : api<{ url: string }>("/billing/checkout", { body })),
    onSuccess: ({ url }) => void (location.href = url),
  });
  const b = q.data;

  return (
    <Shell active="billing">
      <PageHead title="billing" subtitle="Credits pay for the AI work: planning, firmware and pictures. Hardware orders are priced separately at checkout." />
      {q.isLoading ? (
        <Loading />
      ) : !b ? (
        <Notice>{q.error?.message ?? "Could not load billing."}</Notice>
      ) : (
        <div className="flex max-w-[1100px] flex-col gap-6">
          {justPaid && <Notice tone="ok">Payment received. Your credits appear here within a few seconds.</Notice>}
          {!b.configured && <Notice tone="warn">Payments are not connected yet, so plans and packs can't be bought. Add the Dodo Payments keys on the api to turn this on.</Notice>}
          {b.configured && b.testMode && <Notice tone="info">Dodo Payments is in test mode: checkout works with test cards and no real money moves.</Notice>}
          {go.isError && <Notice>{errorText(go.error)}</Notice>}

          <Card className="flex flex-wrap items-center gap-5 p-6">
            <span className="flex size-14 items-center justify-center rounded-full bg-sun-soft">
              <Coins className="size-6 text-sun" />
            </span>
            <div className="flex-1">
              <div className="text-[13.5px] text-ink-3">Credit balance</div>
              <div className="text-[34px] leading-tight font-semibold tabular-nums">{b.unlimited ? "Unlimited" : b.credits.toLocaleString("en-IN")}</div>
              <div className="text-[13.5px] text-ink-2">
                {b.unlimited ? "Admins are not charged credits." : `${b.plans.find((p) => p.id === b.plan)?.name ?? "Free"} plan${b.planRenewsAt ? `, next ${b.plans.find((p) => p.id === b.plan)?.credits} credits on ${fmtDate(b.planRenewsAt)}` : ""}`}
              </div>
            </div>
            {b.canManage && (
              <Button onClick={() => go.mutate("portal")} loading={go.isPending && go.variables === "portal"}>
                Manage subscription <ExternalLink className="size-4" />
              </Button>
            )}
          </Card>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Plans</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {b.plans.map((p) => {
                const current = b.plan === p.id;
                return (
                  <Card key={p.id} className={clsx("flex flex-col p-6", current && "border-leaf/50 bg-leaf-soft/40")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{p.name}</h3>
                      {current && <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[12px] font-medium text-leaf-dark">Current</span>}
                    </div>
                    <div className="mt-2 text-[30px] leading-tight font-semibold tabular-nums">
                      {p.priceInr ? inr(p.priceInr) : "₹0"} <span className="text-[14px] font-normal text-ink-3">{p.priceInr ? "/ month" : "forever"}</span>
                    </div>
                    <p className="mt-1 text-[14px] text-ink-2">{p.blurb}</p>
                    <ul className="mt-4 flex flex-1 flex-col gap-2 text-[14px]">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-leaf" /> {perk}
                        </li>
                      ))}
                    </ul>
                    {p.priceInr > 0 && (
                      <Button variant={current ? "light" : "dark"} className="mt-5" disabled={!b.configured || current || (b.plan !== "free" && !current) || go.isPending} loading={go.isPending && typeof go.variables === "object" && go.variables.id === p.id} title={b.plan !== "free" && !current ? "Use Manage subscription to switch plans" : undefined} onClick={() => go.mutate({ kind: "plan", id: p.id })}>
                        {current ? "Your plan" : `Subscribe to ${p.name}`}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-xl font-semibold">Top up</h2>
              <div className="grid grid-cols-2 gap-4">
                {b.packs.map((p) => (
                  <Card key={p.id} className="p-5">
                    <div className="text-lg font-semibold">{p.name}</div>
                    <div className="text-ink-2">{inr(p.priceInr)} once</div>
                    <Button className="mt-4 w-full" disabled={!b.configured || go.isPending} loading={go.isPending && typeof go.variables === "object" && go.variables.id === p.id} onClick={() => go.mutate({ kind: "pack", id: p.id })}>
                      Buy
                    </Button>
                  </Card>
                ))}
              </div>
              <h2 className="mt-7 mb-3 text-xl font-semibold">What credits buy</h2>
              <Card>
                <ul>
                  {b.actions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0">
                      <span>
                        <span className="block font-medium">{a.label}</span>
                        <span className="block text-[13px] text-ink-3">{a.detail}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{a.credits} credits</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <p className="mt-2 text-[13px] text-ink-3">Editing by hand, Build with Blocks, the 3D model, downloads and a build's first picture are free. If an AI action fails, its credits are returned.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Recent activity</h2>
              <Card>
                {!b.ledger.length ? (
                  <p className="px-5 py-8 text-center text-ink-3">Nothing yet. You started with {b.signupCredits} free credits.</p>
                ) : (
                  <ul>
                    {b.ledger.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-[14px] last:border-0">
                        <span>
                          <span className="block">{l.reason}</span>
                          <span className="block text-[12.5px] text-ink-3">{fmtDate(l.createdAt)}</span>
                        </span>
                        <span className={clsx("shrink-0 font-semibold tabular-nums", l.delta > 0 ? "text-leaf-dark" : "text-ink")}>
                          {l.delta > 0 ? "+" : ""}
                          {l.delta}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </div>
        </div>
      )}
    </Shell>
  );
}
