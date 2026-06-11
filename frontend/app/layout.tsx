import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plabber - RSS Pipeline",
  description: "PR TIMES digest pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
