"use client";

import React, { useState } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { AlertOctagon, X } from "lucide-react";

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirm } = useAgentPass();
  const [submitting, setSubmitting] = useState(false);

  if (!confirmDialog) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await confirmDialog.onConfirm();
      closeConfirm();
    } catch {
      // Handled in caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0D1526] border border-rose-500/40 rounded-2xl p-6 shadow-2xl glow-red">
        <button
          onClick={closeConfirm}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="p-3 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {confirmDialog.title}
            </h3>
            <span className="text-[11px] font-mono text-rose-400 uppercase tracking-widest">
              Destructive Action
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {confirmDialog.message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeConfirm}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            {confirmDialog.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-lg shadow-rose-950/50 border border-rose-500 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Processing..." : confirmDialog.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};
