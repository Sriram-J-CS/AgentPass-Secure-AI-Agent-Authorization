"use client";

import React from "react";
import { useAgentPass, ToastMessage } from "@/context/AgentPassContext";
import { AlertTriangle, CheckCircle, Info, ShieldAlert, X } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useAgentPass();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast: ToastMessage) => {
        let borderClass = "border-slate-700 bg-slate-900";
        let Icon = Info;
        let iconColor = "text-sky-400";

        if (toast.type === "success") {
          borderClass = "border-emerald-500/50 bg-[#0A1A17] text-emerald-300";
          Icon = CheckCircle;
          iconColor = "text-emerald-400";
        } else if (toast.type === "critical") {
          borderClass = "border-rose-500 bg-[#1F0E13] text-rose-200 glow-red animate-pulse-glow";
          Icon = ShieldAlert;
          iconColor = "text-rose-400";
        } else if (toast.type === "warn" || toast.type === "error") {
          borderClass = "border-amber-500/50 bg-[#1A150A] text-amber-200";
          Icon = AlertTriangle;
          iconColor = "text-amber-400";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 ${borderClass}`}
          >
            <div className="mt-0.5 shrink-0">
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white tracking-wide">{toast.title}</p>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{toast.message}</p>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {toast.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
