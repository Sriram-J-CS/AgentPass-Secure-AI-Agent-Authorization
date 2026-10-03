# AgentPass

## Continuous Identity, Intent & Runtime Security for AI Agents

> **An AI agent can be compromised. Its authority shouldn't.**

**Core principle:** **Never trust the model to decide its own authority.**

AgentPass is a cybersecurity system that treats an AI agent as a managed security principal rather than as a trusted application process. The human authorizes a narrowly defined task; the agent receives short-lived, task-scoped authority; every action is evaluated outside the model; and a security gateway decides whether a protected tool/API call executes.

This document is the project's consolidated record: problem, threat model, three-lock security design, architecture, request flow, data model, APIs, runtime checks, attack scenarios, testing, implementation plan, demo flow, limitations, deployment history and roadmap.

---

## 1. Problem

AI agents can read email, access files, send messages, call APIs and perform sensitive business operations. The main security weakness appears when the agent receives a broad reusable credential.

### Main failure modes

**Prompt injection**  
A malicious email, document, web page or tool response can contain instructions that redirect the agent into an action that was never intended by the human.

**Bearer-token replay**  
A reusable bearer token often represents the authority itself. Whoever obtains it may reuse it until expiry.

**Secret exposure**  
Credentials can leak through prompts, memory, environment variables, tool output or logs.

**Over-broad permissions**  
An agent that only needs invoice-read access may accidentally have send, delete, export or payment privileges.

**Long replay windows**  
A stolen credential may be reused repeatedly instead of being limited to one action.

**Weak attribution**  
A conventional application log may show that a valid credential performed an operation without providing enough context to show exactly which task, identity and approval permitted it.

### Root cause

The design problem can be expressed as:

> **Trust is placed in a secret the agent can hold.**

AgentPass moves trust to an external authorization boundary.

---

## 2. Security Objective

AgentPass does not assume that an AI model is impossible to manipulate.

The threat model assumes the agent can be prompt-injected or partially compromised and asks:

> **Can that compromise automatically become unrestricted authority?**

The intended security boundary prevents the agent from exceeding the authority that was explicitly granted, when the relevant controls are active.

---

## 3. Design Goals

1. Least privilege by task.
2. Short-lived authority.
3. Explicit agent identity.
4. Cryptographic proof-of-possession.
5. Runtime enforcement outside the LLM.
6. Scope, budget and allowlist checks.
7. Intent-aware validation.
8. Behavioral anomaly context.
9. Human step-up for sensitive actions.
10. Revocation and kill switch.
11. Tamper-evident auditability.
12. Reliable deterministic attack demonstrations.
13. A polished security-console experience.

---

## 4. Non-Goals for the Hackathon MVP

The design is advanced, but the first implementation should stay understandable and demo-ready.

The MVP does not require:

- real banking transactions
- production Gmail/Outlook access
- production blockchain
- Kubernetes
- multi-region infrastructure
- a Kafka cluster
- a large ML training pipeline
- unpredictable LLM behavior for the critical attack sequence

Mock and deterministic tools are preferred for the live demo.

---

## 5. The Three Locks

### LOCK 1 — VAULT

**Real API keys never leave the gateway vault.**

The gateway stores service credentials encrypted. The agent, model and signer do not receive the real secret.

For an approved call:

1. the gateway validates the action
2. the broker reads the encrypted secret
3. the gateway decrypts it just in time
4. the credential is injected into the outbound request
5. the protected tool runs
6. secret material is cleared where practical
7. returned data is scrubbed before going back toward the agent

The agent therefore does not need to hold a reusable API key.

### LOCK 2 — BIND

**Every request is bound to the registered agent key.**

A signer sidecar owns an agent private key.

The pass is associated with the corresponding public-key identity.

Each request carries cryptographic proof signed by the private key.

A stolen authorization reference without the private key should fail verification.

### LOCK 3 — BURN

**Every authorization ticket is one-use.**

Tickets form a chain:

```
T1 -> request 1 -> burned -> T2
T2 -> request 2 -> burned -> T3
T3 -> request 3 -> burned -> T4
```

The gateway consumes ticket n exactly once and returns ticket n+1 after the action.

A used ticket is dead.

### Why all three?

- One-time use alone is not enough if an attacker uses the ticket before the legitimate agent.
- Key binding alone still leaves a replay problem for a reusable valid ticket.
- Vaulting alone does not stop misuse of an agent's own legitimate authority.
- Together they reduce the impact of credential theft, replay and secret exposure.

