/**
 * Typed definitions matching AgentPass Backend (agentpass-backend/README.md)
 * Strict TypeScript: NO `any` types.
 */

export type DecisionType = "ALLOW" | "DENY" | "STEP_UP" | "INFO";
export type SeverityType = "info" | "warn" | "high" | "critical";

export type EventType =
  | "PASS_REQUESTED"
  | "PASS_ISSUED"
  | "PASS_REJECTED"
  | "CALL_ALLOWED"
  | "CALL_DENIED"
  | "CALL_PENDING_APPROVAL"
  | "APPROVAL_APPROVED"
  | "APPROVAL_DENIED"
  | "APPROVAL_EXPIRED"
  | "CHAIN_FROZEN"
  | "CHAIN_UNFROZEN"
  | "PASS_REVOKED"
  | "TAINT_SET"
  | "TAINT_CLEARED"
  | "TICKET_RESYNC"
  | "IDEMPOTENT_REPLAY"
  | "TOOL_DIRECT_ACCESS_DENIED"
  | "DEMO_RESET";

export type ReasonCode =
  | "OK"
  | "TICKET_SIGNATURE_INVALID"
  | "TICKET_EXPIRED"
  | "PROOF_MALFORMED"
  | "KEY_MISMATCH"
  | "PROOF_SIGNATURE_INVALID"
  | "PROOF_STALE"
  | "PROOF_REPLAY"
  | "BINDING_MISMATCH"
  | "CHAIN_UNKNOWN"
  | "PASS_REVOKED"
  | "PASS_EXPIRED"
  | "CHAIN_FROZEN"
  | "TICKET_ALREADY_USED"
  | "TICKET_SUPERSEDED"
  | "SCOPE_DENIED"
  | "CANARY_TRIPPED"
  | "INTENT_VIOLATION"
  | "BUDGET_EXCEEDED"
  | "BEHAVIOR_ANOMALY"
  | "HIGH_RISK_ACTION"
  | "TAINTED_CONTEXT"
  | "BEHAVIOR_SCORE_HIGH"
  | "UNKNOWN_ACTION"
  | "INVALID_PARAMS"
  | "HUMAN_APPROVED"
  | "HUMAN_DENIED"
  | "INVALID_TOOL_KEY"
  | string;

export type AlertType =
  | "STOLEN_TICKET_ATTEMPT"
  | "FORGED_TICKET"
  | "CAPTURED_REQUEST_REPLAY"
  | "BODY_TAMPER_ATTEMPT"
  | "KEY_HOLDER_ANOMALY"
  | "SCOPE_VIOLATION"
  | "INTENT_VIOLATION"
  | "BUDGET_VIOLATION"
  | "CANARY_TRIPPED"
  | "BEHAVIOR_ANOMALY"
  | "APPROVAL_DENIED"
  | "TOOL_BYPASS_ATTEMPT"
  | "PASS_REVOKED"
  | string;

export interface SidecarStatus {
  reachable: boolean;
  agent_id?: string;
  key_thumbprint?: string;
  key_extractable?: boolean;
  claim_status?: string;
  has_ticket?: boolean;
  chain_id?: string;
  pass_id?: string;
  seq?: number;
  jwk?: Record<string, unknown>;
}

export interface BlastRadius {
  can: string[];
  cannot: string[];
  expires_in_minutes: number;
  max_money: number;
  max_emails_per_hour: number;
}

export interface PassView {
  id: string;
  agent_id: string;
  status: "active" | "revoked" | "expired";
  scopes: string[];
  budget: Record<string, unknown>;
  task: {
    purpose?: string;
    allowed_recipient_domains?: string[];
    allowed_payees?: string[];
    max_payment?: number;
  };
  risk_policy: Record<string, string>;
  key_thumbprint: string;
  created: string;
  expires: string;
  seconds_left: number;
  revoked: boolean;
  revoke_reason: string | null;
  blast_radius: BlastRadius;
}

export interface ChainView {
  id: string;
  state: "active" | "frozen" | "closed";
  next_seq: number;
  tainted: boolean;
  taint_reason: string | null;
}

export interface TicketView {
  seq: number;
  id: string;
  status: "active" | "burned" | "superseded";
  issued: string;
  burned: string | null;
  outcome: DecisionType | null;
  summary: string;
}

export interface BudgetEntry {
  used: number;
  limit: number;
  window_seconds?: number;
  unit: string;
  remaining?: number;
  currency?: string;
  max_total?: number;
}

export interface BehaviorSignal {
  signal: string;
  points: number;
  why: string;
}

export interface BehaviorView {
  score: number;
  breakdown: BehaviorSignal[];
  step_up_at: number;
  deny_at: number;
}

export interface MetricsView {
  total_requests: number;
  allowed: number;
  denied: number;
  step_up: number;
  alerts: number;
  deny_reasons: Record<string, number>;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
}

export interface PassRequestView {
  id: string;
  agent_id: string;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  scopes: string[];
  budget: Record<string, unknown>;
  task: {
    purpose?: string;
    allowed_recipient_domains?: string[];
    allowed_payees?: string[];
    max_payment?: number;
  };
  blast_radius: BlastRadius;
  key_thumbprint?: string;
}

