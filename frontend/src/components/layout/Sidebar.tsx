"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Bot,
  KeyRound,
  Repeat,
  ShieldAlert,
  UserCheck,
  Network,
  ScrollText,
  Lock,
  Globe,
  Sliders,
  Cpu,
  Settings,
  Shield,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useAgentPass } from "@/context/AgentPassContext";

export type NavTab =
  | "overview"
  | "agents"
  | "delegation"
  | "relay"
  | "attacks"
  | "approvals"
  | "traces"
  | "audit"
  | "vault"
  | "world"
  | "policy"
  | "architecture"
  | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { state } = useAgentPass();

  const pendingApprovalsCount = state?.pending_approvals?.length || 0;
  const pendingPassRequestsCount = state?.pending_pass_requests?.length || 0;

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "agents", label: "Agents & Runner", icon: Bot },
    {
      id: "delegation",
      label: "Passes & Delegation",
      icon: KeyRound,
      badge: pendingPassRequestsCount,
      badgeColor: "bg-cyan-500 text-black",
    },
    { id: "relay", label: "Ticket Relay", icon: Repeat },
    { id: "attacks", label: "Attack Center", icon: ShieldAlert },
    {
      id: "approvals",
      label: "Approvals",
      icon: UserCheck,
      badge: pendingApprovalsCount,
      badgeColor: "bg-amber-500 text-black font-bold animate-pulse",
    },
    { id: "traces", label: "Causal Trace", icon: Network },
    { id: "audit", label: "Audit Log", icon: ScrollText },
    { id: "vault", label: "Key Vault", icon: Lock },
    { id: "world", label: "World Data", icon: Globe },
    { id: "policy", label: "Policy Config", icon: Sliders },
    { id: "architecture", label: "Architecture", icon: Cpu },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#080C14] flex flex-col justify-between h-screen sticky top-0 select-none">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand / Logo */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-black font-black text-sm">
            <Shield className="w-4 h-4 text-slate-950 fill-current" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white">
                AgentPass
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                v1.0
              </span>
            </div>
            <span className="text-[10px] text-slate-400 tracking-wider">
              AI Security Gateway
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Control Plane
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      item.badgeColor || "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Public Views Links */}
        <div className="p-3 border-t border-slate-800/60 mt-auto">
          <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Public Views
          </div>
          <div className="space-y-1 mt-1">
            <Link
              href="/landing"
              className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-cyan-400 hover:bg-slate-800/40 transition-colors"
            >
              <span>Landing Page</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-cyan-400 hover:bg-slate-800/40 transition-colors"
            >
              <span>Login Portal</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer User Profile (Matching image 3) */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0A0F1A]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              SJ
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white truncate">
                Sriram J
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-400 truncate">
                  Workspace Owner
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Online
          </span>
        </div>
      </div>
    </aside>
  );
};
