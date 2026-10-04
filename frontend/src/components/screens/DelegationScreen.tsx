"use client";

import React, { useState, useEffect } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { api } from "@/lib/api";
import { PassRequestView } from "@/types/api";
import { EmptyState } from "@/components/common/EmptyState";
import {
  KeyRound,
  CheckCircle,
  XCircle,
  PlayCircle,
  PlusCircle,
  Clock,
  Shield,
  AlertTriangle,
} from "lucide-react";

export const DelegationScreen: React.FC = () => {
  const { refreshState, bootstrapDemo } = useAgentPass();
  const [requests, setRequests] = useState<PassRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await api.getPassRequests();
      setRequests(res.requests || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pass requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      setActionInProgress(id);
      await api.approvePassRequest(id);
      await loadRequests();
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionInProgress(id);
      await api.rejectPassRequest(id);
      await loadRequests();
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRequestNewPass = async () => {
    try {
      setActionInProgress("request");
      await api.requestPassDemo();
      await loadRequests();
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request pass");
    } finally {
      setActionInProgress("request");
      setTimeout(() => setActionInProgress(null), 500);
    }
  };

  const handleBootstrap = async () => {
    try {
      setActionInProgress("bootstrap");
      await bootstrapDemo();
      await loadRequests();
    } finally {
      setActionInProgress(null);
    }
  };

  const pendingList = requests.filter((r) => r.status === "pending");
  const historyList = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 glass-card rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Pass Requests & Delegation Flow
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Human authorization boundary. Untrusted AI agents must request a scoped, time-limited pass before the sidecar can claim tickets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRequestNewPass}
            disabled={actionInProgress !== null}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            <span>Request Pass</span>
          </button>
          <button
            onClick={handleBootstrap}
            disabled={actionInProgress !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-semibold cursor-pointer shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Quick Start (Bootstrap)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Requests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Pending Pass Requests ({pendingList.length})
          </h3>
          <span className="text-[11px] font-mono text-cyan-400">
            Awaiting Human Signature
          </span>
        </div>

        {pendingList.length === 0 ? (
          <EmptyState
            message="No pending pass requests."
            subtext="Click 'Request Pass' to simulate an agent requesting permission or 'Quick Start' to bootstrap."
            action={{
              label: "Request Pass Now",
              onClick: handleRequestNewPass,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingList.map((req) => (
              <div
                key={req.id}
                className="p-5 glass-card rounded-2xl border-cyan-500/30 glow-cyan-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
                      AI
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {req.agent_id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {req.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Request ID: {req.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actionInProgress === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionInProgress === req.id}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve Delegation</span>
                    </button>
                  </div>
                </div>

                {/* Task Purpose */}
                {req.task?.purpose && (
                  <div className="text-xs">
                    <span className="text-slate-400 font-medium">Stated Purpose:</span>{" "}
                    <span className="text-slate-200">{req.task.purpose}</span>
                  </div>
                )}

                {/* Scopes */}
                <div>
                  <span className="text-slate-400 text-xs font-medium block mb-1">
                    Requested Scopes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {req.scopes.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-800 text-cyan-300 border border-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Blast Radius Plain Words */}
                {req.blast_radius && (
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        Worst-Case Blast Radius Evaluation
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        TTL: {req.blast_radius.expires_in_minutes} min | Max Money: INR{" "}
                        {req.blast_radius.max_money}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-emerald-400 font-bold block mb-1">
                          Can Perform:
                        </span>
                        <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
                          {req.blast_radius.can.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20">
                        <span className="text-rose-400 font-bold block mb-1">
                          Strictly Restricted (Cannot):
                        </span>
                        <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                          {req.blast_radius.cannot.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Section */}
      {historyList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pass Requests History ({historyList.length})
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-800/60">
            {historyList.map((h) => (
              <div
                key={h.id}
                className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400 text-[11px]">{h.id}</span>
                  <span className="font-semibold text-slate-300">{h.agent_id}</span>
                  <span className="text-slate-500 truncate max-w-sm">
                    {h.task?.purpose || h.scopes.join(", ")}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                    h.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
