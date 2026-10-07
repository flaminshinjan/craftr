"use client";

import { BLOCKS } from "@craftr/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { AdminFrame } from "@/components/admin-frame";
import { BlockArt, Button, Notice, Spinner, inr } from "@/components/ui";
import { errorText, useApi, useBlockArt } from "@/lib/api";

export default function Page() {
  return (
    <AdminFrame tab="blocks">
      <Blocks />
    </AdminFrame>
  );
}

function Blocks() {
  const api = useApi();
  const qc = useQueryClient();
  const art = useBlockArt() ?? {};
  const info = useQuery({ queryKey: ["admin", "blocks"], queryFn: () => api<{ images: boolean }>("/admin/blocks") });
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState("");
  const stop = useRef(false);
  const missing = BLOCKS.filter((b) => !art[b.id]);

  const make = async (id: string) => {
    setBusy((b) => [...b, id]);
    try {
      await api(`/admin/blocks/${id}/art`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["block-art"] });
    } catch (e) {
      setError(`${id}: ${errorText(e)}`);
      stop.current = true;
    } finally {
      setBusy((b) => b.filter((x) => x !== id));
    }
  };
  const makeAll = async () => {
    stop.current = false;
    setError("");
    // Three at a time keeps well inside image rate limits.
    const queue = [...missing];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length && !stop.current) await make(queue.shift()!.id);
      }),
    );
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-ink-2">
          The verified block library. Art is generated with the image model and shown everywhere a block appears; blocks without art use a drawn tile. {BLOCKS.length - missing.length} of {BLOCKS.length} have art.
        </p>
        <Button variant="dark" onClick={makeAll} disabled={!missing.length || busy.length > 0 || info.data?.images === false} title={info.data?.images === false ? "Needs an OpenAI key on the api" : undefined}>
          <Sparkles className="size-4 text-sun" /> {busy.length ? `Generating (${missing.length} left)` : missing.length ? `Generate ${missing.length} missing` : "All blocks have art"}
        </Button>
      </div>
      {info.data?.images === false && <Notice tone="warn" className="mb-4">OPENAI_API_KEY is not set on the api, so art can't be generated.</Notice>}
      {error && <Notice className="mb-4">{error}</Notice>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {BLOCKS.map((b) => (
          <article key={b.id} className="flex flex-col items-center rounded-2xl border border-line bg-card p-4 text-center">
            <div className="relative">
              <BlockArt blockId={b.id} size={96} className={busy.includes(b.id) ? "opacity-30" : ""} />
              {busy.includes(b.id) && <Spinner className="absolute inset-0 m-auto size-6" />}
            </div>
            <h2 className="mt-2 text-[14.5px] font-semibold">{b.name}</h2>
            <p className="text-[12.5px] text-ink-3">
              {b.subtitle} · {inr(b.priceInr)}
            </p>
            <p className="font-mono text-[11px] text-ink-3">{b.id}</p>
            <Button size="sm" variant="ghost" className="mt-2" disabled={busy.length > 0 || info.data?.images === false} onClick={() => (setError(""), make(b.id))}>
              {art[b.id] ? "Regenerate" : "Generate art"}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
