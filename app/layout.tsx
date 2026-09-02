import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Analysis",
  description: "Systematic US stock investment framework",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stocks",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6 overflow-x-auto whitespace-nowrap">
          <div className="max-w-screen-xl mx-auto flex items-center gap-1 sm:gap-2 h-14 text-sm">
            <Link href="/" className="flex items-center gap-2 font-bold text-[var(--foreground)] shrink-0 mr-3 sm:mr-5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              Stock Analysis
            </Link>
            <Link href="/" className="shrink-0 px-3 py-1.5 rounded-md font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.03] transition-colors">Master Table</Link>
            <Link href="/watchlist" className="shrink-0 px-3 py-1.5 rounded-md font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.03] transition-colors">Watchlist</Link>
            <Link href="/alerts" className="shrink-0 px-3 py-1.5 rounded-md font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.03] transition-colors">Price Alerts</Link>
            <Link href="/screener-draft" className="shrink-0 px-3 py-1.5 rounded-md font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.03] transition-colors">Screener Draft</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
