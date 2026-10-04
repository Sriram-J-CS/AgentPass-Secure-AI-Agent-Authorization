"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar, NavTab } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OverviewScreen } from "@/components/screens/OverviewScreen";
import { DelegationScreen } from "@/components/screens/DelegationScreen";
import { TicketRelayScreen } from "@/components/screens/TicketRelayScreen";
import { AgentRunnerScreen } from "@/components/screens/AgentRunnerScreen";
import { AttackCenterScreen } from "@/components/screens/AttackCenterScreen";
import { ApprovalsScreen } from "@/components/screens/ApprovalsScreen";
import { CausalTraceScreen } from "@/components/screens/CausalTraceScreen";
import { AuditScreen } from "@/components/screens/AuditScreen";
import { VaultScreen } from "@/components/screens/VaultScreen";
import { WorldScreen } from "@/components/screens/WorldScreen";
import { PolicyScreen } from "@/components/screens/PolicyScreen";
import { ArchitectureScreen } from "@/components/screens/ArchitectureScreen";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

function DashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as NavTab) || "overview";
  const initialTrace = searchParams.get("trace");

  const [currentTab, setCurrentTab] = useState<NavTab>(initialTab);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(
    initialTrace || null
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab") as NavTab;
    if (tabParam) {
      setCurrentTab(tabParam);
    }
    const traceParam = searchParams.get("trace");
    if (traceParam) {
      setSelectedTraceId(traceParam);
    }
  }, [searchParams]);

  const handleNavigateToTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    setCurrentTab("traces");
  };

  const getTabTitle = (tab: NavTab) => {
    const titles: Record<NavTab, string> = {
      overview: "Real-Time Security Overview",
      agents: "Agent Directory & Scenario Runner",
      delegation: "Pass Requests & Human Delegation",
      relay: "Burn-After-Use Ticket Relay",
      attacks: "Attack Center & Red Team Simulations",
      approvals: "Human-in-the-Loop Approvals",
      traces: "Causal Trace Graph",
      audit: "Hash-Chained Audit Ledger",
      vault: "Key Vault & KMS Secrets",
      world: "World Data & Tool State",
      policy: "Runtime Policy & Thresholds",
      architecture: "System Architecture & Protocol",
      settings: "System Configuration & JWK",
    };
    return titles[tab] || "Dashboard";
  };

  return (
    <div className="flex min-h-screen bg-[#080C14] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTab={getTabTitle(currentTab)} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {currentTab === "overview" && (
            <OverviewScreen onNavigateToTab={(t) => setCurrentTab(t as NavTab)} />
          )}
          {currentTab === "agents" && (
            <AgentRunnerScreen onNavigateToTrace={handleNavigateToTrace} />
          )}
          {currentTab === "delegation" && <DelegationScreen />}
          {currentTab === "relay" && <TicketRelayScreen />}
          {currentTab === "attacks" && <AttackCenterScreen />}
          {currentTab === "approvals" && <ApprovalsScreen />}
          {currentTab === "traces" && (
            <CausalTraceScreen initialTraceId={selectedTraceId} />
          )}
          {currentTab === "audit" && <AuditScreen />}
          {currentTab === "vault" && <VaultScreen />}
          {currentTab === "world" && <WorldScreen />}
          {currentTab === "policy" && <PolicyScreen />}
          {currentTab === "architecture" && <ArchitectureScreen />}
          {currentTab === "settings" && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-xs text-slate-400 font-mono">
          Loading AgentPass Control Plane...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
