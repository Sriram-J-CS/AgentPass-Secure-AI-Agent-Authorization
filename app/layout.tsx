import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPass — Continuous Identity & Runtime Security",
  description: "Runtime authorization and identity controls for AI agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}