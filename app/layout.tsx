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

// El mismo nombre que la cabecera. Antes la pestaña del navegador decía
// "Vinyl Intelligence" y la página "Record Collection": dos nombres para lo
// mismo, y ninguno de los dos aparecía en el otro sitio.
export const metadata: Metadata = {
  title: "Miguel Sueiro Record Collection",
  description: "Colección de vinilos, con precios de mercado y valor estimado.",
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
