<div align="center">

# AgentPass
### Continuous Identity & Runtime Security for Autonomous AI Agents

> **“An AI agent can be compromised. Its authority shouldn't be.”**

[![Security: Zero-Trust Runtime](https://img.shields.io/badge/Security-Zero--Trust_Runtime-00f0ff?style=flat-square&logo=shield)](https://github.com/Sriram-J-CS/AgentPass-Secure-AI-Agent-Authorization)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_Python_3.11+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16_+_TypeScript-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Cryptography](https://img.shields.io/badge/Key--Bound-ES256_/_Burn--After--Use-7928CA?style=flat-square)](https://github.com/Sriram-J-CS/AgentPass-Secure-AI-Agent-Authorization)
[![Audit](https://img.shields.io/badge/Audit_Log-SHA--256_Hash_Chain-FF0080?style=flat-square)](https://github.com/Sriram-J-CS/AgentPass-Secure-AI-Agent-Authorization)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

<br/>

<img src="./assets/overview_dashboard.png" alt="AgentPass SOC Overview Dashboard" width="100%" style="border-radius: 12px; border: 1px solid #1e293b; box-shadow: 0 20px 50px rgba(0,0,0,0.8);" />
<p align="center"><em>AgentPass Real-Time Security Operations Center (SOC) Dashboard</em></p>

</div>

---

## 💡 Why AgentPass?

When developers connect an LLM or autonomous AI agent to tools, the standard practice today is to hand the agent an API key or bearer token. This creates a critical vulnerability:

> **If an AI agent ingests untrusted text containing a prompt injection, the attacker inherits every capability and permission associated with that API key.**

Traditional Identity and Access Management (IAM) governs human-to-service or service-to-service communication. It has no mechanism to treat an **AI agent as an untrusted, delegable execution principal**.

**AgentPass decouples agent execution from authority:**
1. **Never trust the model to decide its own authority:** The LLM is never the final decision-maker for executing actions.
2. **Short-lived, task-scoped passes:** Agents receive time-bound authority (e.g., 15 minutes to summarize invoices, maximum 50 file reads, 0 external emails, 0 money movement).
3. **Cryptographic proof-of-possession:** Private signing keys reside strictly in an isolated signer sidecar process outside the LLM context. Stolen tokens or leaked pass IDs cannot be used without the private key signature.
4. **Intent Firewall & Gateway Verification:** Every tool call is intercepted by an external gateway that verifies cryptographic signatures, replay nonces, scope boundaries, cumulative budgets, and task intent before any tool executes.
5. **Reversible Human Step-Up:** Sensitive actions (e.g., payments, file deletions) pause for human operator approval without aborting the agent's safe sub-tasks.

---

## 🔒 The Three Locks Architecture

AgentPass is built upon three foundational security guarantees:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE THREE-LOCK SECURITY MODEL                   │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│    LOCK 1: VAULT    │      LOCK 2: BIND        │     LOCK 3: BURN      │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ Real API keys never │ Every request is signed  │ Each ticket works once│
│ enter LLM prompts or│ by an isolated private   │ and burns immediately.│
│ memory. The gateway │ key held in a sidecar    │ Replay freezes the    │
│ brokers keys JIT.   │ process outside the AI.  │ cryptographic chain.  │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

```
[ Untrusted AI Agent ]
         │
         │ 1. Submits tool request ("send email", "pay vendor")
         ▼
[ Signer Sidecar (:8001) ] ── (Holds ES256 Private Key & Current One-Time Ticket)
         │
         │ 2. Assembles & signs cryptographic proof:
         │    (HTTP Method + URL + Nonce + Timestamp + SHA256(Body) + Ticket)
         ▼
[ AgentPass Gateway (:8000) ]
         │
         │ 3. Cryptographic Verification:
         │    - Ticket signature valid?
         │    - Key matches registered thumbprint?
         │    - Proof signature valid and fresh (<30s)?
         │    - Nonce never seen before?
         │    - Body hash matches payload?
         │    - ATOMIC BURN: Current ticket marked as burned
         │
         │ 4. Policy Engine Evaluation:
         │    - Scope Check (In allowed scopes?)
         │    - Canary Check (Touched tripwire file? -> Auto-revoke)
         │    - Intent Firewall (Payee/Domain within task limits?)
         │    - Budget Meter (Exceeded hourly/total quota?)
         │    - Behavioral Twin (Volume anomaly score?)
         │    - Context Taint (Ingested external content?)
         │
         ├─── 🟢 ALLOW ──────► [ Encrypted Vault ] ── Decrypts key JIT ──► [ Tool Executes ]
         │                                                                        │
         │                                                                        ▼
         │                                                            Scrub response & return
         │
         ├─── 🟡 STEP-UP ────► [ Human Approval ] ── Bound to request hash ──► Execute on approval
         │
         └─── 🔴 DENY ───────► Blocked (HTTP 403) + Security Reason Logged
         │
         ▼
[ Next Ticket Minted ] ── Delivered in response to Sidecar for next sequence
         │
         ▼
[ Hash-Chained Audit Log ] ── Real-time SSE Stream ──► [ SOC Dashboard ]
```

---

## 🏛️ System Components

The architecture separates responsibilities into four distinct trust boundaries:

| Component | Port | Trust Level | Responsibility |
|---|---|---|---|
| **Human Operator** | Web Browser | Root of Trust | Grants task-scoped passes, reviews step-up approvals, triggers emergency kill switch. |
| **Untrusted AI Agent** | Runtime | Untrusted | Generates execution plans and tool arguments. Never touches API keys or private signing keys. |
| **Signer Sidecar** | `8001` | Isolated Key Store | Holds agent's ES256 private key and current sequence ticket. Signs proofs; never exposes private keys. |
| **AgentPass Gateway** | `8000` | Policy Enforcement Point | Evaluates policy, burns tickets, enforces intent bounds, manages AES-256 vault, and writes hash-chained audit log. |

---

## 📸 Screen-by-Screen Walkthrough

### 1. Landing Page (`/landing`)
High-impact product introduction featuring the glowing 3D zero-trust architecture diagram, core value pillars (*Zero API keys in agent*, *100% Key-bound requests*, *Real-time risk enforcement*), and quick links to the security console.

<img src="./assets/landing_page.png" alt="AgentPass Landing Page" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 2. Login Portal (`/login`)
Secure workspace sign-in interface with show/hide password toggle and enterprise security assurances.

<img src="./assets/login_page.png" alt="AgentPass Login Portal" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 3. Main SOC Overview Dashboard (`/`)
Live operational center displaying:
- **Telemetry Counters:** Active Agents, Active Passes, Allowed Actions, Blocked Actions, Step-Up Requests, and Attacks Contained.
- **Latency Meters:** Average and P95 execution latency.
- **Decision Distribution:** Real-time Donut Chart tracking Allow vs Step-Up vs Deny percentages.
- **Risk Trend Chart:** Multi-layer area chart visualizing Low, Medium, and High severity incidents over time.
- **Live Event Feed:** Real-time Server-Sent Events (SSE) stream delivering verified actions, latency, severity badges, and decision chips.
- **Active Pass Card:** Shows remaining TTL countdown, granted scopes, and plain-language worst-case blast radius.
- **Emergency Kill Switch:** One-click revocation dialog that immediately invalidates active credentials.

<img src="./assets/overview_dashboard.png" alt="Main SOC Overview Dashboard" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 4. Agent Directory & Scenario Runner
Directory of registered agent identities and interactive scenario runner. Run real scenarios against the sidecar (`normal_task`, `prompt_injection`, `canary_trip`, `legit_payment`, `bulk_access`, `echo_leak`) to observe per-step latency, decision chips, parameter inspection, and direct links to causal trace graphs.

<img src="./assets/agent_runner.png" alt="Agent Directory and Scenario Runner" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 5. Attack Center & Simulation
Adversarial testing suite featuring 6 real attack vectors:
1. **Stolen Ticket:** Attacker extracts an unused ticket and attempts to sign with their own key. *(Blocked: KEY_MISMATCH)*
2. **Replay Captured Request:** Attacker re-sends wire bytes captured on the network. *(Blocked: PROOF_REPLAY)*
3. **Request Tampering:** Attacker intercepts a payment and modifies amount from ₹450 to ₹50,000. *(Blocked: BINDING_MISMATCH)*
4. **Forged Ticket:** Attacker mints and self-signs a ticket. *(Blocked: TICKET_SIGNATURE_INVALID)*
5. **Reuse Spent Ticket:** Attacker re-submits an already-burned ticket. *(Blocked: TICKET_ALREADY_USED + Chain Frozen)*
6. **Direct Tool Bypass:** Attacker attempts to call tools directly without going through AgentPass. *(Blocked: 401 INVALID_TOOL_KEY)*

Deep-dive view for simulated attacks showing:
- Scenario overview & malicious document excerpts.
- **Security Pipeline Verification Checklist:** Identity Verification, Proof-of-Possession, Scope Check, Intent Analysis, Behavior Check, and Risk Assessment.
- Raw HTTP response inspection and chain unfreeze action if frozen.

<img src="./assets/attack_center.png" alt="Attack Center" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 6. Human Step-Up Approval
Human-in-the-loop authorization card for sensitive operations:
- Displays exact tool, action, and request parameters (e.g., payee `acct_vendor_1`, amount `₹450`).
- Cryptographic SHA-256 request hash binding.
- Live seconds countdown timer (`seconds_left`).
- One-click Approve / Deny actions.

<img src="./assets/human_approvals.png" alt="Human Step-Up Approval" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 7. Causal Trace Graph
Interactive graph visualizer powered by Cytoscape.js:
- Trace selector for recent scenario runs.
- Directed node graph tracking request progression through policy checks to final verdict.
- Color-coded decision nodes with node inspector displaying timestamps, reasons, and evidence.

<img src="./assets/causal_trace.png" alt="Causal Trace Graph" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 8. Audit Ledger & Cryptographic Verification
Tamper-evident audit trail backed by SHA-256 hash chains:
- Sequenced log entries with previous hash, event hash, and signature validation.
- Interactive Tamper Demonstration verifying chain break detection in real time.

<img src="./assets/audit_ledger.png" alt="Audit Ledger" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 9. Key Vault
Encrypted credential management interface:
- Catalog of upstream API keys (Gmail, Stripe, Drive) encrypted with AES-256-GCM.
- Fingerprints (first 12 characters of SHA-256 hash), usage counters, and last used timestamps.
- **Zero-knowledge guarantee:** Secret values are never returned to the browser or agent runtime.

<img src="./assets/key_vault.png" alt="Key Vault" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 10. Ticket Relay & Chain State
Live sequence visualizer demonstrating The Three Locks in action:
- Visual representation of tickets in the relay chain: active, burned, and superseded.
- Instant replay detection and automatic chain freezing upon unauthorized ticket re-use.

<img src="./assets/ticket_relay.png" alt="Ticket Relay" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 11. System Architecture
Deep-dive architectural overview mapping the trust boundaries:
- Human Operator, Isolated Signer Sidecar, Untrusted Agent, and AgentPass Gateway.
- Detailed breakdown of Lock 1 (Vault), Lock 2 (Bind), and Lock 3 (Burn).

<img src="./assets/system_architecture.png" alt="System Architecture" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

### 12. World Data & Tool State
Live ledger of mock services updated exclusively by legitimate tool calls:
- **Inbox:** Emails table highlighting `[EXTERNAL - UNTRUSTED]` messages that trigger session taint.
- **Sent Emails:** Ledger of dispatched outbound messages.
- **Payments:** Ledger of executed financial transactions.
- **Filesystem:** File storage highlighting `[CANARY TRIPWIRE]` tripwire tokens.

<img src="./assets/world_data.png" alt="World Data" width="100%" style="border-radius: 8px; border: 1px solid #1e293b;" />

---

## 📁 Repository Structure

```
.
├── agentpass-backend/       # FastAPI gateway (:8000) & isolated signer sidecar (:8001)
│   ├── agentpass/          # Core policy, crypto, db, pipeline, audit, vault, attacks
│   ├── run.py              # Dual-process launcher
│   ├── selftest.py         # 53 end-to-end integration tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js 16 (App Router) + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── app/            # Routes: / (Dashboard), /landing, /login
│   │   ├── components/     # UI screens, Cytoscape graph, Recharts, navigation
│   │   ├── context/        # SSE event stream & live state provider
│   │   ├── lib/            # Typed API client
│   │   └── types/          # Strict TypeScript interfaces
│   └── README.md           # Screen-to-endpoint mapping table
├── assets/                 # UI dashboard screenshots & diagrams
└── MISSING_API.md          # Documentation of visual mockup fields vs backend API
```

---

## ⚡ Quick Start

### 1. Run the Backend
```bash
cd agentpass-backend
pip install -r requirements.txt
python run.py
```
- Gateway: `http://127.0.0.1:8000` (or `GATEWAY_PORT`)
- Signer Sidecar: `http://127.0.0.1:8001` (or `SIDECAR_PORT`)
- Interactive API Docs: `http://127.0.0.1:8000/docs`

To execute the 53 end-to-end integration tests:
```bash
python selftest.py
```

### 2. Run the Web Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the AgentPass security console.

---

## 🧪 Security Test Suite

The backend includes a comprehensive 53-step integration suite (`selftest.py`) validating:
- **Delegation:** Pass request -> Human approval -> Ticket #1 claim by sidecar.
- **Normal Task:** Safe tool calls allowed, tickets burned sequentially.
- **Attacks:** Stolen tickets, captured replays, body tampering, forged tickets, spent ticket reuse, and direct tool bypass all rejected.
- **Prompt Injection:** Intent firewall blocks exfiltration and unauthorized payouts; session taint flagged.
- **Step-Up:** Legitimate payments paused for human approval; request hash validated.
- **Canary Tripwires:** Sensitive file access denied critical; pass revoked automatically.
- **Audit Verification:** Hash-chained log verified; database row tampering detected.

---

## 📄 License

This project is licensed under the **MIT License**.
