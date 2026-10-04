"use client";

import React, { useState } from "react";
import { useAgentPass } from "@/context/AgentPassContext";
import {
  Bell,
  Search,
  RotateCcw,
  PlayCircle,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  currentTab?: string;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab = "Overview", onSearch }) => {
  const {
    connected,
    sidecarReachable,
    error,
    state,
    resetDemo,
    bootstrapDemo,
    requestConfirm,
    toasts,
  } = useAgentPass();

  const [bootstrapping, setBootstrapping] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      await bootstrapDemo();
    } finally {
      setBootstrapping(false);
    }
  };

  const handleResetClick = () => {
    requestConfirm({
      title: "Reset Demo Environment",
      message:
        "This will clear all runtime state, wipe passes, chains, audit records, and generate fresh master encryption keys for the vault. Are you sure?",
      confirmLabel: "Reset Everything",
      isDestructive: true,
      onConfirm: async () => {
        await resetDemo();
      },
    });
  };

  const alertsCount = state?.metrics?.alerts || 0;

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-slate-800/80 bg-[#080C14]/90 backdrop-blur-md">
      {/* Offline Banner if gateway or sidecar unreachable */}
      {(!connected || !sidecarReachable) && (
        <div className="flex items-center justify-between px-6 py-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {!connected
                ? `Gateway Disconnected (${error || "Connecting..."}). Verify backend is running.`
                : "Signer Sidecar Unreachable (:8001). Agent requests cannot be signed."}
            </span>
          </div>
          <span className="font-mono text-[11px] opacity-75">
            GATEWAY: {connected ? "ONLINE" : "OFFLINE"} | SIDECAR:{" "}
            {sidecarReachable ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-6 h-16 gap-4">
        {/* Left: Breadcrumb / Title */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-mono tracking-widest text-slate-500">
            AgentPass
          </span>
          <span className="text-slate-600">/</span>
          <h1 className="text-base font-semibold text-white tracking-tight">
            {currentTab}
          </h1>
        </div>

        {/* Center: Search bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search agents, requests, policies..."
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                onSearch?.(e.target.value);
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-[#0D1526] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>
        </div>

        {/* Right Actions: System Status, Quick Start, Reset, Alerts, Profile */}
        <div className="flex items-center gap-3">
          {/* Live System Operational Chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            {connected && sidecarReachable ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-medium text-emerald-400">
                  System Operational
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] font-medium text-rose-400">
                  Degraded
                </span>
              </>
            )}
          </div>

          {/* Quick Start Bootstrap Button */}
          <button
            onClick={handleBootstrap}
            disabled={bootstrapping || !connected}
            title="Bootstrap delegation pass and sidecar ticket #1"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>{bootstrapping ? "Bootstrapping..." : "Quick Start"}</span>
          </button>

          {/* Reset Demo Button */}
          <button
            onClick={handleResetClick}
            disabled={!connected}
            title="Reset runtime data and keys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-400 border border-slate-700/80 text-slate-300 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Security Alerts"
            >
              <Bell className="w-4 h-4" />
              {alertsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-lg glow-red">
                  {alertsCount}
                </span>
              )}
            </button>
          </div>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
              SJ
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
