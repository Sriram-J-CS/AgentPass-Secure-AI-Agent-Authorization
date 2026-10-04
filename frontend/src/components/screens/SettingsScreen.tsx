"use client";

import React, { useState } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { API_BASE_URL } from "@/lib/api";
import {
  Settings,
  Key,
  Shield,
  RotateCcw,
  Cpu,
  Wifi,
  Lock,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

export const SettingsScreen: React.FC = () => {
  const { state, connected, sidecarReachable, resetDemo, bootstrapDemo, requestConfirm } =
    useAgentPass();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const sidecar = state?.sidecar;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              System Settings & Cryptographic Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Gateway telemetry configuration, process isolation parameters, and public JWK thumbprints.
          </p>
        </div>

        <button
          onClick={() =>
            requestConfirm({
              title: "Wipe and Reset Environment",
              message: "This will wipe all active passes, chains, audit records, and re-generate vault keys.",
              confirmLabel: "Reset Demo",
              isDestructive: true,
              onConfirm: resetDemo,
            })
          }
          className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer transition-colors"
        >
          Reset Demo State
        </button>
      </div>

      {/* Connectivity & Service Topology */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Gateway Service */}
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                AgentPass Gateway
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                connected
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {connected ? "Online" : "Offline"}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">API BASE URL:</span>
              <span className="text-cyan-400 font-bold">{API_BASE_URL}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">SERVER TIME:</span>
              <span className="text-slate-300">
                {state?.server_time ? new Date(state.server_time).toLocaleString() : "-"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">CRYPTO SUITE:</span>
              <span className="text-slate-200">ECDSA (P-256) + SHA-256</span>
            </div>
          </div>
        </div>

        {/* Sidecar Service */}
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Signer Sidecar (:8001)
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                sidecarReachable
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {sidecarReachable ? "Reachable" : "Unreachable"}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">KEY EXTRACTABLE:</span>
              <span className="text-emerald-400 font-bold">
                {sidecar?.key_extractable === false ? "False (Process Isolated)" : "False"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">CLAIM STATUS:</span>
              <span className="text-cyan-400 uppercase">
                {sidecar?.claim_status || "Waiting"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-500">HAS TICKET:</span>
              <span className="text-white">
                {sidecar?.has_ticket ? "True (Ready)" : "False (Unclaimed)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Public JWK Thumbprint Card */}
      {sidecar?.jwk && (
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Signer Sidecar Public Key (JWK)
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">
              Thumbprint: {sidecar.key_thumbprint}
            </span>
          </div>

          <pre className="p-4 rounded-xl bg-black/60 border border-slate-800 text-slate-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
            {JSON.stringify(sidecar.jwk, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
