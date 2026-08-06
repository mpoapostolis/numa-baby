import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Baby Tracker — Calm, private baby logging",
    description:
      "A private, local-first baby tracker for feeds, diapers, sleep, growth and gentle health notes.",
    applicationName: "Baby Tracker",
    icons: {
      icon: "/icon-192.png",
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Baby Tracker",
    },
    openGraph: {
      title: "Baby Tracker — Calm, private baby logging",
      description: "Private by design. Made for one tired hand.",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og-baby-tracker.png`, width: 1200, height: 630, alt: "Baby Tracker — Calm, private baby logging" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Baby Tracker — Calm, private baby logging",
      description: "Private by design. Made for one tired hand.",
      images: [`${origin}/og-baby-tracker.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f7f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
