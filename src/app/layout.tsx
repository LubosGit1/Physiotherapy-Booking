import type { Metadata } from "next";
import "@fontsource-variable/hanken-grotesk";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Motion Physiotherapy", template: "%s | Motion Physiotherapy" },
  description: "Book physiotherapy and sports massage in Prague online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto max-w-6xl px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
