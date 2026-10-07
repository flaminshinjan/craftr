"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { PageHead, Shell } from "@/components/shell";
import { Card, Loading } from "@/components/ui";
import { API_URL, useMe } from "@/lib/api";

export default function SettingsPage() {
  const { data: me, isLoading } = useMe();
  const health = useQuery({ queryKey: ["health"], queryFn: async () => (await fetch(`${API_URL}/health`)).json() as Promise<Record<string, boolean>> });
  return (
    <Shell active="settings">
      <PageHead title="settings" />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="flex max-w-2xl flex-col gap-5">
          <Card className="flex items-center gap-4 p-6">
            <UserButton appearance={{ elements: { avatarBox: { width: 56, height: 56 } } }} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">{me?.name}</div>
              <div className="text-ink-2">{me?.email}</div>
              <div className="mt-1 text-[13px] text-ink-3">Click your picture to manage your account, password and sign-in methods.</div>
            </div>
            <SignOutButton>
              <button className="h-10 rounded-xl border border-line px-4 font-medium hover:bg-sand">Sign out</button>
            </SignOutButton>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Saved shipping address</h2>
            {me?.savedAddress ? (
              <p className="mt-2 text-ink-2">
                {me.savedAddress.fullName}, {me.savedAddress.phone}
                <br />
                {me.savedAddress.address}
                <br />
                {me.savedAddress.city}, {me.savedAddress.state} {me.savedAddress.pin}
              </p>
            ) : (
              <p className="mt-2 text-ink-3">None yet. Tick “Save this address” at checkout and it will appear here.</p>
            )}
          </Card>
          {me?.role === "admin" && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold">System</h2>
              <ul className="mt-3 flex flex-col gap-2 text-[14.5px]">
                {[["db", "Database (Neon)"], ["auth", "Sign-in (Clerk secret on the api)"], ["chat", "Claude (design, chat, firmware)"], ["images", "OpenAI images (renders, block art)"]].map(([k, label]) => (
                  <li key={k} className="flex items-center gap-3">
                    {health.data?.[k] ? <Check className="size-4 text-leaf" /> : <X className="size-4 text-rose" />} {label}
                  </li>
                ))}
              </ul>
              <Link href="/admin" className="mt-4 inline-block font-medium underline underline-offset-4">
                Open the admin console
              </Link>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}
