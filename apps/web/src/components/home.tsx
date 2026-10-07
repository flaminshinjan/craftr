"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Logo, NewButton } from "@/components/shell";
import { Notice, Spinner, Thumb, inr } from "@/components/ui";
import { errorText, useApi } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";

const IDEAS = ["a plant monitor", "a pet tracker", "a desk focus timer", "a voice recorder"];
const PENDING = "craftr:pending-prompt";

export function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"prompt" | "blocks" | null>(null);
  const [error, setError] = useState("");
  const recent = useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectSummary[]>("/projects"), enabled: !!isSignedIn });

  const start = async (kind: "prompt" | "blocks", text = prompt) => {
    if (kind === "prompt" && text.trim().length < 3) return setError("Describe what you want to build, in a sentence.");
    if (!isSignedIn) {
      sessionStorage.setItem(PENDING, kind === "prompt" ? text : "");
      return router.push("/sign-up");
    }
    setBusy(kind);
    setError("");
    try {
      const { id } = await api<{ id: string }>("/projects", { body: kind === "prompt" ? { prompt: text } : { blank: true } });
      router.push(kind === "prompt" ? `/p/${id}` : `/p/${id}/blocks`);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };

  // Restore an idea typed before signing in, and honour the "Build with blocks" shortcut.
  useEffect(() => {
    if (!isLoaded) return;
    const saved = sessionStorage.getItem(PENDING);
    if (saved && isSignedIn) {
      sessionStorage.removeItem(PENDING);
      setPrompt(saved);
    }
    if (isSignedIn && new URLSearchParams(location.search).has("blocks")) start("blocks");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <Logo size={38} />
        <div className="flex items-center gap-4">
          {isSignedIn && <NewButton />}
          <Avatar />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center px-5 pb-16">
        <Image src="/brand/sunflower.png" alt="" width={230} height={230} priority className="float mt-2 drop-shadow-[0_24px_24px_rgba(90,70,30,0.14)]" />
        <h1 className="mt-4 text-center text-[clamp(32px,5vw,50px)] font-semibold">what will you build today?</h1>

        <form
          className="mt-8 flex w-full items-center gap-3 rounded-[22px] border border-line bg-card py-2.5 pr-2.5 pl-7 shadow-soft focus-within:border-line-2"
          onSubmit={(e) => {
            e.preventDefault();
            start("prompt");
          }}
        >
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="describe your hardware idea..." aria-label="Describe your hardware idea" maxLength={2000} className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-3" />
          <button type="submit" disabled={!!busy} aria-label="Build it" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-tan text-white transition hover:bg-tan-dark disabled:opacity-60">
            {busy === "prompt" ? <Spinner className="size-5 text-white" /> : <ArrowRight className="size-6" />}
          </button>
        </form>
        {error && <Notice className="mt-3 w-full">{error}</Notice>}

        <div className="mt-8 grid w-full gap-6 sm:grid-cols-2">
          <Link href="/proven" className="group flex items-center gap-6 rounded-3xl border border-line bg-card px-8 py-7 transition hover:shadow-soft">
            <Tile color="#F2EBDD" accent="#5FA052" />
            <div>
              <h2 className="flex items-center gap-2 text-[22px] font-semibold">
                Proven Builds <ChevronRight className="size-5 text-ink-3 transition group-hover:translate-x-0.5" />
              </h2>
              <p className="mt-1 text-[15px] text-ink-3">Explore real hardware projects and remix them.</p>
            </div>
          </Link>
          <button onClick={() => start("blocks")} disabled={!!busy} className="group flex items-center gap-6 rounded-3xl border border-line bg-card px-8 py-7 text-left transition hover:shadow-soft">
            <Tile color="#D9B98E" accent="#3F7A38" stack />
            <div>
              <h2 className="flex items-center gap-2 text-[22px] font-semibold">
                Build with Blocks {busy === "blocks" ? <Spinner className="size-4" /> : <ChevronRight className="size-5 text-ink-3 transition group-hover:translate-x-0.5" />}
              </h2>
              <p className="mt-1 text-[15px] text-ink-3">Start from components and design your own.</p>
            </div>
          </button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {IDEAS.map((idea) => (
            <button key={idea} onClick={() => setPrompt(`Make me ${idea}`)} className="rounded-2xl border border-line bg-card px-6 py-3 text-[15px] transition hover:border-line-2 hover:shadow-soft">
              {idea}
            </button>
          ))}
        </div>

        {!!recent.data?.length && (
          <section className="mt-14 w-full">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Pick up where you left off</h2>
              <Link href="/projects" className="text-sm text-ink-2 underline-offset-4 hover:underline">
                All projects
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {recent.data.slice(0, 3).map((p) => (
                <Link key={p.id} href={`/p/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition hover:shadow-soft">
                  <Thumb assetId={p.previewAssetId} design={p.design} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-[13px] text-ink-3">{p.blockCount ? `${p.blockCount} blocks · ${inr(p.unitInr)}` : "In progress"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/** Small drawn block illustration for the two entry cards. */
function Tile({ color, accent, stack }: { color: string; accent: string; stack?: boolean }) {
  const cube = (x: number, y: number, s: number, c: string) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={s} height={s} rx={s * 0.24} fill={c} stroke="#0000001a" />
      <rect width={s} height={s * 0.5} rx={s * 0.24} fill="#ffffff35" />
      <circle cx={s / 2} cy={s * 0.58} r={s * 0.11} fill="#00000030" />
    </g>
  );
  return (
    <svg viewBox="0 0 110 100" className="h-[92px] w-[100px] shrink-0" aria-hidden>
      <ellipse cx="55" cy="92" rx="40" ry="5" fill="#00000010" />
      {stack ? (
        <>
          {cube(8, 48, 40, color)}
          {cube(54, 52, 38, "#F2EBDD")}
          {cube(34, 10, 38, accent)}
        </>
      ) : (
        <>
          {cube(22, 30, 60, color)}
          <rect x="36" y="50" width="26" height="26" rx="5" fill="#2b2f2c" />
          <path d="M55 30c0-12 4-18 4-18M59 16c6-6 14-4 14-4s-2 9-12 9M57 18c-6-5-13-2-13-2s3 8 12 7" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
