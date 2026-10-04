# AgentPass Backend

Key-bound, burn-after-use authorization for AI agents. Everything the dashboard shows comes
from this backend: real signatures, real one-time tickets, a real encrypted vault, a real
hash-chained audit log. There is no mock data in the API.

## Run it

```bash
pip install -r requirements.txt
python run.py                      # gateway :8000 + signer sidecar :8001 (two separate processes)
# in another terminal:
python selftest.py                 # 53 end-to-end checks against the live servers
```

- Interactive API docs: http://127.0.0.1:8000/docs
- First call for the demo: `POST /api/demo/bootstrap` (requests a pass, approves it as the human,
  sidecar claims ticket #1). Or use the two-step flow shown in "Delegation flow".
- Config via env vars: `GATEWAY_PORT`, `SIDECAR_PORT`, `AGENTPASS_DATA` (data dir),
  `CORS_ORIGINS` (default `*`), `AGENTPASS_SIMULATION=0` to disable attack-simulation endpoints.
- Windows: `py -m pip install -r requirements.txt` then `py run.py`.

## How it works (one request)

```
Agent (untrusted)  -- "do action" -->  Signer sidecar (holds private key + current ticket)
Sidecar -- ticket + signed proof --> Gateway
Gateway: verify ticket sig -> key match -> proof sig -> freshness -> nonce -> request binding
         -> idempotency -> pass/chain valid -> BURN ticket (atomic) -> policy
         -> ALLOW: vault injects real API key -> tool -> scrub response
         -> STEP_UP: human must approve the exact action   -> DENY: blocked + reason
Gateway -- result + NEXT ticket --> Sidecar -- result only --> Agent
Every step -> hash-chained audit log -> live SSE stream -> dashboard
```

Three locks: **Vault** (agent never holds API keys), **Bind** (requests signed by a key the AI
never sees), **Burn** (each ticket works exactly once; the next one arrives with the response).

## Services

| Service | Port | Role |
|---|---|---|
| Gateway (`agentpass/gateway_app.py`) | 8000 | `/v1/*` protected API, `/api/*` dashboard API, `/tools/*` mock tools |
| Signer sidecar (`agentpass/sidecar_app.py`) | 8001 | private key + ticket live only here; `/act`, `/status`, `/debug/*` (simulation) |

## Delegation flow

1. `POST /api/demo/request-pass` -> sidecar sends a pass request. Returns `{request_id}`.
2. `GET /api/state` -> `pending_pass_requests[]` (each has `blast_radius` in plain words).
3. `POST /api/pass-requests/{id}/approve` (human) -> pass + chain + ticket #1 created.
4. Sidecar claims ticket #1 automatically (proves it holds the key). `state.sidecar.has_ticket` turns true.

## Dashboard API (everything returns real data)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/state` | one call for the whole overview (shape below) |
| GET | `/api/events` | **SSE** live stream of audit events (`data: {"kind":"audit","record":{...}}`; also `{"kind":"approval","id"}`) |
| GET | `/api/audit?limit=100&before_id=&alerts_only=false` | audit records, newest first |
| GET | `/api/audit/verify` | `{valid,length,checked,first_broken_id}` |
| GET | `/api/traces` | recent traces (one per scenario/attack run) |
| GET | `/api/trace/{trace_id}` | causal graph: `{nodes[],edges[]}` |
| GET | `/api/world` | mock world: `inbox`, `sent`, `payments`, `files` (changed only by real tool calls) |
| GET | `/api/vault` | secret names, fingerprints, use counts. **Never values** |
| GET | `/api/policy` | tools/actions/risk tiers/thresholds/default pass request |
| GET | `/api/approvals?status=pending` | step-up approvals |
| POST | `/api/approvals/{id}/decision` | body `{"decision":"approve"\|"deny","request_hash":"<from approval>"}` |
| GET | `/api/pass-requests` | pass requests with blast radius |
| POST | `/api/pass-requests/{id}/approve` / `/reject` | human decision |
| POST | `/api/passes/{pass_id}/revoke` | kill switch |
| POST | `/api/chains/{chain_id}/unfreeze` | human re-approval after a key-holder anomaly |
| POST | `/api/chains/{chain_id}/clear-taint` | human reviewed untrusted content |
| GET | `/api/agent/scenarios` | agent scenarios (id, title, description, expected) |
| POST | `/api/agent/run/{scenario_id}` | run a scenario through the sidecar (real requests) |
| GET | `/api/attack/list` | attacks (id, title, description, expected) |
| POST | `/api/attack/{name}` | run an attack (real HTTP requests at the gateway) |
| POST | `/api/demo/reset` | wipe all runtime data, new vault keys, new sidecar key |
| POST | `/api/demo/request-pass` | step 1 of delegation |
| POST | `/api/demo/bootstrap` | request + approve + claim in one call |
| POST | `/api/demo/tamper-audit` | edit one audit row in the DB to prove the chain detects it |

Agent scenario ids: `normal_task, read_inbox, prompt_injection, legit_payment, bulk_access,
scope_violation, canary_trip, budget_exhaustion, echo_leak`.
Attack ids: `stolen_ticket, replay_captured, tamper_body, forged_ticket, reuse_spent_ticket, direct_tool`.

### `GET /api/state` shape

```jsonc
{
  "server_time": "ISO",
  "sidecar": {"reachable":true,"agent_id":"...","key_thumbprint":"...","key_extractable":false,
              "claim_status":"waiting_for_human|claimed|...","has_ticket":true,
              "chain_id":"...","pass_id":"...","seq":3},
  "pass": {"id","agent_id","status":"active|revoked|expired","scopes":[],"budget":{},"task":{},
           "risk_policy":{},"key_thumbprint","created","expires","seconds_left","revoked",
           "revoke_reason","blast_radius":{"can":[],"cannot":[],"expires_in_minutes","max_money","max_emails_per_hour"}} | null,
  "chain": {"id","state":"active|frozen|closed","next_seq","tainted":false,"taint_reason":null} | null,
  "tickets": [{"seq":2,"id":"t_...","status":"active|burned|superseded","issued","burned",
               "outcome":"ALLOW|DENY|STEP_UP|null","summary":"..."}],      // ticket relay visual
  "budgets": {"email:send":{"used":0,"limit":5,"window_seconds":3600,"unit":"emails"},
              "pay:create":{"used":0,"limit":500,"unit":"INR"}},
  "behavior": {"score":0,"breakdown":[{"signal","points","why"}],"step_up_at":70,"deny_at":90},
  "metrics": {"total_requests","allowed","denied","step_up","alerts","deny_reasons":{},
              "avg_latency_ms","p95_latency_ms"},
  "pending_pass_requests": [ {id,agent_id,scopes,budget,task,blast_radius,...} ],
  "pending_approvals": [ {id,tool,action,params,request_hash,reasons,seconds_left,...} ],
  "vault": [{"name","fingerprint","uses","last_used","stored","exposed_to_agent":false}],
  "audit": {"valid":true,"length":12,"checked":12,"first_broken_id":null}
}
```

### Audit record shape

```jsonc
{"id":42,"time":"ISO","ts":1767400000.1,"trace_id":"tr_...","pass_id":"...","chain_id":"...",
 "seq":3,"event_type":"CALL_ALLOWED","decision":"ALLOW|DENY|STEP_UP|INFO","reason":"OK",
 "severity":"info|warn|high|critical","tool":"pay","action":"pay:create","request_hash":"...",
 "detail":{"alert":null,"latency_ms":4.2,"params":{},"risk":"low","behavior_score":0,
           "behavior_breakdown":[],"result_summary":"...","why":"..."},
 "prev_hash":"...","record_hash":"..."}
```

- `event_type`: `PASS_REQUESTED, PASS_ISSUED, PASS_REJECTED, CALL_ALLOWED, CALL_DENIED,
  CALL_PENDING_APPROVAL, APPROVAL_APPROVED, APPROVAL_DENIED, APPROVAL_EXPIRED, CHAIN_FROZEN,
  CHAIN_UNFROZEN, PASS_REVOKED, TAINT_SET, TAINT_CLEARED, TICKET_RESYNC, IDEMPOTENT_REPLAY,
  TOOL_DIRECT_ACCESS_DENIED, DEMO_RESET`
- `reason` codes: `OK, TICKET_SIGNATURE_INVALID, TICKET_EXPIRED, PROOF_MALFORMED, KEY_MISMATCH,
  PROOF_SIGNATURE_INVALID, PROOF_STALE, PROOF_REPLAY, BINDING_MISMATCH, CHAIN_UNKNOWN,
  PASS_REVOKED, PASS_EXPIRED, CHAIN_FROZEN, TICKET_ALREADY_USED, TICKET_SUPERSEDED,
  SCOPE_DENIED, CANARY_TRIPPED, INTENT_VIOLATION, BUDGET_EXCEEDED, BEHAVIOR_ANOMALY,
  HIGH_RISK_ACTION, TAINTED_CONTEXT, BEHAVIOR_SCORE_HIGH, UNKNOWN_ACTION, INVALID_PARAMS,
  HUMAN_APPROVED, HUMAN_DENIED, INVALID_TOOL_KEY`
- `detail.alert` (show in Alerts panel): `STOLEN_TICKET_ATTEMPT, FORGED_TICKET,
  CAPTURED_REQUEST_REPLAY, BODY_TAMPER_ATTEMPT, KEY_HOLDER_ANOMALY, SCOPE_VIOLATION,
  INTENT_VIOLATION, BUDGET_VIOLATION, CANARY_TRIPPED, BEHAVIOR_ANOMALY, APPROVAL_DENIED,
  TOOL_BYPASS_ATTEMPT, PASS_REVOKED`

### Scenario result (`POST /api/agent/run/{id}`)

`{"scenario","trace_id","note","steps":[{"label","tool","action","params","response":
{"status","decision","reason","alert","approval_id","seq","latency_ms","result"}}]}`

### Attack result (`POST /api/attack/{name}`)

`{"attack","trace_id","summary","all_blocked":true,"chain_state","chain_seq",
"attempts":[{"label","http_status","blocked","reason","alert"}]}`

## Decision rules (deterministic, no ML)

Order: scope -> canary -> intent -> budget -> behavior -> risk/taint.
- **DENY:** action not in pass scopes; canary touched (also auto-revokes the pass); recipient/payee/amount
  outside the authorized task; budget exceeded; behavior score >= 90.
- **STEP_UP:** high-risk action; medium/high action while the chain is **tainted** (agent read untrusted
  external content); behavior score >= 70 (e.g. asking for >100 files at once).
- **ALLOW:** everything else.
- Every identity-valid attempt **burns its ticket**, even denied ones (one ticket = one attempt).

## Honest limits (say these out loud)

- The private key is protected by **process isolation** (sidecar), not hardware. Production would use a TPM,
  Secure Enclave or cloud KMS. Python cannot mark a key non-extractable like browser WebCrypto.
- `/debug/*` on the sidecar are **simulation endpoints** that stand in for traffic an attacker could capture
  (logs, network, memory). They never return the private key. Disable with `AGENTPASS_SIMULATION=0`.
- Human approval is bound to the exact action by its hash; it is a click, not WebAuthn (roadmap).
- The dashboard API has no login (prototype). Tools are reached over loopback HTTP without TLS.
- Low-risk, in-scope misuse by a manipulated agent is contained (scope, budget, behavior, audit), not eliminated.
- SQLite, single node. Python strings cannot be zeroed, so decrypted keys are dropped, not wiped.
