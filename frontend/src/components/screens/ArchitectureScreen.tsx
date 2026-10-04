"use client";

import React, { useState } from "react";
import {
  Cpu,
  Shield,
  Lock,
  Key,
  Flame,
  ArrowRight,
  Database,
  Bot,
  User,
  Radio,
  FileCheck,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

export const ArchitectureScreen: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const steps = [
    {
      num: 1,
      title: "Agent Requests Action",
      desc: "Untrusted AI agent sends unauthenticated action request to the isolated local Signer Sidecar.",
      component: "AI Agent (Untrusted)",
      lock: "Isolation",
    },
    {
      num: 2,
      title: "Sidecar Signs Key-Bound Proof",
      desc: "Sidecar attaches the current one-time ticket and signs an ES256 proof covering HTTP method, URL, body hash, and nonce.",
      component: "Signer Sidecar (:8001)",
      lock: "Lock 2: BIND",
    },
    {
      num: 3,
      title: "Gateway Verifies & Burns Ticket",
      desc: "Gateway verifies ticket signature, key match, freshness, idempotency, and ATOMICALLY BURNS the ticket so it can never be reused.",
      component: "AgentPass Gateway (:8000)",
      lock: "Lock 3: BURN",
    },
    {
      num: 4,
      title: "Policy Engine Decides",
      desc: "Deterministic rules evaluate Scope -> Canary -> Intent -> Budget -> Behavior Anomaly -> Risk/Taint (ALLOW / STEP_UP / DENY).",
      component: "Policy & Risk Engine",
      lock: "Zero-Trust Gate",
    },
    {
      num: 5,
      title: "Vault Injects Real API Key",
      desc: "For ALLOW, the gateway decrypts the secret via AES-256-GCM for the instant of the upstream tool call, scrubbing response leaks.",
      component: "Encrypted Key Vault",
      lock: "Lock 1: VAULT",
    },
    {
      num: 6,
      title: "Next Ticket & Hash Chain Log",
      desc: "Gateway mints next sequence ticket, logs SHA-256 hash-chained record, and streams live telemetry to the dashboard.",
      component: "Audit & Telemetry Stream",
      lock: "Chain Continuity",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              System Architecture & The Three Locks
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            End-to-end security architecture for AI agent authorization. Eliminates long-lived bearer tokens and protects upstream resources against prompt injection.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold">
          Vault • Bind • Burn
        </span>
      </div>

      {/* The Three Locks Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lock 1: Vault */}
        <div className="glass-card p-5 rounded-2xl border-cyan-500/30 space-y-3 glow-cyan-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
                Lock 1
              </span>
              <h3 className="text-sm font-bold text-white">Vault Protection</h3>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The AI agent <strong>never holds API keys</strong>. Real secrets live encrypted in AES-256-GCM storage and are injected inside the gateway only for the instant of dispatch. Responses are scrubbed.
          </p>
        </div>

        {/* Lock 2: Bind */}
        <div className="glass-card p-5 rounded-2xl border-blue-500/30 space-y-3 glow-blue">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest block">
                Lock 2
              </span>
              <h3 className="text-sm font-bold text-white">Cryptographic Binding</h3>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every request is signed with an <strong>ES256 private key</strong> stored in an isolated sidecar process. Requests bind ticket, URI, HTTP method, timestamp, and body SHA-256 hash. Replays are rejected.
          </p>
        </div>

        {/* Lock 3: Burn */}
        <div className="glass-card p-5 rounded-2xl border-rose-500/30 space-y-3 glow-red">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest block">
                Lock 3
              </span>
              <h3 className="text-sm font-bold text-white">Burn-After-Use Relay</h3>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Each ticket works <strong>exactly once</strong>. Even denied or blocked attempts burn their ticket immediately. The next sequence ticket is delivered with the response. Re-using burns freezes the chain.
          </p>
        </div>
      </div>

      {/* Visual System Architecture Diagram (Matching Image 10) */}
      <div className="glass-card p-6 rounded-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            End-to-End Execution Pipeline (Matching Visual Architecture)
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Interactive Flowchart
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {steps.map((st) => {
            const isHovered = activeStep === st.num;
            return (
              <div
                key={st.num}
                onMouseEnter={() => setActiveStep(st.num)}
                onMouseLeave={() => setActiveStep(null)}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                  isHovered
                    ? "bg-cyan-950/30 border-cyan-500/60 glow-cyan-sm scale-[1.02]"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-slate-800 font-mono text-xs font-bold text-cyan-400 flex items-center justify-center">
                      {st.num}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {st.lock}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white tracking-tight">
                    {st.title}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800 text-[10px] font-mono text-cyan-400 truncate">
                  {st.component}
                </div>
              </div>
            );
          })}
        </div>

        {/* Honest Limits Notice (as documented in README) */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            Security Model Guarantees & Operational Boundaries
          </span>
          <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
            <li>
              <strong>Process Isolation:</strong> Private keys reside exclusively in the signer sidecar memory space, never accessible to the AI model or gateway logs.
            </li>
            <li>
              <strong>Cryptographic Hash Chain:</strong> Audit logs are chained via SHA-256 backward pointers. Any database modification is detectable at <code className="text-cyan-400">/api/audit/verify</code>.
            </li>
            <li>
              <strong>Fail-Closed Design:</strong> If a ticket is expired, signature is stale, or payload hash mismatches, the request is unconditionally rejected.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
