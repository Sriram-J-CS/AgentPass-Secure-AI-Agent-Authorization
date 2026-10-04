"use client";

import React, { useState } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { DecisionChip } from "@/components/common/DecisionChip";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Repeat,
  Flame,
  CheckCircle,
  Copy,
  Check,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const TicketRelayScreen: React.FC = () => {
  const { state, bootstrapDemo } = useAgentPass();
  const tickets = state?.tickets || [];
  const currentChain = state?.chain;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Sort tickets by sequence ascending for visual chain timeline
  const sortedTickets = [...tickets].sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              One-Time Ticket Relay (Burn-After-Use)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Every signed request requires an active one-time ticket minted exclusively by the Gateway.
            Upon evaluation, the ticket is <strong className="text-rose-400">atomically burned</strong>, and the next sequence ticket is delivered inside the response.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">CHAIN STATUS</span>
            <span className="text-white font-bold uppercase">
              {currentChain?.state || "No Chain"}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">NEXT EXPECTED SEQ</span>
            <span className="text-cyan-400 font-bold">
              #{currentChain?.next_seq ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chain Visualizer */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Cryptographic Relay Sequence</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Burned
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" /> Active
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-400" /> Superseded
            </span>
          </div>
        </div>

        {sortedTickets.length === 0 ? (
          <EmptyState
            message="No tickets in current chain."
            subtext="Run Quick Start to issue Ticket #1 and begin the relay sequence."
            action={{
              label: "Bootstrap Chain",
              onClick: bootstrapDemo,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
            {sortedTickets.map((t) => {
              const isActive = t.status === "active";
              const isBurned = t.status === "burned";
              const isSuperseded = t.status === "superseded";

              let cardStyle = "bg-slate-900/60 border-slate-800 text-slate-400";
              if (isActive) {
                cardStyle = "bg-cyan-950/20 border-cyan-500/50 text-cyan-300 glow-cyan-sm ring-1 ring-cyan-500/30";
              } else if (isBurned) {
                cardStyle = "bg-slate-900/40 border-slate-800/80 text-slate-400 opacity-80";
              } else if (isSuperseded) {
                cardStyle = "bg-slate-900/20 border-dashed border-slate-700 text-slate-500";
              }

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] ${cardStyle}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800/80 text-white">
                          Seq #{t.seq}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            Active
                          </span>
                        )}
                        {isBurned && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-rose-400/80 uppercase">
                            <Flame className="w-3 h-3" />
                            Burned
                          </span>
                        )}
                        {isSuperseded && (
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            Superseded
                          </span>
                        )}
                      </div>

                      {t.outcome && <DecisionChip decision={t.outcome} size="sm" />}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                      <span className="text-slate-400 truncate max-w-[170px]" title={t.id}>
                        {t.id.slice(0, 16)}...
                      </span>
                      <button
                        onClick={() => handleCopy(t.id)}
                        className="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
                        title="Copy ticket ID"
                      >
                        {copiedId === t.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {t.summary && (
                      <p className="text-xs text-slate-300 line-clamp-2 pt-1 font-sans">
                        {t.summary}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500 flex justify-between">
                    <span>Issued: {new Date(t.issued).toLocaleTimeString()}</span>
                    {t.burned && (
                      <span className="text-rose-400/80">
                        Burned: {new Date(t.burned).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
