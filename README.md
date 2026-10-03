# AgentPass

Continuous Identity & Runtime Security for AI Agents.

## Product boundary
Agent requests are evaluated outside the model. Protected tools execute only after authorization.

## Included
- Premium Next.js security console
- Deterministic Attack Center
- Task-scoped agent and pass views
- Proof/scope/intent/behavior/risk visualization
- Human approval boundary
- Causal trace and audit views
- Vault abstraction that never renders secret values
- Revocation and demo reset
- Local demo API routes under /app/api
- Optional connection to an existing AgentPass backend via NEXT_PUBLIC_AGENTPASS_API

## Run
npm install
npm run dev

## Optional backend
Set NEXT_PUBLIC_AGENTPASS_API to the origin of a compatible AgentPass API. Without it, the deterministic local demo routes are used.

This prototype does not claim real WebAuthn assertions, real banking, real Gmail, or production secret storage unless those integrations are actually configured.
