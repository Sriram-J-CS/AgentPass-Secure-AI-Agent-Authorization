import type { Metadata } from "next";
import "./globals.css";
import { AgentPassProvider } from "@/context/AgentPassContext";
import { ToastContainer } from "@/components/common/ToastContainer";
import { ConfirmModal } from "@/components/common/ConfirmModal";

export const metadata: Metadata = {
  title: "AgentPass - AI Agent Security Gateway",
  description:
    "Key-bound, burn-after-use zero-trust authorization and real-time security dashboard for AI agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080C14] text-slate-100 antialiased min-h-screen">
        <AgentPassProvider>
          {children}
          <ToastContainer />
          <ConfirmModal />
        </AgentPassProvider>
      </body>
    </html>
  );
}
