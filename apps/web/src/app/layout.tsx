import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const heading = Outfit({ variable: "--font-heading", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });
// The landing page sets its headlines in a tighter, heavier grotesque, as in the landing references.
const tight = Inter_Tight({ variable: "--font-tight", subsets: ["latin"], weight: ["600", "700", "800"] });

const title = "Craftr: describe it, build it, order it";
const description = "Describe a small electronic product. Craftr picks the parts, designs the enclosure, writes the firmware and gets it made.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://craftr-web.vercel.app"),
  title,
  description,
  // The card image comes from opengraph-image.png and twitter-image.png next to this file.
  openGraph: { title, description, siteName: "Craftr", type: "website", url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${code.variable} ${tight.variable} h-full`}>
      <body className="min-h-full">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" appearance={{ variables: { colorPrimary: "#1b1b1a", borderRadius: "0.75rem", fontFamily: "var(--font-body)" }, elements: { modalContent: { margin: "auto" } } }}>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
