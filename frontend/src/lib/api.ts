/**
 * Typed API client for AgentPass Gateway
 * Connects ONLY to gateway /api/* endpoints.
 */

import {
  StateResponse,
  AuditRecord,
  AuditVerifyResult,
  TraceSummary,
  TraceGraphResponse,
  WorldSnapshot,
  VaultSecret,
  PolicyResponse,
  ApprovalView,
  PassRequestView,
  ScenarioInfo,
  ScenarioRunResult,
  AttackInfo,
  AttackRunResult,
  SidecarStatus,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMessage = errJson.error;
      else if (errJson.detail) errMessage = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return (await res.json()) as T;
}

export const api = {
  // System Health & State
  getHealth: () =>
    request<{ ok: boolean; uptime_seconds: number; time: string }>(
      "/api/health"
    ),

  getState: () => request<StateResponse>("/api/state"),

  // Audit
  getAudit: (limit = 100, beforeId?: number, alertsOnly = false) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    if (beforeId !== undefined) params.set("before_id", beforeId.toString());
    if (alertsOnly) params.set("alerts_only", "true");
    return request<{ records: AuditRecord[] }>(`/api/audit?${params.toString()}`);
  },

  verifyAudit: () => request<AuditVerifyResult>("/api/audit/verify"),

  tamperAudit: () =>
    request<{ tampered_record_id: number; verification: AuditVerifyResult }>(
      "/api/demo/tamper-audit",
      { method: "POST" }
    ),

  // Causal Traces
  getTraces: () => request<{ traces: TraceSummary[] }>("/api/traces"),

  getTrace: (traceId: string) =>
    request<TraceGraphResponse>(`/api/trace/${encodeURIComponent(traceId)}`),

  // World Data
  getWorld: () => request<WorldSnapshot>("/api/world"),

  // Vault
  getVault: () =>
    request<{ secrets: VaultSecret[]; note: string }>("/api/vault"),

  // Policy
  getPolicy: () => request<PolicyResponse>("/api/policy"),

  // Approvals
  getApprovals: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<{ approvals: ApprovalView[] }>(`/api/approvals${query}`);
  },

  decideApproval: (
    approvalId: string,
    decision: "approve" | "deny",
    requestHash: string
  ) =>
    request<Record<string, unknown>>(`/api/approvals/${approvalId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, request_hash: requestHash }),
    }),

  // Pass Requests (Delegation)
  getPassRequests: () =>
    request<{ requests: PassRequestView[] }>("/api/pass-requests"),

  approvePassRequest: (requestId: string) =>
    request<Record<string, unknown>>(`/api/pass-requests/${requestId}/approve`, {
      method: "POST",
    }),

  rejectPassRequest: (requestId: string) =>
    request<{ ok: boolean }>(`/api/pass-requests/${requestId}/reject`, {
      method: "POST",
    }),

  // Pass & Chain Management
  revokePass: (passId: string) =>
    request<{ ok: boolean }>(`/api/passes/${passId}/revoke`, {
      method: "POST",
    }),

  unfreezeChain: (chainId: string) =>
    request<{ ok: boolean }>(`/api/chains/${chainId}/unfreeze`, {
      method: "POST",
    }),

  clearTaint: (chainId: string) =>
    request<{ ok: boolean }>(`/api/chains/${chainId}/clear-taint`, {
      method: "POST",
    }),

  // Agent Scenarios
  getScenarios: () =>
    request<{ scenarios: ScenarioInfo[] }>("/api/agent/scenarios"),

  runScenario: (scenarioId: string) =>
    request<ScenarioRunResult>(`/api/agent/run/${encodeURIComponent(scenarioId)}`, {
      method: "POST",
    }),

  // Attacks
  getAttacks: () => request<{ attacks: AttackInfo[] }>("/api/attack/list"),

  runAttack: (attackName: string) =>
    request<AttackRunResult>(`/api/attack/${encodeURIComponent(attackName)}`, {
      method: "POST",
    }),

  // Demo Controls
  resetDemo: () =>
    request<{ ok: boolean }>("/api/demo/reset", { method: "POST" }),

  requestPassDemo: () =>
    request<{ request_id?: string; [key: string]: unknown }>(
      "/api/demo/request-pass",
      { method: "POST" }
    ),

  bootstrapDemo: () =>
    request<{ ok: boolean; sidecar?: SidecarStatus }>("/api/demo/bootstrap", {
      method: "POST",
    }),
};