export interface ApprovalView {
  id: string;
  pass_id: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
  request_hash: string;
  reasons: string[];
  status: "pending" | "approved" | "denied" | "expired";
  created_at: string;
  expires_at: string;
  seconds_left: number;
  agent_id?: string;
  risk_score?: number;
}

export interface VaultSecret {
  name: string;
  fingerprint: string;
  uses: number;
  created: string;
  last_used: string | null;
  stored: string;
  exposed_to_agent: false;
}

export interface AuditVerifyResult {
  valid: boolean;
  length: number;
  checked: number;
  first_broken_id: number | null;
}

export interface StateResponse {
  server_time: string;
  sidecar: SidecarStatus;
  pass: PassView | null;
  chain: ChainView | null;
  tickets: TicketView[];
  budgets: Record<string, BudgetEntry>;
  behavior: BehaviorView | null;
  metrics: MetricsView;
  pending_pass_requests: PassRequestView[];
  pending_approvals: ApprovalView[];
  vault: VaultSecret[];
  audit: AuditVerifyResult;
}

export interface AuditRecordDetail {
  alert?: AlertType | null;
  latency_ms?: number;
  params?: Record<string, unknown>;
  risk?: string;
  behavior_score?: number;
  behavior_breakdown?: BehaviorSignal[];
  result_summary?: string;
  why?: string;
  taint?: string;
  note?: string;
}

export interface AuditRecord {
  id: number;
  time: string;
  ts: number;
  trace_id: string | null;
  pass_id: string | null;
  chain_id: string | null;
  seq: number | null;
  event_type: EventType;
  decision: DecisionType;
  reason: ReasonCode;
  severity: SeverityType;
  tool: string | null;
  action: string | null;
  request_hash: string | null;
  detail: AuditRecordDetail;
  prev_hash: string | null;
  record_hash: string;
}

export interface TraceSummary {
  trace_id: string;
  events: number;
  alerts: number;
  started: string;
  first_action: string;
}

export interface TraceNode {
  id: number;
  event_type: EventType;
  decision: DecisionType;
  reason: ReasonCode;
  severity: SeverityType;
  tool: string | null;
  action: string | null;
  time: string;
  alert: string | null;
  explanation: string;
  label: string;
}

export interface TraceEdge {
  source: number;
  target: number;
}

export interface TraceGraphResponse {
  trace_id: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
}

export interface ScenarioStepResponse {
  status?: number;
  decision?: DecisionType;
  reason?: string;
  alert?: string | null;
  approval_id?: string;
  seq?: number;
  latency_ms?: number;
  result?: unknown;
}

export interface ScenarioStep {
  label: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
  response: ScenarioStepResponse;
}

export interface ScenarioRunResult {
  scenario: string;
  trace_id: string;
  note: string;
  steps: ScenarioStep[];
  error?: string;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
  expected: string;
}

export interface AttackAttempt {
  label: string;
  http_status: number;
  blocked: boolean;
  reason?: string;
  alert?: string | null;
}

export interface AttackRunResult {
  attack: string;
  trace_id: string;
  summary: string;
  all_blocked: boolean;
  chain_state: "active" | "frozen" | "closed" | null;
  chain_seq: number | null;
  attempts: AttackAttempt[];
  error?: string;
}

export interface AttackInfo {
  id: string;
  title: string;
  description: string;
  expected: string;
}

export interface WorldInboxEmail {
  id: number;
  sender: string;
  subject: string;
  body: string;
  external: number; // 1 = external/untrusted
}

export interface WorldSentEmail {
  id: number;
  ts: number;
  to_addr: string;
  subject: string;
  body: string;
}

export interface WorldPayment {
  id: number;
  ts: number;
  payee: string;
  amount: number;
  currency: string;
  memo: string;
  ref: string;
}

export interface WorldFile {
  id: number;
  name: string;
  canary: number; // 1 = canary token
}

export interface WorldSnapshot {
  inbox: WorldInboxEmail[];
  sent: WorldSentEmail[];
  payments: WorldPayment[];
  files: WorldFile[];
}

export interface PolicyActionConfig {
  risk: "low" | "medium" | "high";
  method: string;
  path: string;
  description: string;
  untrusted_output?: boolean;
}

export interface PolicyToolConfig {
  secret: string;
  auth_header: string;
  actions: Record<string, PolicyActionConfig>;
}

export interface PolicyThresholds {
  behavior_step_up: number;
  behavior_deny: number;
  ticket_ttl_seconds: number;
  proof_window_seconds: number;
  approval_ttl_seconds: number;
  unknown_action_risk: string;
}

export interface PolicyResponse {
  tools: Record<string, PolicyToolConfig>;
  thresholds: PolicyThresholds;
  default_pass_request: Record<string, unknown>;
}

export interface SSEEvent {
  kind: "audit" | "approval";
  record?: AuditRecord;
  id?: string;
  backlog?: boolean;
}
