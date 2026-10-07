import Image from "next/image";
import Link from "next/link";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/brand/sunflower-sm.png" alt="" width={36} height={36} />
        <span className="font-display text-2xl font-semibold">Craftr</span>
      </Link>
      {children}
      <p className="text-sm text-ink-3">Describe it. Build it. Order it.</p>
    </main>
  );
}
