import React from "react";
import { DecisionType } from "@/types/api";

interface DecisionChipProps {
  decision: DecisionType | string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const DecisionChip: React.FC<DecisionChipProps> = ({
  decision,
  className = "",
  size = "md",
}) => {
  const dec = (decision || "").toUpperCase();

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] font-semibold tracking-wider",
    md: "px-2.5 py-1 text-xs font-semibold tracking-wider",
    lg: "px-3 py-1.5 text-sm font-bold tracking-wider",
  };

  if (dec === "ALLOW") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses[size]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
        ALLOW
      </span>
    );
  }

  if (dec === "STEP_UP") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses[size]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
        STEP-UP
      </span>
    );
  }

  if (dec === "DENY" || dec === "BLOCKED") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 ${sizeClasses[size]} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
        {dec}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses[size]} ${className}`}
    >
      {decision || "-"}
    </span>
  );
};