### Supporting controls

**Human step-up:** sensitive actions can require fresh approval tied to the exact action.

**Audit + kill switch:** decisions are recorded and authority can be revoked.

---

## 6. Glossary

| Term | Meaning |
|---|---|
| Pass | Human-approved authority record containing agent, task, scope, budget, expiry, risk policy and key binding. |
| Chain | Sequence of one-time tickets belonging to a pass. |
| Ticket | Short-lived, one-use authorization token. |
| Proof | Per-request signed proof binding request metadata to the agent key. |
| Sidecar | Separate signer process that protects the private key and current ticket. |
| Gateway | Security checkpoint that verifies, decides, burns tickets, brokers credentials and audits actions. |
| Issuer | Component that creates passes after human authorization. |
| Vault | Encrypted store for service credentials. |
| Broker | Gateway module that uses vaulted credentials for approved outbound calls. |
| Step-up | Fresh human approval for a sensitive action. |
| DPoP-style proof | Proof-of-possession pattern tying a request to a cryptographic key. |
| Nonce / JTI | Unique request identifier used to reduce replay. |
| Delegation | Controlled creation of a child agent/pass with equal-or-narrower authority. |
| Kill switch | Immediate authority revocation control. |

---

## 7. Actors and Trust Boundaries

### Human

Defines tasks, authorizes passes and can approve or deny sensitive actions.

### AI Agent / LLM

The model is **untrusted by design**.

It may plan an action, but it does not own the final authorization decision.

The agent should not receive:

- real API keys
- signer private keys
- unnecessary raw authorization tickets

### Signer Sidecar

The trusted signing boundary.

It keeps:

- private signing key
- current one-time ticket
- proof-generation logic

The interface exposed to the agent is local and intentionally narrow.

### Issuer

Creates task-scoped passes after human authorization.

### Gateway

The core security enforcement point.

It should be the only component that can reach the credential vault and protected tool network.

### Tools

Real or mock services that are reachable only through the protected path.

### Attacker

May poison documents, capture or replay authorization references, alter request parameters or attempt to redirect agent behavior.

The base threat model assumes the attacker does not possess the signer private key.

---

## 8. High-Level Architecture

```
HUMAN
  |
  | task + approval
  v
PASS ISSUER
  |
  | short-lived scoped pass
  v
AI AGENT
  |
  | requested action
  v
SIGNER SIDECAR
  |
  | signed proof + ticket
  v
AGENTPASS SECURITY GATEWAY
  |
  +--> identity / proof
  +--> nonce / replay
  +--> expiry / revocation
  +--> scope / permission
  +--> budget / allowlist
  +--> intent alignment
  +--> behavior
  +--> risk
  |
  +--> ALLOW
  +--> STEP-UP
  +--> DENY
  |
  +--> VAULT / BROKER
  |
  v
PROTECTED TOOL / API
  |
  +--> result + next ticket
  +--> audit event
  +--> dashboard update
```

The most important boundary is:

> **The LLM can request an action. The gateway decides whether the action executes.**

---

## 9. Agent Identity and Pass Issuance

Every managed agent receives a distinct identity.

A pass can contain:

- `pass_id`
- `agent_id`
- `human_owner_id`
- `task_id`
- `issued_at`
- `expires_at`
- `scopes`
- `budget`
- `risk_policy`
- `public_key_thumbprint` or key identifier
- `parent_agent_id` when delegated
- `status`: active / revoked / expired

### Example

Task:

> Summarize this week's invoices.

Scopes:

- `email.read:invoices`
- `file.read:invoice_pdf`

Not granted:

- send
- delete
- payment
- export
- credential changes

Reference expiry can be short, such as 15 minutes.

---

## 10. Proof-of-Possession

At startup or pass issuance:

1. signer creates a key pair
2. private key remains outside the LLM
3. public key is registered
4. public key is bound to the pass
5. each action is signed

A proof should bind:

- HTTP method / action
- target URL / tool
- canonical request body hash
- timestamp
- nonce
- pass reference
- agent key identifier

### Gateway verification

The gateway checks:

1. signature validity
2. key-to-pass binding
3. timestamp window
4. nonce uniqueness
5. request-body hash
6. pass status
7. expiry
8. revocation

