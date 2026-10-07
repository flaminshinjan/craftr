"use client";

import { PARTNER_TYPES, type PartnerType } from "@craftr/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminFrame } from "@/components/admin-frame";
import { Button, Card, Empty, Loading, Notice } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";
import type { Partner } from "@/lib/types";

const input = "mt-1 h-10 w-full rounded-xl border border-line bg-card px-3 outline-none focus:border-tan";
const BLANK = { name: "", type: "designer" as PartnerType, contact: "", city: "" };

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
        <p className="mb-4 text-ink-2">Designers, print shops, assemblers and couriers that orders are handed to.</p>
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
                    <div className="truncate text-[13px] text-ink-3">{[p.city, p.contact].filter(Boolean).join(" · ") || "No contact details"}</div>
                  </div>
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
            Contact
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Email or phone" className={input} />
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
