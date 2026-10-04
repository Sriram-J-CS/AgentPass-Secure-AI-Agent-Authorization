"use client";

import React, { useState, useEffect } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { api } from "@/lib/api";
import { AttackInfo, AttackRunResult } from "@/types/api";
import { DecisionChip } from "@/components/common/DecisionChip";
import { EmptyState } from "@/components/common/EmptyState";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Play,
  RotateCw,
  CheckCircle,
  XCircle,
  AlertOctagon,
  ArrowRight,
  Flame,
  Unlock,
  Radio,
  FileCode,
  Check,
} from "lucide-react";

export const AttackCenterScreen: React.FC = () => {
  const { state, refreshState, unfreezeChain, requestConfirm, resetDemo, bootstrapDemo } =
    useAgentPass();
  const [attacks, setAttacks] = useState<AttackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningName, setRunningName] = useState<string | null>(null);
  const [activeAttack, setActiveAttack] = useState<AttackInfo | null>(null);
  const [lastResult, setLastResult] = useState<AttackRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAttacks = async () => {
    try {
      setLoading(true);
      const res = await api.getAttacks();
      setAttacks(res.attacks || []);
      if (res.attacks?.length > 0 && !activeAttack) {
        setActiveAttack(res.attacks[0]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttacks();
  }, []);

  const handleRunAttack = async (attack: AttackInfo) => {
    if (!state?.sidecar?.has_ticket) {
      setError("Active pass and ticket required to test attacks. Click 'Bootstrap Demo' first.");
      return;
    }

    try {
      setRunningName(attack.id);
      setActiveAttack(attack);
      setError(null);
      const res = await api.runAttack(attack.id);
      setLastResult(res);
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attack run failed");
    } finally {
      setRunningName(null);
    }
  };

  const handleUnfreeze = (chainId: string) => {
    requestConfirm({
      title: "Unfreeze Security Chain",
      message: `Chain ${chainId} was frozen by burn-after-use protection when a spent ticket was re-submitted. Re-approving will mint fresh credentials and allow lawful operations to resume.`,
      confirmLabel: "Re-Approve Chain",
      onConfirm: async () => {
        await unfreezeChain(chainId);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Attack Center & Adversarial Simulations
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Test how AgentPass stops compromised agents, forged tickets, token theft, wire replay, and gateway bypass attempts via real HTTP requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={bootstrapDemo}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            Bootstrap Ticket
          </button>
          <button
            onClick={() =>
              requestConfirm({
                title: "Reset Demo Environment",
                message: "Wipe all attacks, clear database, and regenerate vault master keys?",
                confirmLabel: "Reset",
                isDestructive: true,
                onConfirm: resetDemo,
              })
            }
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold cursor-pointer transition-colors"
          >
            Reset Demo
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          {!state?.sidecar?.has_ticket && (
            <button
              onClick={bootstrapDemo}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Bootstrap Demo
            </button>
          )}
        </div>
      )}

      {/* Chain Frozen Banner */}
      {state?.chain?.state === "frozen" && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-200 flex items-center justify-between glow-red">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-white">
                CHAIN FROZEN (Attack Contained)
              </p>
              <p className="text-xs text-rose-300 mt-0.5">
                The gateway detected an anomaly (e.g. spent ticket reuse) and locked the chain to prevent unauthorized state manipulation.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUnfreeze(state.chain!.id)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/60 cursor-pointer transition-colors"
          >
            Re-Approve & Unfreeze
          </button>
        </div>
      )}

      {/* 6 Attack Cards Grid (Matching Image 5) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Available Attack Vectors ({attacks.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attacks.map((atk, index) => {
            const isRunning = runningName === atk.id;
            const isSelected = activeAttack?.id === atk.id;

            return (
              <div
                key={atk.id}
                className={`p-5 rounded-2xl glass-card flex flex-col justify-between transition-all ${
                  isSelected
                    ? "border-rose-500/50 glow-red ring-1 ring-rose-500/30"
                    : "hover:border-slate-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-xs font-mono font-bold text-slate-300 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        {atk.title}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      DENY
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                    {atk.description}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono">
                    <span className="text-slate-500 block text-[10px]">
                      EXPECTED OUTCOME:
                    </span>
                    <span className="text-rose-400 font-medium">
                      {atk.expected}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                    {atk.id}
                  </span>
                  <button
                    onClick={() => handleRunAttack(atk)}
                    disabled={runningName !== null}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isRunning ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Simulating...</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Run Demo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attack Simulation Detail View (Matching Image 6) */}
      {lastResult && activeAttack && (
        <div className="glass-card p-6 rounded-2xl border-rose-500/40 glow-red space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Attack Center</span>
              <span className="text-slate-600">&gt;</span>
              <span className="font-bold text-white">{activeAttack.title}</span>
              <span className="font-mono text-slate-500">({lastResult.trace_id})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunAttack(activeAttack)}
                disabled={runningName !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Run Again</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Scenario & Payload Excerpt (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Scenario Overview
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeAttack.description}
                </p>

                <div className="pt-2 border-t border-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Result:</span>
                    <span className="font-mono text-rose-400 font-semibold">
                      DENY ({activeAttack.expected})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gateway Defense Summary:</span>
                    <span className="text-slate-200 text-right max-w-xs">
                      {lastResult.summary}
                    </span>
                  </div>
                  {lastResult.chain_state && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chain State:</span>
                      <span
                        className={`font-mono uppercase font-bold ${
                          lastResult.chain_state === "frozen"
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {lastResult.chain_state} (seq #{lastResult.chain_seq})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Attempts List */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Gateway HTTP Responses ({lastResult.attempts.length})
                </span>
                {lastResult.attempts.map((att, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-sans font-medium text-slate-200">
                        {att.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Reason: <strong className="text-rose-300">{att.reason || "DENY"}</strong>
                        {att.alert && ` | Alert: ${att.alert}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        HTTP {att.http_status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          att.blocked
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {att.blocked ? "BLOCKED" : "ALLOWED"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Security Pipeline Checklist (Matching Image 6) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    AgentPass Security Pipeline
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400">
                    Deterministic Zero-Trust
                  </span>
                </div>

                {/* Pipeline Checklist */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-slate-200">Identity Verification</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      Process Isolation / JWK
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-slate-200">Proof-of-Possession</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      ES256 Signature + Nonce
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span className="font-semibold text-slate-200">Scope Check</span>
                    </div>
                    <span className="font-mono text-[11px] text-rose-400">
                      Enforced against Pass
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span className="font-semibold text-slate-200">Intent Analysis</span>
                    </div>
                    <span className="font-mono text-[11px] text-rose-400">
                      Task Boundary Guard
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span className="font-semibold text-slate-200">Behavior Check</span>
                    </div>
                    <span className="font-mono text-[11px] text-rose-400">
                      Anomaly Score Evaluated
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span className="font-semibold text-slate-200">Risk Assessment</span>
                    </div>
                    <span className="font-mono text-[11px] text-rose-400">
                      Critical Intervention
                    </span>
                  </div>
                </div>

                {/* Final Decision Box */}
                <div className="mt-4 p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs tracking-wider">
                      DENY
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">
                        Action Blocked by Gateway Policy
                      </span>
                      <span className="text-[11px] text-rose-300">
                        {lastResult.summary}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