### Security effect

A stolen pass alone should not be sufficient when proof-of-possession is enforced.

---

## 11. Permission and Scope Engine

Permissions are explicit and default to deny.

Examples:

- `email.read:invoices`
- `file.read:invoice_pdf`
- `email.send:approved_recipients`
- `payment.create:max=500`
- `file.write:reports`

Policies can additionally specify:

- allowed resources
- recipients
- destinations
- rate limits
- count limits
- amount limits
- expiry
- sensitivity

### Example

Parent:

`payment.create:max=500`

Child:

must not become

`payment.create:max=1000`

Authority can stay the same or become narrower.

---

## 12. Delegation and Sub-Agents

Example:

```
Human
  |
  v
FinanceAgent
  |
  v
InvoiceReader
```

Parent authority:

- read invoices
- create summary

Child authority:

- read invoices

Rule:

```
child_scopes = intersection(parent_scopes, requested_child_scopes)
```

A child must never gain authority that was not available to its parent.

If the parent is revoked, dependent child passes should be invalidated.

---

## 13. Runtime Gateway Pipeline

Every protected tool call passes through one security boundary.

### Order

1. Parse request.
2. Identify pass and agent.
3. Verify proof.
4. Check nonce/replay.
5. Check expiry and revocation.
6. Check scope.
7. Check budget.
8. Check intent.
9. Check behavioral context.
10. Calculate risk.
11. Return ALLOW, STEP-UP or DENY.
12. Execute the tool only after authorization.
13. Record the security event.

### Fail-closed invariant

> **No protected tool executes unless the gateway has returned ALLOW or a valid STEP-UP approval.**

---

## 14. Intent Firewall

Scope asks:

> “Can this agent perform this type of action?”

Intent asks:

> “Is this action consistent with the task the human actually authorized?”

The intent model may contain:

- task description
- allowed action types
- allowed resources
- allowed recipients
- allowed destinations
- numeric limits
- sensitivity level

### Example

Human task:

> Summarize invoices.

Agent requests:

```
SEND_EMAIL
recipient = attacker@example.com
```

Possible decision:

- scope mismatch
- destination mismatch
- intent mismatch
- high risk

Result:

**DENY**

The important point is that the decision is enforced outside the model.

---

## 15. Behavioral Trust

AgentPass can establish a behavioral baseline from observations such as:

- tool-call frequency
- action sequence
- destination patterns
- file volume
- payment behavior
- recipient frequency
- unusual bursts

### Example

Normal:

- a few invoice reads
- one summary update

Observed:

- hundreds of file reads
- new external destination
- unexpected payment sequence

The behavioral signal can raise risk and move the action toward STEP-UP or DENY.

Behavioral analysis adds context; it does not replace deterministic authorization.

---

## 16. Risk Engine

The conceptual signal path is:

```
Identity
   ->
Scope
   ->
Intent
   ->
Behavior
   ->
Taint / Context
   ->
Risk
   ->
ALLOW / STEP-UP / DENY
```

The demo risk engine should remain deterministic and explainable.

### Low-risk example

- valid identity
- valid proof
- active pass
- in-scope read
- normal behavior

Decision:

**ALLOW**

### Sensitive action

- valid identity
- action within policy
- sensitive payment

Decision:

**STEP-UP**

### Critical violation

- invalid proof
- replayed ticket
- body tampering
- expired/revoked pass
- clear scope/intent mismatch

Decision:

**DENY**

---

## 17. Ticket Chain and Replay Protection

Suppose the current ticket is T1.

The legitimate flow is:

```
T1 -> action -> burn T1 -> issue T2
T2 -> action -> burn T2 -> issue T3
```

The gateway should atomically consume the current ticket so that concurrent consumers cannot both spend it.

The reference design can use an atomic compare-and-set mechanism such as Redis Lua.

### Reliability issue

A one-time ticket creates a response-loss problem.

Solution:

- use a stable `request_id`
- cache the outcome for idempotent retries
- do not execute the same request twice
- provide a resync path for lost ticket state

---

## 18. Vault and Broker Flow

```
Encrypted service secret
        |
        v
Gateway vault
        |
 approved action
        v
Decrypt just in time
        |
        v
Broker injects credential
        |
        v
Protected tool/API
        |
        v
Scrub returned data
```

The production-oriented design uses AES-256-GCM for secret encryption, with a master key sourced from an environment secret or KMS.

