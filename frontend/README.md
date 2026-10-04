# AgentPass Web Frontend

Production-grade, zero-trust security control plane for AI agents. Built with Next.js (App Router), TypeScript, and Tailwind CSS. Directly connects to the `agentpass-backend` gateway via HTTP and Server-Sent Events (SSE).

---

## Getting Started

### Prerequisites
- Node.js (v18+) and npm
- Running AgentPass backend gateway (`:8000` or configured port) and signer sidecar (`:8001`)

### 1. Setup Environment
By default, the frontend connects to `http://127.0.0.1:8000`. You can configure the gateway URL via `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010
```

### 2. Install & Run Dev Server
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
npm run start
```

---

## Screen-to-Endpoint Mapping Table

Every screen, card, and metric connects exclusively to the gateway's `/api/*` endpoints with zero mock data:

| Screen / View | Primary Endpoints | Description |
|---|---|---|
| **Landing Page** (`/landing`) | Static / Navigation | High-impact overview of AgentPass architecture, value pillars, and gateway decisions |
| **Login Portal** (`/login`) | Static / Navigation | Secure workspace authentication interface |
| **1. Overview** (`/`) | `GET /api/state`<br>`GET /api/events` (SSE) | Real-time metric cards (total, allowed, denied, step-up, alerts, latency), live SSE feed, decision donut chart, risk trend chart, active pass card, kill switch |
| **2. Delegation & Passes** | `GET /api/pass-requests`<br>`POST /api/pass-requests/{id}/approve`<br>`POST /api/pass-requests/{id}/reject`<br>`POST /api/demo/request-pass`<br>`POST /api/demo/bootstrap` | Pending delegation requests with computed blast radius (can/cannot), human approve/reject |
| **3. Ticket Relay** | `GET /api/state` (`state.tickets`, `state.chain`) | Visual chain of one-time tickets (Burned, Active, Superseded) with sequence tracking |
| **4. Agent Runner** | `GET /api/agent/scenarios`<br>`POST /api/agent/run/{id}` | Live scenario execution against sidecar; per-step latency, decision, parameter inspection, and trace linking |
| **5. Attack Center** | `GET /api/attack/list`<br>`POST /api/attack/{name}`<br>`POST /api/chains/{id}/unfreeze` | 6 live attack simulations (stolen ticket, wire replay, body tamper, forged ticket, spent ticket reuse, direct tool bypass); Security Pipeline verification checklist; unfreeze chain action |
| **6. Approvals (Step-Up)** | `GET /api/approvals?status=pending`<br>`POST /api/approvals/{id}/decision` | Real-time countdown timer, parameter inspection, SHA-256 request hash binding, human approve/deny decisions |
| **7. Causal Trace** | `GET /api/traces`<br>`GET /api/trace/{trace_id}` | Interactive Cytoscape graph of policy checks and decisions; node inspector with evidence and explanation |
| **8. Audit Ledger** | `GET /api/audit`<br>`GET /api/audit/verify`<br>`POST /api/demo/tamper-audit` | SHA-256 hash-chained immutable log, filters, cryptographic chain verification, and database tampering detection demo |
| **9. Key Vault** | `GET /api/vault` | Encrypted secrets catalog (fingerprints, AES-256-GCM status, usage counts). Zero secret values are exposed |
| **10. World Data** | `GET /api/world` | Live state of mock upstream tools: Inbox (with untrusted taint flags), Sent Emails, Payments Ledger, Files (with canary tripwires) |
| **11. Policy Config** | `GET /api/policy` | Deterministic risk tiers, endpoint mappings, and behavior thresholds (step-up: 70, deny: 90) |
| **12. Architecture** | Informative / Visual | Interactive diagram explaining The Three Locks: Vault, Bind, Burn |
| **13. Global Controls** | `GET /api/health`<br>`POST /api/demo/reset`<br>`POST /api/passes/{id}/revoke` | Health status indicator, live critical alert toasts, reset demo, kill switch confirm modals |

---

## Architectural Principles
1. **Zero Mock Data:** Every number, status, chart point, and row originates from the live backend API.
2. **Deterministic Rules:** No opaque ML models. Decisions are strictly governed by scope, canary tripwires, intent bounds, cumulative budgets, and behavior anomaly points.
3. **The Three Locks:**
   - **Vault:** AI models never see API keys.
   - **Bind:** Requests are cryptographically signed with private keys inside an isolated sidecar process.
   - **Burn:** Each ticket works exactly once. Even denied calls burn their ticket.
