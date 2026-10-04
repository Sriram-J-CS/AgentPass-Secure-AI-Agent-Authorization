import React from "react";
import { SeverityType } from "@/types/api";

export const SeverityBadge: React.FC<{
  severity: SeverityType | string | null | undefined;
  className?: string;
}> = ({ severity, className = "" }) => {
  const sev = (severity || "").toLowerCase();

  const styles: Record<string, string> = {
    info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    critical: "bg-rose-500/20 text-rose-300 border-rose-500/40 glow-red",
  };

  const style = styles[sev] || "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${style} ${className}`}
    >
      {sev || "info"}
    </span>
  );
};