The system must not log raw credentials.

---

## 19. Human Step-Up

Sensitive actions should not automatically execute simply because the agent is correctly authenticated.

Example:

```
Agent -> PAYMENT ₹50,000
       -> Gateway
       -> STEP-UP
       -> Human reviews exact action
       -> APPROVE / DENY
```

The reference design uses WebAuthn/passkeys for high-risk human confirmation.

The approval is tied to the exact operation rather than a general permanent trust decision.

---

## 20. Revocation / Kill Switch

Authority must be revocable.

The operator should be able to revoke:

- an agent
- a pass
- parent authority
- dependent child authority

After revocation:

```
new request -> gateway -> REVOKED -> DENY
```

A kill switch is useful when suspicious behavior, prompt injection or credential exposure is detected.

---

## 21. Audit Trail

Every important decision should create an attributable event.

Useful fields:

- event ID
- request ID
- pass ID
- agent ID
- action
- resource
- timestamp
- decision
- risk
- reason codes
- proof result
- scope result
- intent result
- behavior result
- approval result

### Hash chain

```
H0 = initial value

H1 = SHA256(event1 || H0)
H2 = SHA256(event2 || H1)
H3 = SHA256(event3 || H2)
...
```

If an old event changes, subsequent hashes no longer match.

---

## 22. Attack Scenarios

### Normal Task

```
READ_EMAIL
resource = invoices
```

Checks pass.

Result:

**ALLOW**

### Prompt Injection

Poisoned invoice tries to cause:

```
SEND_EMAIL -> attacker@example.com
```

Gateway detects task/destination mismatch.

Result:

**DENY**

### Stolen Pass Replay

Attacker possesses a captured authorization reference but lacks the private signing key.

Result:

**DENY**

Typical reason:

```
INVALID_SIGNATURE
```

### Reused Ticket

Previously spent ticket is presented again.

Result:

**DENY**

Reason:

```
REPLAY_DETECTED
```

### Request Tampering

Signed:

```
amount = 500
payee = Arun
```

Modified:

```
amount = 50000
payee = Unknown
```

The body hash no longer matches.

Result:

**DENY**

### High-Risk Payment

Valid request but sensitive amount/action.

Result:

**STEP-UP**

Human reviews the exact transaction.

### Behavioral Anomaly

Request sequence and volume depart from the baseline.

Result:

**STEP-UP** or **DENY**, depending on policy.

### Revoke Agent

Operator triggers the kill switch.

Result:

- authority revoked
- new requests denied
- dependent child authority invalidated where applicable

---

## 23. Reason Codes

Recommended machine-readable values:

```
INVALID_SIGNATURE
MISSING_PROOF
REPLAY_DETECTED
EXPIRED_PASS
REVOKED_PASS
SCOPE_MISMATCH
BUDGET_EXCEEDED
INTENT_MISMATCH
BEHAVIOR_ANOMALY
HIGH_RISK_STEP_UP
HUMAN_APPROVAL_REQUIRED
HUMAN_APPROVAL_DENIED
INVALID_DELEGATION
AUDIT_INTEGRITY_FAILURE
```

Additional implementations can add a request-body-hash mismatch reason when required.

---

## 24. Reference Services

### Signer Sidecar

Responsibilities:

- generate ECDSA P-256 key pair
- protect private key
- register public key
- hold current ticket
- build canonical proof
- sign requests
- submit to gateway
- replace ticket with next ticket
- retry with request ID
- resync ticket state

Conceptual local API:

```
POST /act
{
  "tool": "invoice_reader",
  "action": "READ_EMAIL",
  "params": {
    "mailbox": "invoices"
  }
}
```

The agent sees the result, not the private key.

### Issuer

Responsibilities:

- human authentication
- pass creation
- task/scopes/budget/TTL
- public-key registration
- initial ticket issuance
- approval context

### Gateway

Reference endpoints:

```
POST /v1/call
POST /v1/resync
GET  /v1/approvals/:id
POST /v1/approvals/:id/decision
POST /v1/passes/:id/revoke
POST /internal/chains
```

Gateway modules:

- ticket service
- proof verifier
- nonce store
- policy engine
- budget evaluator
- intent engine
- behavior engine
- risk engine
- burn service
- approval service
- vault
- broker
- scrubber
- audit service
- realtime event stream

---

