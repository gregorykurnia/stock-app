import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
        <nav className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-6 text-sm">
          <Link href="/" className="font-bold text-gray-900 hover:text-blue-600">Stock Analysis</Link>
          <Link href="/" className="text-gray-500 hover:text-gray-900">Master Table</Link>
          <Link href="/portfolio" className="text-gray-500 hover:text-gray-900">Portfolio</Link>
          <Link href="/watchlist" className="text-gray-500 hover:text-gray-900">Watchlist</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
