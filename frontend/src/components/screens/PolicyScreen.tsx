"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PolicyResponse } from "@/types/api";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Sliders,
  Shield,
  Clock,
  Activity,
  AlertTriangle,
  Code,
  Lock,
} from "lucide-react";

export const PolicyScreen: React.FC = () => {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const data = await api.getPolicy();
      setPolicy(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Policy & Risk Threshold Rules
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Deterministic, pure rules governing agent access. Defines risk tiers, HTTP endpoint mappings, and behavior thresholds without opaque ML models.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold">
          Zero ML • Deterministic
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Threshold Metrics Row */}
      {policy?.thresholds && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Behavior Step-Up
            </span>
            <span className="text-xl font-bold font-mono text-amber-400 block">
              &gt;= {policy.thresholds.behavior_step_up} pts
            </span>
            <span className="text-[10px] text-slate-500">Forces human review</span>
          </div>

          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Behavior Deny
            </span>
            <span className="text-xl font-bold font-mono text-rose-400 block">
              &gt;= {policy.thresholds.behavior_deny} pts
            </span>
            <span className="text-[10px] text-slate-500">Blocks outright</span>
          </div>

          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Ticket TTL
            </span>
            <span className="text-xl font-bold font-mono text-cyan-400 block">
              {policy.thresholds.ticket_ttl_seconds}s
            </span>
            <span className="text-[10px] text-slate-500">One-time window</span>
          </div>

          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Proof Skew Window
            </span>
            <span className="text-xl font-bold font-mono text-cyan-400 block">
              {policy.thresholds.proof_window_seconds}s
            </span>
            <span className="text-[10px] text-slate-500">Anti-clock drift</span>
          </div>

          <div className="glass-card p-4 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Approval Expiry
            </span>
            <span className="text-xl font-bold font-mono text-amber-400 block">
              {policy.thresholds.approval_ttl_seconds}s
            </span>
            <span className="text-[10px] text-slate-500">Human timeout</span>
          </div>
        </div>
      )}

      {/* Tools & Actions Policy Table */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Tools & Action Endpoints Catalog
        </h3>

        {!policy?.tools ? (
          <EmptyState message="Loading policy definitions..." />
        ) : (
          <div className="space-y-6">
            {Object.entries(policy.tools).map(([toolName, toolConfig]) => (
              <div
                key={toolName}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white capitalize">
                      {toolName} Tool
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      (Secret: {toolConfig.secret})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Header: {toolConfig.auth_header}
                  </span>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {Object.entries(toolConfig.actions).map(([actionName, action]) => {
                    let riskBadge = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                    if (action.risk === "medium") {
                      riskBadge = "bg-amber-500/15 text-amber-400 border-amber-500/30";
                    } else if (action.risk === "high") {
                      riskBadge = "bg-rose-500/15 text-rose-400 border-rose-500/30";
                    }

                    return (
                      <div
                        key={actionName}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-cyan-300">
                            {actionName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {action.method} {action.path}
                          </span>
                          {action.untrusted_output && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Sets Taint
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-sans text-right max-w-sm hidden md:inline">
                            {action.description}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${riskBadge}`}
                          >
                            {action.risk} Risk
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Pass Configuration JSON */}
      {policy?.default_pass_request && (
        <div className="glass-card p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Default Delegation Template
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              agentpass/policy.py
            </span>
          </div>

          <pre className="p-4 rounded-xl bg-black/60 border border-slate-800 text-slate-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-56">
            {JSON.stringify(policy.default_pass_request, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