## 25. Database Model

### User

```
user_id
name
email
authentication_method
status
created_at
```

### Agent

```
agent_id
name
owner_id
public_key_id
status
created_at
last_seen
baseline_id
```

### Pass

```
pass_id
agent_id
owner_id
task_id
scopes
budget
risk_policy
issued_at
expires_at
key_thumbprint
parent_agent_id
status
```

### Ticket Chain

```
chain_id
pass_id
current_ticket_hash
next_ticket_number
status
created_at
expires_at
```

### Approval

```
approval_id
request_id
pass_id
action
risk
context
status
approved_by
created_at
resolved_at
```

### Audit Event

```
event_id
request_id
pass_id
agent_id
action
decision
risk
reason_codes
previous_hash
event_hash
timestamp
```

---

## 26. API Example

Conceptual request:

```http
POST /v1/call
Authorization: AgentPass <ticket>
DPoP: <signed-proof>
Content-Type: application/json

{
  "request_id": "req_123",
  "tool": "invoice_reader",
  "action": "READ_EMAIL",
  "params": {
    "mailbox": "invoices"
  }
}
```

### ALLOW

```json
{
  "decision": "ALLOW",
  "result": {
    "count": 4
  },
  "next_ticket": "<one-time-ticket-2>"
}
```

### DENY

```json
{
  "decision": "DENY",
  "reason_codes": [
    "INTENT_MISMATCH",
    "SCOPE_MISMATCH"
  ]
}
```

### STEP-UP

```json
{
  "decision": "STEP_UP",
  "approval_id": "appr_123",
  "reason_codes": [
    "HIGH_RISK_STEP_UP",
    "HUMAN_APPROVAL_REQUIRED"
  ]
}
```

---

## 27. Reference Tech Stack

### Security

- Web Crypto API
- ECDSA P-256
- DPoP-style proof-of-possession
- request-body SHA-256 binding
- nonce / JTI replay protection
- AES-256-GCM secret encryption
- SHA-256 audit chaining
- WebAuthn / passkeys

### Backend reference

- Python 3.11+ / FastAPI or Node/TypeScript services
- typed request validation
- SQLite for local demo
- PostgreSQL for production

### Frontend reference

- React
- TypeScript
- Tailwind CSS
- graph visualization with Cytoscape.js
- optional motion / visual libraries

### Realtime

- WebSockets or SSE

### Infrastructure

- Render or Vercel for compatible web deployments
- environment variables for secrets
- separate signer process where practical

Do not add infrastructure only for appearance.

---

## 28. Dashboard Design

The reference console includes:

### Overview

- security status
- agent/pass context
- recent requests
- ALLOW / STEP-UP / DENY decisions
- risk information

### Agents

- agent identity
- owner
- task
- pass
- scope
- budget
- status
- revoke action

### Passes

- pass ID
- task
- expiry
- scope
- key binding
- chain state

### Attack Center

One-click scenarios:

- Normal Task
- Prompt Injection
- Stolen Pass Replay
- Request Tampering
- High-Risk Payment
- Behavioral Anomaly
- Revoke Agent

### Requests

Request feed and detailed event inspection.

### Approvals

Pending sensitive actions and human decision controls.

### Causal Trace

```
Identity
 -> Proof
 -> Scope
 -> Intent
 -> Behavior
 -> Risk
 -> Decision
```

### Audit

Historical actions and hash-chain information.

### Vault

Only redacted credential metadata.

Never render raw secrets.

### Architecture / Data Flow

Visualizes the security path and trust boundaries.

### Settings

Security configuration and demo controls.

---

## 29. UI Language

The console should make security state immediately understandable.

Suggested semantic colors:

- green = ALLOW / healthy
- amber = STEP-UP / attention
- red = DENY / revoked
- blue = system / neutral action

Design direction:

- near-black / navy base
- thin borders
- restrained glow
- compact data cards
- monospace identifiers
- clear information hierarchy
- subtle animation
- responsive layouts

Do not use visual effects that hide important security information.

---

## 30. Deterministic Demo Strategy

The core demo should not depend on a live LLM behaving exactly the same way every time.

Preferred strategy:

1. deterministic scripted agent mode
2. optional real LLM mode as an extension
3. all tool calls routed through the same gateway
4. local/mock tools
5. reproducible attack scenarios
6. reset before each judge demonstration

