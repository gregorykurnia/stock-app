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
        <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center gap-4 sm:gap-6 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/" className="font-bold text-gray-900 hover:text-blue-600 shrink-0">Stock Analysis</Link>
          <Link href="/" className="text-gray-500 hover:text-gray-900 shrink-0">Master Table</Link>
          <Link href="/watchlist" className="text-gray-500 hover:text-gray-900 shrink-0">Watchlist</Link>
          <Link href="/alerts" className="text-gray-500 hover:text-gray-900 shrink-0">Price Alerts</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
