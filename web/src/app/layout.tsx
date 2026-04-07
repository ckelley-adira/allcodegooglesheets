/**
 * @file layout.tsx — Root layout for Adira Reads
 *
 * Provides the HTML shell, global CSS, and font configuration.
 * Uses system font stack instead of Google Fonts for offline-friendly builds.
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adira Reads",
  description: "UFLI structured literacy progress tracking for partner schools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
