import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Miguel Sueiro | Vinyl Intelligence",
  description: "Market intelligence and collection management for vinyl enthusiasts",
};

import Link from "next/link";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="mainWrapper">
          <header className="globalHeader">
            <Link href="/" className="globalTitle">
              Miguel Sueiro Record Collection
            </Link>
            <div id="header-portal" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }} />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
