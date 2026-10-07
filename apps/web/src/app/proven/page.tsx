"use client";

import { useAuthModal } from "@/components/auth-link";
import { useAuth } from "@clerk/nextjs";
import { BLOCK_MAP } from "@craftr/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shuffle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Logo } from "@/components/shell";
import { BlockArt, Button, Chip, Loading, Notice, inr } from "@/components/ui";
import { API_URL, assetUrl, errorText, useApi } from "@/lib/api";
import type { TemplateSummary } from "@/lib/types";

export default function Proven() {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const router = useRouter();
  const openAuth = useAuthModal();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const q = useQuery({ queryKey: ["templates"], queryFn: async () => (await fetch(`${API_URL}/templates`)).json() as Promise<TemplateSummary[]> });

  const remix = async (templateId: string) => {
    if (!isSignedIn) return openAuth("sign-up");
    setBusy(templateId);
    setError("");
    try {
      const { id } = await api<{ id: string }>("/projects", { body: { templateId } });
      router.push(`/p/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy("");
    }
  };

  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Logo size={38} />
        <Avatar />
      </header>
      <main className="mx-auto max-w-[1080px] px-5 pb-20">
        <Link href="/" className="inline-flex items-center gap-2 text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <h1 className="mt-3 text-[40px] font-semibold">proven builds</h1>
        <p className="mt-1 max-w-xl text-[15px] text-ink-2">Designs that pass every Craftr check. Remix one to get your own copy, then change anything.</p>
        {error && <Notice className="mt-4">{error}</Notice>}
        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <Notice className="mt-6">Could not load the proven builds. Is the api running?</Notice>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {q.data!.map((t) => (
              <article key={t.id} className="flex flex-col rounded-3xl border border-line bg-card p-6">
                {t.previewAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(t.previewAssetId)} alt={`Photo-style render of the ${t.name}`} className="aspect-square w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center gap-1 rounded-2xl bg-sand/70">
                    {t.blocks.slice(0, 6).map((b, i) => (
                      <BlockArt key={i} blockId={b} size={i === 0 ? 76 : 56} />
                    ))}
                  </div>
                )}
                <h2 className="mt-5 text-[22px] font-semibold">{t.name}</h2>
                <p className="mt-1 text-ink-2">{t.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.features.slice(0, 4).map((f) => (
                    <Chip key={f.label} icon={f.icon} className="py-1.5">
                      {f.label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-4 text-[13px] text-ink-3">{t.blocks.map((b) => BLOCK_MAP[b]?.name).join(" · ")}</p>
                <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
                  <div className="text-[13px] text-ink-3">
                    <div>
                      {t.shape === "round" ? `⌀${t.outer.w} × ${t.outer.d}` : `${t.outer.w} × ${t.outer.h} × ${t.outer.d}`} mm · {t.battery}
                    </div>
                    <div className="mt-0.5 text-lg font-semibold text-ink">{inr(t.unitInr)} <span className="text-[13px] font-normal text-ink-3">prototype</span></div>
                  </div>
                  <Button variant="dark" loading={busy === t.id} disabled={!!busy} onClick={() => remix(t.id)}>
                    <Shuffle className="size-4" /> Remix
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
