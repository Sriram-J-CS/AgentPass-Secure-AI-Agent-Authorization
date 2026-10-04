"use client";

import React, { useState, useEffect } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { api } from "@/lib/api";
import { ApprovalView } from "@/types/api";
import { EmptyState } from "@/components/common/EmptyState";
import {
  UserCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Shield,
  Bot,
  Copy,
  Check,
  RotateCw,
} from "lucide-react";

export const ApprovalsScreen: React.FC = () => {
  const { state, refreshState } = useAgentPass();
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Live countdown timer state (ticks every second)
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const res = await api.getApprovals();
      const list = res.approvals || [];
      setApprovals(list);

      // Initialize countdowns
      const initial: Record<string, number> = {};
      list.forEach((app) => {
        initial[app.id] = app.seconds_left;
      });
      setCountdowns(initial);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  // Update countdowns every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, number> = {};
        for (const [id, sec] of Object.entries(prev)) {
          next[id] = Math.max(0, sec - 1);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDecision = async (
    approval: ApprovalView,
    decision: "approve" | "deny"
  ) => {
    try {
      setActionId(approval.id);
      setError(null);
      const res = await api.decideApproval(
        approval.id,
        decision,
        approval.request_hash
      );
      setDecisionResult(res);
      await loadApprovals();
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${decision} request`);
    } finally {
      setActionId(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const pastApprovals = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Human-in-the-Loop Approvals (Step-Up Guard)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            High-risk or anomalous actions are paused at the gateway. Each approval decision is cryptographically bound to the exact request body hash.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold">
            {pendingApprovals.length} Pending Actions
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Decision Result Banner */}
      {decisionResult && (
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col gap-1">
          <span className="font-bold text-white">Decision Executed Successfully:</span>
          <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-28 text-emerald-300">
            {JSON.stringify(decisionResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Pending Approvals List (Matching Image 7) */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Pending Authorization Requests
        </h3>

        {pendingApprovals.length === 0 ? (
          <EmptyState
            message="No step-up approvals pending."
            subtext="When an agent attempts a high-risk payment or exceeds behavior thresholds, it will appear here for your signature."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {pendingApprovals.map((app) => {
              const secondsLeft = countdowns[app.id] ?? app.seconds_left;
              const isProcessing = actionId === app.id;

              return (
                <div
                  key={app.id}
                  className="glass-card p-6 rounded-2xl border-amber-500/50 glow-amber ring-1 ring-amber-500/30 space-y-6"
                >
                  {/* Alert Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Security Approval Required
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Agent is requesting a sensitive policy-controlled action.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expires in: {secondsLeft}s</span>
                      </span>
                    </div>
                  </div>

                  {/* Main Grid: Action Details vs Agent Context (Matching Image 7) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Left: Action Details */}
                    <div className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                        Action Details
                      </span>

                      <div className="space-y-2 font-mono">
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Action:</span>
                          <span className="text-white font-bold">{app.action}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Tool:</span>
                          <span className="text-cyan-400">{app.tool}</span>
                        </div>
                        {app.params?.amount !== undefined && (
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Amount:</span>
                            <span className="text-amber-400 font-bold">
                              ₹{String(app.params.amount)}
                            </span>
                          </div>
                        )}
                        {app.params?.payee !== undefined && (
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Recipient / Payee:</span>
                            <span className="text-slate-200">
                              {String(app.params.payee)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Reasons:</span>
                          <span className="text-rose-400 font-sans font-medium text-right max-w-xs">
                            {app.reasons.join(", ")}
                          </span>
                        </div>
                      </div>

                      {/* Request Hash */}
                      <div className="pt-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                          Exact Request Hash Binding:
                        </span>
                        <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800 font-mono text-[11px]">
                          <span className="text-slate-300 truncate max-w-[280px]">
                            {app.request_hash}
                          </span>
                          <button
                            onClick={() => handleCopy(app.request_hash)}
                            className="text-slate-400 hover:text-white p-0.5"
                            title="Copy Hash"
                          >
                            {copiedHash === app.request_hash ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Agent Context */}
                    <div className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                        Agent Context
                      </span>

                      <div className="space-y-2 font-mono">
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Agent ID:</span>
                          <span className="text-cyan-400 font-bold">
                            {state?.sidecar?.agent_id || state?.pass?.agent_id || "FinanceBot"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Pass ID:</span>
                          <span className="text-slate-200 truncate max-w-[180px]">
                            {app.pass_id}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Risk Assessment:</span>
                          <span className="text-rose-400 font-bold">High Risk</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Created At:</span>
                          <span className="text-slate-300">
                            {new Date(app.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Raw Parameters */}
                      <div className="pt-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                          Full Request Parameters:
                        </span>
                        <pre className="p-2 rounded bg-black/40 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                          {JSON.stringify(app.params, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Approve & Deny Buttons (Matching Image 7) */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleDecision(app, "deny")}
                      disabled={isProcessing || secondsLeft <= 0}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{isProcessing ? "Processing..." : "Deny Request"}</span>
                    </button>
                    <button
                      onClick={() => handleDecision(app, "approve")}
                      disabled={isProcessing || secondsLeft <= 0}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isProcessing ? "Processing..." : "Approve Action"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History of Past Approvals */}
      {pastApprovals.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Resolved Approvals History ({pastApprovals.length})
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-800/60">
            {pastApprovals.map((app) => (
              <div
                key={app.id}
                className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400 text-[11px]">
                    {app.id}
                  </span>
                  <span className="font-semibold text-slate-300">{app.action}</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    [{app.tool}]
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                    app.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
