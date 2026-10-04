"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  ArrowRight,
  Lock,
  Key,
  Flame,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Mail,
  Folder,
  CreditCard,
  User,
  Bot,
  ExternalLink,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Navigation Bar (Matching Image 1) */}
      <nav className="h-20 px-8 flex items-center justify-between border-b border-slate-800/80 bg-[#080C14]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-black">
            <Shield className="w-5 h-5 text-slate-950 fill-current" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            AgentPass
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
          <a href="#product" className="hover:text-cyan-400 transition-colors">
            Product
          </a>
          <a href="#security" className="hover:text-cyan-400 transition-colors">
            Security
          </a>
          <a href="#demo" className="hover:text-cyan-400 transition-colors">
            Demo
          </a>
          <a href="#pricing" className="hover:text-cyan-400 transition-colors">
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section (Matching Image 1) */}
      <section className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headline & Value Proposition */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            CYBERSECURITY FOR AI AGENTS
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Agents can request an action.{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              AgentPass decides.
            </span>
          </h1>

          <p className="text-base text-slate-400 max-w-lg leading-relaxed">
            An AI agent can be compromised. Its authority shouldn&apos;t be.
            Key-bound, burn-after-use zero-trust authorization protecting upstream APIs from prompt injection and manipulated LLMs.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all"
            >
              <span>Open Security Console</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </Link>

            <Link
              href="/?tab=attacks"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold tracking-wider transition-all"
            >
              <span>View Attack Demo</span>
            </Link>
          </div>

          {/* 3 Value Pillars (Matching Image 1) */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800/80">
            <div>
              <span className="text-2xl font-black text-white block">Zero</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                API keys in agent
              </span>
            </div>
            <div>
              <span className="text-2xl font-black text-white block">100%</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Key-bound requests
              </span>
            </div>
            <div>
              <span className="text-2xl font-black text-white block">Real-time</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Risk enforcement
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Glowing Interactive 3D Flowchart (Matching Image 1) */}
        <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
          {/* Subtle Background Glow */}
          <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative w-full max-w-md p-6 glass-card rounded-3xl border-cyan-500/30 glow-cyan space-y-6">
            {/* Top Node: Human */}
            <div className="flex flex-col items-center">
              <div className="px-5 py-2.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 flex items-center gap-2 text-xs font-bold glow-cyan-sm">
                <User className="w-4 h-4 text-cyan-400" />
                <span>Human Operator</span>
              </div>
              <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-blue-500" />
            </div>

            {/* Next Node: Agent Identity */}
            <div className="flex flex-col items-center">
              <div className="px-6 py-2.5 rounded-2xl bg-blue-950/40 border border-blue-500/50 text-blue-300 flex items-center gap-2 text-xs font-bold glow-blue">
                <Bot className="w-4 h-4 text-blue-400" />
                <span>Agent Identity</span>
              </div>
              <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-400" />
            </div>

            {/* Core Center Node: AgentPass Gateway */}
            <div className="p-4 rounded-2xl bg-[#091122] border-2 border-cyan-400 text-center shadow-xl glow-cyan space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
                Policy Enforcement Point
              </span>
              <h3 className="text-sm font-black text-white tracking-wide">
                AgentPass Gateway
              </h3>
            </div>

            {/* 3 Outcome Branches: Allow, Step-Up, Deny (Matching Image 1) */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {/* Allow */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/60 text-center glow-green space-y-1">
                <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                <span className="text-xs font-bold text-emerald-400 block">
                  Allow
                </span>
                <span className="text-[9px] text-emerald-300/80 font-mono block">
                  Vault Key
                </span>
              </div>

              {/* Step-Up */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/60 text-center glow-amber space-y-1">
                <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                <span className="text-xs font-bold text-amber-400 block">
                  Step-Up
                </span>
                <span className="text-[9px] text-amber-300/80 font-mono block">
                  Human Sign
                </span>
              </div>

              {/* Deny */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/60 text-center glow-red space-y-1">
                <XCircle className="w-4 h-4 text-rose-500 mx-auto" />
                <span className="text-xs font-bold text-rose-400 block">
                  Deny
                </span>
                <span className="text-[9px] text-rose-300/80 font-mono block">
                  Ticket Burn
                </span>
              </div>
            </div>

            {/* Bottom: Protected Tools */}
            <div className="pt-3 border-t border-slate-800 text-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                Protected Tools
              </span>
              <div className="flex items-center justify-center gap-4 text-slate-400">
                <div className="flex items-center gap-1 text-xs">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Email</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Folder className="w-4 h-4 text-blue-400" />
                  <span>Files</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Payments</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-800/80 px-8 flex items-center justify-between text-xs text-slate-500">
        <span>© 2026 AgentPass Security. Zero-Trust Authorization for AI.</span>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            Console
          </Link>
          <Link href="/login" className="hover:text-cyan-400 transition-colors">
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
};
