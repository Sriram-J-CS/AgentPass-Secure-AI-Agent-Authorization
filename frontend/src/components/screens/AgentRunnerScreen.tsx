"use client";

import React, { useState, useEffect } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { api } from "@/lib/api";
import { ScenarioInfo, ScenarioRunResult } from "@/types/api";
import { DecisionChip } from "@/components/common/DecisionChip";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Bot,
  Play,
  RotateCw,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

interface AgentRunnerScreenProps {
  onNavigateToTrace?: (traceId: string) => void;
}

export const AgentRunnerScreen: React.FC<AgentRunnerScreenProps> = ({
  onNavigateToTrace,
}) => {
  const { state, refreshState, bootstrapDemo } = useAgentPass();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"runner" | "agents">("runner");

  const loadScenarios = async () => {
    try {
      setLoadingScenarios(true);
      const res = await api.getScenarios();
      setScenarios(res.scenarios || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenarios");
    } finally {
      setLoadingScenarios(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleRunScenario = async (id: string) => {
    if (!state?.sidecar?.has_ticket) {
      // Prompt bootstrap if no active pass/ticket
      setError("No active pass or ticket in sidecar. Please click Quick Start to bootstrap first.");
      return;
    }

    try {
      setRunningId(id);
      setError(null);
      const result = await api.runScenario(id);
      setLastResult(result);
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scenario execution failed");
    } finally {
      setRunningId(null);
    }
  };

  const filteredScenarios = scenarios.filter(
    (s) =>
      s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Sub-Tabs */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Agent Runner & Directory
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Execute real scenarios against the isolated AI agent sidecar. Requests flow through the AgentPass Gateway with live cryptographic verification.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab("runner")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "runner"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Scenario Runner
          </button>
          <button
            onClick={() => setActiveSubTab("agents")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === "agents"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Active Agents Directory
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          {!state?.sidecar?.has_ticket && (
            <button
              onClick={bootstrapDemo}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Bootstrap Demo
            </button>
          )}
        </div>
      )}

      {/* Sub-Tab 1: Scenario Runner */}
      {activeSubTab === "runner" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Scenarios List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Test Scenarios ({scenarios.length})
              </h3>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter scenarios..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
              {filteredScenarios.map((sc) => {
                const isRunning = runningId === sc.id;
                const isSelected = lastResult?.scenario === sc.id;

                return (
                  <div
                    key={sc.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-cyan-950/20 border-cyan-500/40 glow-cyan-sm"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white tracking-tight">
                            {sc.title}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500">
                            {sc.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {sc.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRunScenario(sc.id)}
                        disabled={runningId !== null}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {isRunning ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Running</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Run</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-500">Expected:</span>
                      <span className="text-cyan-400">{sc.expected}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Execution Steps Result (7 cols) */}
          <div className="lg:col-span-7">
            <div className="glass-card p-5 rounded-2xl h-full min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Execution Steps & Trace</h3>
                </div>
                {lastResult && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      Trace: {lastResult.trace_id}
                    </span>
                    {onNavigateToTrace && (
                      <button
                        onClick={() => onNavigateToTrace(lastResult.trace_id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>View Causal Graph</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 mt-4">
                {!lastResult ? (
                  <EmptyState
                    message="No scenario executed yet."
                    subtext="Select a scenario on the left and click 'Run' to observe each real step evaluated by the gateway."
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Scenario Note */}
                    {lastResult.note && (
                      <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200">
                        <span className="font-bold block text-white mb-0.5">
                          Scenario Outcome:
                        </span>
                        {lastResult.note}
                      </div>
                    )}

                    {/* Steps Timeline */}
                    <div className="space-y-3">
                      {lastResult.steps.map((step, idx) => {
                        const resp = step.response;
                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-mono font-bold text-cyan-400 flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-white">
                                  {step.label}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  [{step.tool} - {step.action}]
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {resp?.latency_ms != null && (
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {resp.latency_ms} ms
                                  </span>
                                )}
                                <DecisionChip decision={resp?.decision} size="sm" />
                              </div>
                            </div>

                            {/* Reason / Alert */}
                            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                              <span className="text-slate-400">
                                Reason: <strong className="text-slate-200">{resp?.reason || "OK"}</strong>
                              </span>
                              {resp?.alert && (
                                <span className="text-rose-400 font-bold">
                                  Alert: {resp.alert}
                                </span>
                              )}
                              {resp?.approval_id && (
                                <span className="text-amber-400 font-bold">
                                  Step-Up Approval ID: {resp.approval_id}
                                </span>
                              )}
                            </div>

                            {/* Params & Result JSON */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                              <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                                <span className="text-slate-500 block mb-0.5">Parameters:</span>
                                <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                                  {JSON.stringify(step.params, null, 2)}
                                </pre>
                              </div>
                              <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                                <span className="text-slate-500 block mb-0.5">Response:</span>
                                <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                                  {JSON.stringify(resp?.result || resp?.decision || {}, null, 2)}
                                </pre>
                              </div>
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
        </div>
      )}

      {/* Sub-Tab 2: Active Agents Directory (Matching Image 4) */}
      {activeSubTab === "agents" && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Registered Agents</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Agents bounded by cryptographic proof-of-possession and process isolation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Connected Agent Runtime
              </span>
            </div>
          </div>

          {/* Real Agent from Sidecar */}
          {state?.sidecar?.reachable ? (
            <div className="divide-y divide-slate-800">
              <div className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        {state.sidecar.agent_id || state.pass?.agent_id || "invoice-assistant"}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {state.sidecar.has_ticket ? "Active" : "Standby"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {state.pass?.task?.purpose || "Gullible demo agent managing invoices and payments"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">RISK STATUS</span>
                    <span className="text-emerald-400 font-bold">
                      {state.behavior ? `Score: ${state.behavior.score}` : "Low"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">TOTAL ACTIONS</span>
                    <span className="text-white font-bold">{state.metrics?.total_requests || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CURRENT SEQ</span>
                    <span className="text-cyan-400 font-bold">#{state.sidecar.seq || 0}</span>
                  </div>
                  <button
                    onClick={() => setActiveSubTab("runner")}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 text-xs font-semibold cursor-pointer"
                  >
                    Open Runner
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              message="No agent sidecar connected."
              subtext="Ensure the sidecar process (:8001) is active."
            />
          )}

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Note:</span> The AgentPass Gateway supports dynamic multi-agent delegation. Current session is bound to the running isolated sidecar process holding private ES256 keys.
          </div>
        </div>
      )}
    </div>
  );
};