The key demonstration is the security boundary, not a particular model output.

---

## 31. Implementation Phases

### Phase 1 — Skeleton

- frontend
- backend
- mock email/file/payment tools
- database

### Phase 2 — Pass System

- agent model
- pass issuance
- expiry
- scopes
- revocation

### Phase 3 — Gateway

- action endpoint
- default deny
- in-scope read allow
- out-of-scope block

### Phase 4 — Proof-of-Possession

- key pair
- public-key registration
- signing
- verification
- nonce
- body hash

### Phase 5 — Intent Firewall

- structured task
- requested-action comparison
- reason codes

### Phase 6 — Risk and Step-Up

- deterministic risk rules
- pending approval
- approve / deny UI

### Phase 7 — Audit

- hash chain
- event viewer
- event details

### Phase 8 — Behavior Twin

- baseline
- abnormal sequence detection
- abnormal volume
- behavior score

### Phase 9 — Graph and Polish

- delegation graph
- causal trace
- attack center
- animations
- responsive console

### Phase 10 — Demo Hardening

- predictable demo state
- one-click scenarios
- reset
- repeated attack tests
- remove unnecessary dependencies

---

## 32. Testing Requirements

At minimum:

1. valid in-scope request -> ALLOW
2. out-of-scope request -> DENY
3. expired pass -> DENY
4. revoked pass -> DENY
5. invalid signature -> DENY
6. missing proof -> DENY
7. reused nonce -> DENY
8. modified body -> DENY
9. high-risk payment -> STEP-UP
10. approved step-up -> execute
11. denied step-up -> no execution
12. child scope cannot exceed parent
13. parent revocation invalidates child
14. audit chain verifies
15. tampered audit event breaks verification
16. replayed ticket is denied
17. duplicate request ID is idempotent

### Security invariant

> **No protected tool executes unless the gateway has returned ALLOW or a valid STEP-UP approval.**

---

## 33. Demo Walkthrough

### Step 1 — Normal request

Show:

```
Agent: FinanceBot
Task: invoice summarization
Action: READ_EMAIL
Decision: ALLOW
```

### Step 2 — Prompt injection

Poisoned document attempts:

```
SEND_EMAIL -> external attacker
```

Show:

```
DENY
INTENT_MISMATCH / SCOPE_MISMATCH
```

### Step 3 — Stolen pass

Show a captured authorization reference without the private signing key.

Show:

```
DENY
INVALID_SIGNATURE
```

### Step 4 — Replay

Reuse a consumed ticket.

Show:

```
DENY
REPLAY_DETECTED
```

### Step 5 — Tampering

Change signed payment parameters.

Show:

```
DENY
body hash mismatch
```

### Step 6 — Step-up

Trigger a legitimate but sensitive payment.

Show:

```
STEP-UP
```

Human approves or denies the exact action.

### Step 7 — Audit

Open the event and show:

```
request
 -> proof
 -> policy
 -> intent
 -> behavior
 -> risk
 -> decision
```

### Step 8 — Kill switch

Revoke the agent.

Show that new requests are rejected.

---

## 34. Current Repository State

This repository has been deliberately reset to a **documentation-only** state.

The final repository should contain only:

```
README.md
```

The application source, build files and deployment configuration are intentionally removed from the GitHub repository so the README remains the single project record.

---

## 35. Deployment Cleanup Notes

A prototype deployment was previously created on Render at:

```
https://agentpass.onrender.com
```

The deployment was successfully built from the project before this repository reset.

The Vercel configuration file has been removed from this repository.

### Important provider distinction

Deleting source files from GitHub is different from deleting a hosting service.

Removing the repository files does not, by itself, guarantee that an existing Render/Vercel project, deployment history or public URL has been deleted at the provider.

Provider-side deletion must be completed through the provider's dashboard/API when the connected account exposes that operation.

---

## 36. Current Security Claims

Do not claim:

- first ever
- nobody else has this
- impossible to hack
- 100% secure
- eliminates prompt injection

Appropriate claims:

- agent is treated as a distinct security principal
- authority is task-scoped and short-lived
- pass possession is not enough when key-bound proof is enforced
- protected actions are enforced outside the model
- intent and behavior add contextual signals
- sensitive actions can require fresh human approval
- actions are attributable and auditable
- delegation can preserve or narrow authority

---

## 37. Known Limitations

### Compromised signer host

