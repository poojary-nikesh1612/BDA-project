import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Weather Data Analyzer — Meteorological Analytics & Data Quality Platform",
  description:
    "Ingest weather CSV datasets, validate and remediate observation quality, and run real-time MongoDB aggregation analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-sky-500/15 selection:text-sky-900`}
      >
        {children}
      </body>
    </html>
  );
}
