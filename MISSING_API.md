# AgentPass: Backend API Observations & Missing Image Fields

This document lists visual elements shown in the reference design mockups that the current `agentpass-backend` API does not provide. In accordance with the strict rule:
> *"If an image shows a field the API does not provide, show '-' and add a line to `MISSING_API.md`. Do not invent values. No mock, fake, placeholder, or hardcoded data anywhere."*

The frontend never fakes or hardcodes these values; they are populated with authentic data where available, or `-` when absent.

---

### 1. Multi-Agent Registry Endpoint (`/api/agents`)
- **Image Reference:** Screen 4 ("Agents Page") shows 5 distinct persistent agents: `FinanceBot`, `ResearchAgent`, `EmailAssistant`, `DataAnalyzer`, and `MarketingAgent`, each with distinct assigned tasks, risk tiers, and creation timestamps.
- **Current Backend Reality:** The backend runs a single, dedicated signer sidecar process with one active agent identity (`invoice-assistant`, or dynamically provided via `/api/demo/request-pass`). There is no multi-agent database table or `GET /api/agents` CRUD endpoint.
- **Frontend Handling:** The frontend displays the real active sidecar agent from `state.sidecar` and `state.pass`, and provides the complete interactive Scenario Runner (`GET /api/agent/scenarios` and `POST /api/agent/run/{id}`).
- **Recommended Backend Addition:**
  ```http
  GET /api/agents
  POST /api/agents
  ```
  Returns `[{"id": "...", "name": "FinanceBot", "role": "Manage invoices", "status": "active", "risk_score": 24, "created_at": "..."}]`.

---

### 2. Metric Historical Delta Badges ("+2 today", "+12%", "-3%")
- **Image Reference:** Screen 3 ("Overview Metric Cards") displays small delta badges below each counter (e.g. `+2 today`, `+12%`, `-3%`).
- **Current Backend Reality:** `GET /api/state` -> `metrics` returns absolute counters: `total_requests`, `allowed`, `denied`, `step_up`, `alerts`, `avg_latency_ms`, and `p95_latency_ms`. It does not calculate day-over-day or hour-over-hour percentage differentials.
- **Frontend Handling:** Displays the exact real numbers from `metrics`, and computes real percentage shares (e.g. allowed % of total requests) rather than inventing fake "+12%" labels.
- **Recommended Backend Addition:**
  Include a `deltas` object in `_metrics()`:
  ```json
  "deltas": {
    "total_today": 12,
    "allowed_pct_change": 12.5,
    "blocked_pct_change": -3.2
  }
  ```

---

### 3. Agent Key Rotation History
- **Image Reference:** Screen 9 ("Key Vault") shows a card field `"Last rotated 10 days ago"`.
- **Current Backend Reality:** The SQLite `secrets` schema stores `name`, `fingerprint`, `created_at`, `uses`, and `last_used`. It does not track automated key rotation cycles or rotation schedule history.
- **Frontend Handling:** Displays `last_used` formatted timestamp and usage counts directly from `GET /api/vault`.

---

### 4. Human Approval Risk Score Field
- **Image Reference:** Screen 7 ("Human Approval") shows `"Risk Score: 78 (High)"` directly on the pending approval card.
- **Current Backend Reality:** `pipeline.approval_view(r)` returns `id`, `pass_id`, `tool`, `action`, `params`, `request_hash`, `reasons`, `status`, `created_at`, `expires_at`, `seconds_left`. It does not include an explicit integer `risk_score` on the approval model itself.
- **Frontend Handling:** Renders the reasons array and evaluates risk tier from policy definitions, showing `-` if score integer is omitted.
