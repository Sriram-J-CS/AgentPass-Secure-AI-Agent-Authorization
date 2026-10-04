"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { WorldSnapshot } from "@/types/api";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Globe,
  Mail,
  Send,
  CreditCard,
  Folder,
  AlertTriangle,
  Radio,
  FileText,
  RotateCw,
  Flame,
} from "lucide-react";

export const WorldScreen: React.FC = () => {
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "payments" | "files">("inbox");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorld = async () => {
    try {
      setLoading(true);
      const data = await api.getWorld();
      setWorld(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load world data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorld();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              World State & Connected Services
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Live database of upstream services (Email, Bank, Filesystem). Modified solely when an AI agent successfully passes policy and burns a valid ticket.
          </p>
        </div>

        <button
          onClick={loadWorld}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-1">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "inbox"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Inbox ({world?.inbox?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("sent")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "sent"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent Emails ({world?.sent?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "payments"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payments Ledger ({world?.payments?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("files")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "files"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Files Directory ({world?.files?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Inbox */}
      {activeTab === "inbox" && (
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Email Inbox (Taint Inspection)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              External emails automatically set session taint
            </span>
          </div>

          {!world?.inbox || world.inbox.length === 0 ? (
            <EmptyState message="Inbox is empty." />
          ) : (
            <div className="space-y-3">
              {world.inbox.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    msg.external
                      ? "bg-amber-950/20 border-amber-500/40 glow-amber"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-slate-500 text-[11px]">
                        #{msg.id}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {msg.subject}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">
                        From: {msg.sender}
                      </span>
                      {msg.external === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Radio className="w-3 h-3 animate-pulse" />
                          EXTERNAL - UNTRUSTED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          Internal
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-300 leading-relaxed font-sans pt-1">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sent Emails */}
      {activeTab === "sent" && (
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Dispatched Emails Ledger
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Rate limited by email budget
            </span>
          </div>

          {!world?.sent || world.sent.length === 0 ? (
            <EmptyState message="No outgoing emails sent yet." />
          ) : (
            <div className="space-y-2.5">
              {world.sent.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{s.subject}</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(s.ts * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-cyan-400">
                    To: {s.to_addr}
                  </div>
                  <p className="text-slate-300 font-sans pt-1">{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payments */}
      {activeTab === "payments" && (
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Executed Financial Payments
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Requires human step-up authorization
            </span>
          </div>

          {!world?.payments || world.payments.length === 0 ? (
            <EmptyState message="No payments executed yet." />
          ) : (
            <div className="divide-y divide-slate-800">
              {world.payments.map((p) => (
                <div
                  key={p.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                      ₹
                    </div>
                    <div>
                      <span className="font-bold text-white">
                        {p.currency} {p.amount}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Payee: <strong className="font-mono text-slate-200">{p.payee}</strong> | Memo: {p.memo}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px]">
                    <span className="text-slate-300 block">Ref: {p.ref}</span>
                    <span className="text-slate-500">
                      {new Date(p.ts * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Files */}
      {activeTab === "files" && (
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Filesystem Storage
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Canary tokens trigger instant pass revocation
            </span>
          </div>

          {!world?.files || world.files.length === 0 ? (
            <EmptyState message="No files found in directory." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {world.files.map((f) => (
                <div
                  key={f.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                    f.canary
                      ? "bg-rose-950/20 border-rose-500/40 glow-red"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText
                      className={`w-4 h-4 ${
                        f.canary ? "text-rose-400" : "text-cyan-400"
                      }`}
                    />
                    <span className="font-mono font-medium text-slate-200">
                      {f.name}
                    </span>
                  </div>

                  {f.canary === 1 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-400" />
                      CANARY TRIPWIRE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">
                      Standard
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
