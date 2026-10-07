"use client";

import { PARTNER_TYPES, type PartnerType } from "@craftr/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Globe, LocateFixed, Phone, Search } from "lucide-react";
import { useState } from "react";
import { AdminFrame } from "@/components/admin-frame";
import { Button, Card, Empty, Loading, Notice } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";
import type { FoundShop, Partner } from "@/lib/types";

const input = "mt-1 h-10 w-full rounded-xl border border-line bg-card px-3 outline-none focus:border-tan";
const BLANK = { name: "", type: "designer" as PartnerType, phone: "", contact: "", city: "" };
const linkBtn = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap transition";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Opens the phone's dialer, or the calling app on a computer. */
function Call({ phone, label }: { phone: string; label?: boolean }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={clsx(linkBtn, "bg-ink text-white hover:bg-black")}>
      <Phone className="size-3.5" />
      {label ? "Call" : phone}
    </a>
  );
}

function Site({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label="Website" title="Website" className={clsx(linkBtn, "border border-line bg-card hover:border-line-2")}>
      <Globe className="size-3.5" />
    </a>
  );
}

export default function Page() {
  return (
    <AdminFrame tab="partners">
      <Partners />
    </AdminFrame>
  );
}

function Partners() {
  const api = useApi();
  const qc = useQueryClient();
  const [form, setForm] = useState(BLANK);
  const q = useQuery({ queryKey: ["admin", "partners"], queryFn: () => api<Partner[]>("/admin/partners") });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "partners"] });
  const add = useMutation({ mutationFn: () => api("/admin/partners", { body: form }), onSuccess: () => (setForm(BLANK), done()) });
  const toggle = useMutation({ mutationFn: (p: Partner) => api(`/admin/partners/${p.id}`, { method: "PATCH", body: { active: !p.active } }), onSuccess: done });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <FindShops saved={q.data ?? []} onSaved={done} />
        <p className="mt-7 mb-4 text-ink-2">Designers, print shops, assemblers and couriers that orders are handed to.</p>
        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <Notice>{q.error.message}</Notice>
        ) : !q.data!.length ? (
          <Empty title="No partners yet" body="Add the designer who reviews enclosures and the shop that prints them. They then appear in the handoff menu on every order." />
        ) : (
          <Card>
            <ul>
              {q.data!.map((p) => (
                <li key={p.id} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
                  <span className="w-24 shrink-0 rounded-full bg-sand px-2.5 py-1 text-center text-[12.5px] font-medium capitalize">{p.type}</span>
                  <div className="min-w-0 flex-1">
                    <div className={p.active ? "font-semibold" : "font-semibold text-ink-3 line-through"}>{p.name}</div>
                    <div className="truncate text-[13px] text-ink-3">{[p.city, p.phone, p.contact].filter(Boolean).join(" · ") || "No contact details"}</div>
                    {p.notes && <div className="truncate text-[13px] text-ink-3">{p.notes}</div>}
                  </div>
                  <Site url={p.website} />
                  <Call phone={p.phone} label />
                  <Button size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(p)}>
                    {p.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Add a partner</h2>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label className="text-[13px] font-medium">
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          </label>
          <label className="text-[13px] font-medium">
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartnerType })} className={input}>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            Phone
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" className={input} />
          </label>
          <label className="text-[13px] font-medium">
            Email
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={input} />
          </label>
          <label className="text-[13px] font-medium">
            City
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
          </label>
          {add.isError && <Notice>{errorText(add.error)}</Notice>}
          <Button type="submit" variant="dark" loading={add.isPending}>Add partner</Button>
        </form>
      </Card>
    </div>
  );
}

function FindShops({ saved, onSaved }: { saved: Partner[]; onSaved: () => void }) {
  const api = useApi();
  const [where, setWhere] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const search = useMutation({ mutationFn: (location: string) => api<{ shops: FoundShop[] }>("/admin/partners/search", { body: { location } }) });
  const save = useMutation({
    mutationFn: (s: FoundShop) => api("/admin/partners", { body: { name: s.name, type: "printer", phone: s.phone, website: s.website, address: s.address, city: [s.area, s.city].filter(Boolean).join(", "), notes: [s.services, s.note].filter(Boolean).join(" ") } }),
    onSuccess: onSaved,
  });

  const nearMe = () => {
    setGeoError("");
    if (!navigator.geolocation) return setGeoError("This browser cannot share a location. Type a city instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const here = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        setWhere(here);
        search.mutate(`latitude and longitude ${here}`);
      },
      () => {
        setLocating(false);
        setGeoError("Location was not shared. Type a city instead.");
      },
      { timeout: 10_000 },
    );
  };

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Find 3D print shops</h2>
      <p className="mt-0.5 text-[13px] text-ink-3">Searches the web for print services near a place. Call them from here, or save one as a print partner.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (where.trim()) search.mutate(where);
        }}
      >
        <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or area, e.g. Kotturpuram, Chennai" aria-label="Location" className="h-11 min-w-0 flex-1 basis-56 rounded-xl border border-line bg-card px-3 outline-none focus:border-tan" />
        <Button type="submit" variant="dark" loading={search.isPending} disabled={!where.trim()}>
          {!search.isPending && <Search className="size-4" />}
          Search
        </Button>
        <Button type="button" loading={locating} disabled={search.isPending} onClick={nearMe}>
          {!locating && <LocateFixed className="size-4" />}
          Near me
        </Button>
      </form>
      {search.isPending && <p className="mt-3 text-[13px] text-ink-3">Searching the web. This takes about half a minute.</p>}
      {geoError && <Notice tone="warn" className="mt-3">{geoError}</Notice>}
      {search.isError && <Notice className="mt-3">{errorText(search.error)}</Notice>}
      {save.isError && <Notice className="mt-3">{errorText(save.error)}</Notice>}
      {search.data &&
        (!search.data.shops.length ? (
          <p className="mt-4 text-[13.5px] text-ink-2">No print shops found there. Try a nearby city.</p>
        ) : (
          <>
            <ul className="mt-4 border-t border-line">
              {search.data.shops.map((s) => {
                const have = saved.some((p) => same(p.name, s.name));
                return (
                  <li key={s.name + s.phone} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3.5">
                    <div className="min-w-0 flex-1 basis-64">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[13px] text-ink-3">{[s.area, s.city].filter(Boolean).join(", ")}{s.services && ` · ${s.services}`}</div>
                      {s.note && <div className="mt-0.5 text-[13px] text-ink-2">{s.note}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Site url={s.website} />
                      {s.phone ? <Call phone={s.phone} /> : <span className="text-[13px] text-ink-3">No phone listed</span>}
                      <Button size="sm" disabled={have || save.isPending} onClick={() => save.mutate(s)}>
                        {have ? "Saved" : "Save"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12.5px] text-ink-3">Phone numbers are read from the web and have not been checked.</p>
          </>
        ))}
    </Card>
  );
}
