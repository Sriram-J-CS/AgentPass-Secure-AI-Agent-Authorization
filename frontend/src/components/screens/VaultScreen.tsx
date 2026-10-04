"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { VaultSecret } from "@/types/api";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Lock,
  ShieldCheck,
  Key,
  Plus,
  AlertTriangle,
  Info,
  Clock,
  EyeOff,
  Copy,
  Check,
  X,
} from "lucide-react";

export const VaultScreen: React.FC = () => {
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);

  const loadVault = async () => {
    try {
      setLoading(true);
      const res = await api.getVault();
      setSecrets(res.secrets || []);
      setNote(res.note || "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVault();
  }, []);

  const handleCopy = (fp: string) => {
    navigator.clipboard.writeText(fp);
    setCopiedFingerprint(fp);
    setTimeout(() => setCopiedFingerprint(null), 1500);
  };

  const getToolDisplayName = (name: string) => {
    if (name.includes("EMAIL")) return { display: "Gmail / Email API", tool: "tool: email" };
    if (name.includes("PAY")) return { display: "Stripe / Banking API", tool: "tool: payment" };
    if (name.includes("FILES")) return { display: "Google Drive / Files API", tool: "tool: files" };
    return { display: name, tool: "tool: generic" };
  };

  return (
    <div className="space-y-6">
      {/* Header (Matching Image 9) */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Key Vault
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Credentials stay outside the agent runtime. Upstream API keys are decrypted exclusively within the gateway at the moment of dispatch.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credential</span>
        </button>
      </div>

      {/* Security Note Banner */}
      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-3">
        <EyeOff className="w-5 h-5 text-cyan-400 shrink-0" />
        <div>
          <span className="font-bold text-white block">Absolute Zero-Knowledge Guarantee</span>
          <span className="text-cyan-300/90 text-[11px]">
            {note ||
              "Secret values are never returned by the API and never stored in agent context. Encrypted with AES-256-GCM."}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Secret Cards Grid (Matching Image 9) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {secrets.length === 0 ? (
          <div className="col-span-full">
            <EmptyState message="No secrets found in vault." />
          </div>
        ) : (
          secrets.map((sec) => {
            const { display, tool } = getToolDisplayName(sec.name);
            return (
              <div
                key={sec.name}
                className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {display}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          {sec.name}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Stored
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {tool}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      AES-256-GCM
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">FINGERPRINT:</span>
                      <div className="flex items-center gap-1.5 text-cyan-300">
                        <span>{sec.fingerprint}</span>
                        <button
                          onClick={() => handleCopy(sec.fingerprint)}
                          className="p-0.5 text-slate-500 hover:text-white"
                          title="Copy fingerprint"
                        >
                          {copiedFingerprint === sec.fingerprint ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">USAGE COUNT:</span>
                      <span className="text-white font-bold">{sec.uses} dispatches</span>
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">LAST USED:</span>
                      <span className="text-slate-300">
                        {sec.last_used
                          ? new Date(sec.last_used).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Never exposed to AI agent
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Credential Information Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0D1526] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl glow-cyan">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Vault Ingestion</h3>
                <span className="text-[11px] font-mono text-cyan-400">
                  Hardware Security Module / KMS
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              In production, credentials are injected via environment secrets, AWS KMS, or HashiCorp Vault. The gateway encrypts and binds secrets with AES-256-GCM using authenticated additional data (AAD).
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 mb-6">
              Default seeded secrets: <strong className="text-white">EMAIL_API_KEY</strong>,{" "}
              <strong className="text-white">PAY_API_KEY</strong>,{" "}
              <strong className="text-white">FILES_API_KEY</strong>.
            </div>

            <button
              onClick={() => setShowAddModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg transition-colors cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