If the trusted signer environment is compromised, the attacker may obtain the ability to make valid signatures.

Future protection:

- hardware-backed keys
- stronger sidecar isolation
- sandboxing
- tighter scope and step-up rules

### Harmful in-scope action

A compromised agent may still perform an action that is genuinely:

- correctly signed
- in scope
- within budget
- consistent with the task

AgentPass does not claim that all legitimate authority is inherently safe.

### Prototype vs production

Some reference components can be simplified for a hackathon.

The implementation must not claim production-grade WebAuthn, KMS, cryptographic enforcement, authentication or integrations unless those pieces are actually deployed.

---

## 38. Relationship to Identity Continuity Mesh

AgentPass originated from the team's earlier Identity Continuity Mesh direction.

The strongest reused concepts are:

- proof-of-possession / key binding
- continuing identity context
- scoped reversible step-up

AgentPass extends those for an AI-agent threat model through:

- key vaulting
- burn-after-use ticket chains
- agent-specific task authority
- runtime intent and behavior
- delegation controls
- action-bound human approval
- gateway-side authorization
- auditability

---

## 39. Why the LLM Is Not the Security Boundary

The separation is intentional.

### LLM

Can:

- reason
- plan
- choose candidate tools

Should not:

- hold service credentials
- own the final authorization decision
- control private signing keys
- bypass policy

### Sidecar

Provides:

- key custody
- signing
- ticket handling

### Gateway

Provides:

- authentication proof verification
- scope enforcement
- intent checks
- behavior context
- risk decision
- vault/broker
- replay protection
- audit
- revocation

### Human

Provides:

- authority definition
- approval
- escalation
- revocation

---

## 40. Production Roadmap

### Near term

- restore a complete backend
- real authentication
- real WebAuthn
- cryptographic proof verification
- transactional ticket burning
- encrypted credential broker
- PostgreSQL persistence
- automated gateway tests
- end-to-end attack tests

### Medium term

- hardware-backed signing keys
- hardened signer isolation
- SIEM integration
- policy-as-code
- richer event streaming
- stronger delegation lifecycle
- better tenant isolation

### Long term

- cross-agent trust graphs
- agent supply-chain identity
- formal verification of selected gateway invariants
- secure hardware-backed runtime identities
- stronger behavioral models
- adaptive risk policies with human oversight

---

## 41. Judge Questions

### What if an attacker steals the ticket?

Without the private key, the attacker cannot create the required key-bound proof in the base model. If the ticket was already spent, burn-after-use also prevents reuse.

### Why burn if the ticket is key-bound?

Binding reduces stolen-token use. Burning removes replay of a valid ticket and limits each authorization object to one action.

### Where is the API key?

Inside the gateway's encrypted vault in the intended architecture.

### What if the malicious agent uses its legitimate permissions?

That is a known boundary. Scope, budget, allowlists, intent, behavior and step-up reduce the damage surface but do not make every permitted action safe.

### What about OAuth or DPoP?

Proof-of-possession is a foundation. AgentPass adds one-time ticket chains, a gateway credential broker, task-scoped agent authority, request-body binding, intent/behavior signals and action-bound human approval.

### What if the network drops the response?

Use request IDs and idempotency so the same request does not execute twice. Provide resync for ticket-chain recovery.

### What if the signer host is compromised?

That is a remaining trust boundary and is a roadmap target for hardware-backed keys and stronger isolation.

### Why not only detect prompt injection?

Prompt detection can help, but the final action authorization must still be enforced outside the model.

---

## 42. Final Summary

AgentPass is a runtime security and authorization layer for AI agents.

The human defines a narrow task.

The issuer creates a short-lived pass.

The pass is bound to an agent cryptographic identity.

The agent asks for an action through a protected signer.

The gateway verifies:

```
Identity
  ->
Proof
  ->
Replay
  ->
Expiry / Revocation
  ->
Scope
  ->
Budget
  ->
Intent
  ->
Behavior
  ->
Risk
```

Then:

```
ALLOW
STEP-UP
DENY
```

Only approved actions reach the protected tool.

The real service credentials remain behind the gateway vault/broker boundary.

Every important decision can be recorded in a tamper-evident audit chain.

### Project principle

> **Trust the key, not the token.**

### Closing line

> **AgentPass does not assume the AI will always behave correctly. It ensures the AI cannot automatically act beyond the authority it was given.**
