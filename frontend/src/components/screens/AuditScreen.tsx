"use client";

import React, { useState, useEffect } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import { api } from "@/lib/api";
import { AuditRecord, AuditVerifyResult } from "@/types/api";
import { DecisionChip } from "@/components/common/DecisionChip";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { EmptyState } from "@/components/common/EmptyState";
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Flame,
} from "lucide-react";

export const AuditScreen: React.FC = () => {
  const { requestConfirm, refreshState } = useAgentPass();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadAudit = async (alerts = alertsOnly) => {
    try {
      setLoading(true);
      const res = await api.getAudit(100, undefined, alerts);
      setRecords(res.records || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit(alertsOnly);
  }, [alertsOnly]);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      const res = await api.verifyAudit();
      setVerifyResult(res);
      await refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleTamper = () => {
    requestConfirm({
      title: "Simulate Hash Chain Tampering",
      message:
        "This will tamper an audit log record directly in the backend SQLite database to demonstrate that the cryptographic hash chain immediately detects alteration.",
      confirmLabel: "Tamper Audit Record",
      isDestructive: true,
      onConfirm: async () => {
        try {
          setTampering(true);
          const res = await api.tamperAudit();
          setVerifyResult(res.verification);
          await loadAudit();
          await refreshState();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Tamper simulation failed");
        } finally {
          setTampering(false);
        }
      },
    });
  };

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.event_type.toLowerCase().includes(term) ||
      (r.action && r.action.toLowerCase().includes(term)) ||
      (r.tool && r.tool.toLowerCase().includes(term)) ||
      r.reason.toLowerCase().includes(term) ||
      (r.trace_id && r.trace_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with Verification & Tamper Buttons */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Hash-Chained Audit Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Immutable, SHA-256 chained audit records. Every request, signature verification, policy decision, and burn event is tamper-evident.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{verifying ? "Verifying..." : "Verify Chain"}</span>
          </button>
          <button
            onClick={handleTamper}
            disabled={tampering}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Flame className="w-4 h-4" />
            <span>Tamper Demo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verification Result Banner */}
      {verifyResult && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
            verifyResult.valid
              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300 glow-green"
              : "bg-rose-950/20 border-rose-500/50 text-rose-300 glow-red"
          }`}
        >
          <div className="flex items-center gap-3">
            {verifyResult.valid ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            )}
            <div>
              <p className="font-bold text-sm">
                {verifyResult.valid
                  ? "Audit Hash Chain Verified (100% Intact)"
                  : "TAMPERING DETECTED: Chain Broken!"}
              </p>
              <p className="text-slate-300 mt-0.5">
                {verifyResult.valid
                  ? `Checked ${verifyResult.checked} consecutive records. All SHA-256 hashes and prev_hash pointers match.`
                  : `Verification failed at record ID #${verifyResult.first_broken_id}. The hash stored in the block does not match the computed hash of the contents.`}
              </p>
            </div>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-lg bg-black/40 border border-slate-700">
            {verifyResult.length} Records
          </span>
        </div>
      )}

      {/* Filters & Table */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search audit records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Alerts Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={alertsOnly}
                onChange={(e) => setAlertsOnly(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span>Alerts Only</span>
            </label>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Showing {filteredRecords.length} records
          </div>
        </div>

        {/* Audit Records Table */}
        {filteredRecords.length === 0 ? (
          <EmptyState
            message="No audit records match the filter."
            subtext="Run scenarios or attacks to populate the audit log."
          />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredRecords.map((rec) => {
              const isExpanded = expandedId === rec.id;
              const isBroken =
                verifyResult &&
                !verifyResult.valid &&
                verifyResult.first_broken_id === rec.id;

              return (
                <div
                  key={rec.id}
                  className={`py-3 transition-colors ${
                    isBroken
                      ? "bg-rose-950/30 border-l-4 border-rose-500 pl-3 rounded-r-xl"
                      : "hover:bg-slate-800/30"
                  }`}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button className="text-slate-500 hover:text-slate-300">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <span className="font-mono text-slate-500 text-[11px] w-12">
                        #{rec.id}
                      </span>

                      <span className="font-mono text-slate-400 text-[11px] shrink-0">
                        {new Date(rec.ts * 1000).toLocaleTimeString()}
                      </span>

                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-slate-200">
                          {rec.event_type}
                        </span>
                        {rec.action && (
                          <span className="font-mono text-[11px] text-cyan-400">
                            ({rec.action})
                          </span>
                        )}
                        {rec.tool && (
                          <span className="font-mono text-[10px] text-slate-400">
                            [{rec.tool}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-slate-400">
                        {rec.reason}
                      </span>
                      <SeverityBadge severity={rec.severity} />
                      <DecisionChip decision={rec.decision} size="sm" />
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 p-4 rounded-xl bg-[#070A12] border border-slate-800 text-xs font-mono space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">RECORD HASH:</span>
                          <div className="flex items-center justify-between text-cyan-300 break-all">
                            <span>{rec.record_hash}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(rec.record_hash);
                              }}
                              className="p-1 text-slate-400 hover:text-white shrink-0 ml-2"
                            >
                              {copiedHash === rec.record_hash ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 block">PREV HASH:</span>
                          <span className="text-slate-400 break-all">
                            {rec.prev_hash || "GENESIS_ROOT"}
                          </span>
                        </div>
                      </div>

                      {/* Detail JSON */}
                      <div>
                        <span className="text-slate-500 block mb-1 text-[11px]">
                          DETAIL PAYLOAD:
                        </span>
                        <pre className="p-3 rounded-lg bg-black/60 border border-slate-800/80 text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                          {JSON.stringify(rec.detail, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
