"use client";

import React, { useMemo } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { DecisionChip } from "@/components/common/DecisionChip";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Clock,
  Key,
  Lock,
  Layers,
  Activity,
  AlertTriangle,
  FileCheck,
  Unlock,
  Radio,
  ExternalLink,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

interface OverviewScreenProps {
  onNavigateToTab?: (tab: string) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  onNavigateToTab,
}) => {
  const {
    state,
    liveEvents,
    revokePass,
    unfreezeChain,
    clearTaint,
    requestConfirm,
    bootstrapDemo,
  } = useAgentPass();

  const metrics = state?.metrics;
  const currentPass = state?.pass;
  const currentChain = state?.chain;
  const behavior = state?.behavior;
  const budgets = state?.budgets;
  const audit = state?.audit;

  // Decision distribution data for Donut Chart
  const decisionData = useMemo(() => {
    if (!metrics || metrics.total_requests === 0) return [];
    const total = metrics.total_requests;
    return [
      {
        name: "Allow",
        value: metrics.allowed,
        color: "#10B981",
        percent: Math.round((metrics.allowed / total) * 100),
      },
      {
        name: "Step-Up",
        value: metrics.step_up,
        color: "#F59E0B",
        percent: Math.round((metrics.step_up / total) * 100),
      },
      {
        name: "Deny",
        value: metrics.denied,
        color: "#EF4444",
        percent: Math.round((metrics.denied / total) * 100),
      },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Aggregate audit events by time window for Risk Trend Area Chart
  const riskTrendData = useMemo(() => {
    if (liveEvents.length === 0) return [];

    // Group events into 10 chronological buckets
    const sorted = [...liveEvents].sort((a, b) => a.ts - b.ts);
    const minTs = sorted[0].ts;
    const maxTs = sorted[sorted.length - 1].ts;
    const range = Math.max(maxTs - minTs, 1);
    const bucketsCount = Math.min(10, Math.max(3, sorted.length));
    const bucketDuration = range / bucketsCount;

    const buckets = Array.from({ length: bucketsCount }, (_, i) => {
      const bucketTime = new Date((minTs + i * bucketDuration) * 1000);
      const timeStr = bucketTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        time: timeStr,
        Low: 0,
        Medium: 0,
        High: 0,
      };
    });

    for (const ev of sorted) {
      const idx = Math.min(
        bucketsCount - 1,
        Math.floor((ev.ts - minTs) / bucketDuration)
      );
      if (ev.severity === "high" || ev.severity === "critical") {
        buckets[idx].High += 1;
      } else if (ev.severity === "warn") {
        buckets[idx].Medium += 1;
      } else {
        buckets[idx].Low += 1;
      }
    }

    return buckets;
  }, [liveEvents]);

  // Agent Activity Chart Data
  const activityData = useMemo(() => {
    if (liveEvents.length === 0) return [];
    return liveEvents.slice(0, 15).reverse().map((ev, i) => ({
      index: `#${ev.id || i + 1}`,
      latency: ev.detail?.latency_ms || 1,
      score: ev.detail?.behavior_score || 0,
      action: ev.action || ev.event_type,
    }));
  }, [liveEvents]);

  const handleKillSwitch = (passId: string) => {
    requestConfirm({
      title: "Trigger Kill Switch",
      message: `Are you sure you want to revoke pass ${passId}? The sidecar's current ticket and subsequent actions will be immediately invalidated.`,
      confirmLabel: "Revoke Pass Now",
      isDestructive: true,
      onConfirm: async () => {
        await revokePass(passId);
      },
    });
  };

  const handleUnfreeze = (chainId: string) => {
    requestConfirm({
      title: "Unfreeze Chain",
      message: `Chain ${chainId} was frozen due to a key-holder anomaly. Re-approving will allow the agent to resync and continue safely.`,
      confirmLabel: "Unfreeze & Re-Approve",
      onConfirm: async () => {
        await unfreezeChain(chainId);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Taint & Frozen Chain Notices */}
      {currentChain?.state === "frozen" && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center justify-between glow-red">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">CHAIN FROZEN (Key-Holder Anomaly)</p>
              <p className="text-xs text-rose-300/90 mt-0.5">
                A spent ticket was reused or an anomaly occurred. All actions are blocked until human re-approval.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUnfreeze(currentChain.id)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition-colors cursor-pointer"
          >
            Re-Approve & Unfreeze
          </button>
        </div>
      )}

      {currentChain?.tainted && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center justify-between glow-amber">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-bold">SESSION TAINTED (Untrusted External Content)</p>
              <p className="text-xs text-amber-300/90 mt-0.5">
                {currentChain.taint_reason || "Agent ingested untrusted external email. High-risk policy applied."}
              </p>
            </div>
          </div>
          <button
            onClick={() => clearTaint(currentChain.id)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg transition-colors cursor-pointer"
          >
            Mark Reviewed & Clear Taint
          </button>
        </div>
      )}

      {/* Metric Cards Grid (Matching Image 3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Active Agents */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Active Agents</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              {state?.sidecar?.has_ticket ? 1 : state?.pass ? 1 : 0}
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              {state?.sidecar?.reachable ? "Sidecar Ready" : "Standby"}
            </span>
          </div>
        </div>

        {/* Active Passes */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Active Passes</span>
            <Key className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              {currentPass && currentPass.status === "active" ? 1 : 0}
            </span>
            <span className="text-[10px] font-mono text-blue-400">
              {currentPass ? `${currentPass.seconds_left}s left` : "None"}
            </span>
          </div>
        </div>

        {/* Allowed Actions */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Allowed Actions</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">
              {metrics?.allowed ?? 0}
            </span>
            <span className="text-[10px] font-mono text-emerald-400/80">
              {metrics && metrics.total_requests > 0
                ? `${Math.round((metrics.allowed / metrics.total_requests) * 100)}%`
                : "0%"}
            </span>
          </div>
        </div>

        {/* Blocked Actions */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Blocked Actions</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-400">
              {metrics?.denied ?? 0}
            </span>
            <span className="text-[10px] font-mono text-rose-400/80">
              {metrics?.denied ? "Policy Refusal" : "Clean"}
            </span>
          </div>
        </div>

        {/* Step-Up Requests */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Step-Up Requests</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">
              {metrics?.step_up ?? 0}
            </span>
            <span className="text-[10px] font-mono text-amber-400/80">
              {state?.pending_approvals?.length ? `${state.pending_approvals.length} pending` : "0 pending"}
            </span>
          </div>
        </div>

        {/* Attacks Contained */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Attacks Contained</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-orange-400">
              {metrics?.alerts ?? 0}
            </span>
            <span className="text-[10px] font-mono text-orange-400/80">
              Severity: High+
            </span>
          </div>
        </div>
      </div>

      {/* Latency & Audit Chain Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="glass-card px-4 py-3 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Avg Execution Latency</span>
          <span className="text-sm font-mono font-bold text-cyan-400">
            {metrics?.avg_latency_ms != null ? `${metrics.avg_latency_ms} ms` : "-"}
          </span>
        </div>
        <div className="glass-card px-4 py-3 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">P95 Execution Latency</span>
          <span className="text-sm font-mono font-bold text-cyan-400">
            {metrics?.p95_latency_ms != null ? `${metrics.p95_latency_ms} ms` : "-"}
          </span>
        </div>
        <div className="glass-card px-4 py-3 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Cryptographic Audit Chain</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                audit?.valid ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span
              className={`text-xs font-mono font-bold ${
                audit?.valid ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {audit?.valid ? `Valid (${audit.length} records)` : `BROKEN at #${audit?.first_broken_id}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Feed (left) & Visual Charts (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Security Events (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="glass-card p-5 rounded-2xl flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Live Security Events
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  SSE Real-Time
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {liveEvents.length} events logged
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 divide-y divide-slate-800/50">
              {liveEvents.length === 0 ? (
                <EmptyState
                  message="No requests yet. Run a scenario."
                  subtext="Run a scenario from the Agent Runner or trigger Quick Start to see live telemetry."
                  action={{
                    label: "Quick Start Bootstrap",
                    onClick: bootstrapDemo,
                  }}
                />
              ) : (
                <div className="space-y-1">
                  {liveEvents.map((rec) => {
                    const timeStr = new Date(rec.ts * 1000).toLocaleTimeString();
                    return (
                      <div
                        key={rec.id}
                        className="py-2.5 px-3 rounded-xl hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[11px] text-slate-400 shrink-0">
                            {timeStr}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 truncate">
                                {rec.action || rec.event_type}
                              </span>
                              {rec.tool && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  [{rec.tool}]
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate">
                              {rec.detail?.why || rec.detail?.result_summary || rec.reason}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {rec.detail?.latency_ms != null && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {rec.detail.latency_ms}ms
                            </span>
                          )}
                          <SeverityBadge severity={rec.severity} />
                          <DecisionChip decision={rec.decision} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pass Card & Blast Radius */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Active Delegation Pass
                </h3>
              </div>
              {currentPass ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {currentPass.status}
                  </span>
                  <button
                    onClick={() => handleKillSwitch(currentPass.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 transition-colors cursor-pointer"
                  >
                    Kill Switch
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">No active pass</span>
              )}
            </div>

            {currentPass ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">PASS ID</span>
                    <span className="text-white font-bold truncate block">{currentPass.id}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">AGENT ID</span>
                    <span className="text-cyan-400 font-bold truncate block">{currentPass.agent_id}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">TIME REMAINING</span>
                    <span className="text-amber-400 font-bold block">{currentPass.seconds_left}s</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">KEY THUMBPRINT</span>
                    <span className="text-slate-300 font-bold truncate block">
                      {currentPass.key_thumbprint?.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                {/* Scopes */}
                <div>
                  <span className="text-slate-400 text-xs font-medium block mb-1.5">
                    Granted Scopes
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentPass.scopes.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-slate-800 text-cyan-300 border border-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Blast Radius */}
                {currentPass.blast_radius && (
                  <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Worst-Case Blast Radius</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Max money: INR {currentPass.blast_radius.max_money} | Max emails/hr:{" "}
                        {currentPass.blast_radius.max_emails_per_hour}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-emerald-400 font-semibold block mb-0.5">Can:</span>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                          {currentPass.blast_radius.can.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="text-rose-400 font-semibold block mb-0.5">Cannot:</span>
                        <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                          {currentPass.blast_radius.cannot.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  message="No active delegation pass."
                  subtext="Run Quick Start to issue and claim a ticket-bound pass."
                  action={{
                    label: "Bootstrap Now",
                    onClick: bootstrapDemo,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Charts & Behavior (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Risk Trend Chart (Area Chart) */}
          <div className="glass-card p-5 rounded-2xl h-[250px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white tracking-tight">Risk Trend</h3>
              <div className="flex items-center gap-3 text-[10px] font-medium">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Low
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> High
                </span>
              </div>
            </div>

            <div className="flex-1 w-full min-h-[170px]">
              {riskTrendData.length === 0 ? (
                <EmptyState message="No telemetry recorded yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Area type="monotone" dataKey="Low" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="Medium" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="High" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Decision Distribution Donut Chart */}
          <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-white tracking-tight">
                Decision Distribution
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Total: {metrics?.total_requests || 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="w-36 h-36 relative">
                {metrics && metrics.total_requests > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={decisionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        stroke="#0D1526"
                        strokeWidth={2}
                      >
                        {decisionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center rounded-full border border-slate-800 text-slate-500 text-xs">
                    0
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-white">
                    {metrics?.total_requests || 0}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">
                    Total
                  </span>
                </div>
              </div>

              {/* Legend matching Image 3 */}
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-300 font-medium">Allow</span>
                  </div>
                  <span className="font-mono text-slate-200">
                    {metrics?.allowed || 0} (
                    {metrics && metrics.total_requests
                      ? Math.round((metrics.allowed / metrics.total_requests) * 100)
                      : 0}
                    %)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-300 font-medium">Step-Up</span>
                  </div>
                  <span className="font-mono text-slate-200">
                    {metrics?.step_up || 0} (
                    {metrics && metrics.total_requests
                      ? Math.round((metrics.step_up / metrics.total_requests) * 100)
                      : 0}
                    %)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-300 font-medium">Deny</span>
                  </div>
                  <span className="font-mono text-slate-200">
                    {metrics?.denied || 0} (
                    {metrics && metrics.total_requests
                      ? Math.round((metrics.denied / metrics.total_requests) * 100)
                      : 0}
                    %)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Behavior Score Meter & Breakdown */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white tracking-tight">Behavior Engine</h3>
              <span className="text-xs font-mono font-bold text-cyan-400">
                Score: {behavior ? behavior.score : 0} / 100
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {/* Progress Bar with Step-Up (70) and Deny (90) Markers */}
              <div className="space-y-1">
                <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (behavior?.score ?? 0) >= 90
                        ? "bg-rose-500 glow-red"
                        : (behavior?.score ?? 0) >= 70
                        ? "bg-amber-500 glow-amber"
                        : "bg-emerald-500 glow-green"
                    }`}
                    style={{ width: `${Math.min(100, behavior?.score ?? 0)}%` }}
                  />
                  {/* Step-up marker at 70% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 opacity-70"
                    style={{ left: "70%" }}
                  />
                  {/* Deny marker at 90% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 opacity-70"
                    style={{ left: "90%" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>0 (Safe)</span>
                  <span className="text-amber-400">Step-Up (70)</span>
                  <span className="text-rose-400">Deny (90)</span>
                </div>
              </div>

              {/* Behavior Breakdown */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Active Signals Breakdown:
                </span>
                {behavior?.breakdown && behavior.breakdown.length > 0 ? (
                  behavior.breakdown.map((b, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]">
                        {b.signal}: {b.why}
                      </span>
                      <span className="text-amber-400 font-mono font-bold shrink-0">
                        +{b.points} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-500 italic block">
                    No anomalous behavior detected. Zero penalty points.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Budgets Progress */}
          {budgets && Object.keys(budgets).length > 0 && (
            <div className="glass-card p-5 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-white tracking-tight">Active Budgets</h3>
              <div className="space-y-3 text-xs">
                {Object.entries(budgets).map(([key, b]) => {
                  const percent = Math.min(100, Math.round((b.used / b.limit) * 100));
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-mono text-slate-300">{key}</span>
                        <span className="font-mono text-slate-400">
                          {b.used} / {b.limit} {b.unit} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            percent >= 100 ? "bg-rose-500" : percent >= 80 ? "bg-amber-500" : "bg-cyan-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
