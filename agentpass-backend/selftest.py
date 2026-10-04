"""End-to-end self-test against the RUNNING gateway + sidecar (python run.py first).
Every check asserts on what the real servers answered."""
import json
import sys
import time

import httpx

from agentpass import config, vault

G = config.GATEWAY_URL
c = httpx.Client(timeout=30)
passed = failed = 0


def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}  {extra}")


def post(path, **kw):
    return c.post(G + path, **kw).json()


def get(path):
    return c.get(G + path).json()


def fresh():
    post("/api/demo/reset")
    r = post("/api/demo/bootstrap")
    assert r.get("ok"), r


def act(tool, action, params=None, rid=None):
    p = {"tool": tool, "action": action, "params": params or {}}
    if rid:
        p["request_id"] = rid
    return c.post(config.SIDECAR_URL + "/act", json=p).json()


def approve_pending(decision="approve"):
    a = get("/api/approvals?status=pending")["approvals"][0]
    r = c.post(G + f"/api/approvals/{a['id']}/decision",
               json={"decision": decision, "request_hash": a["request_hash"]})
    return r.status_code, r.json()


def steps(res):
    return [s["response"] for s in res["steps"]]


print("\n[1] Delegation: pass request -> human approval -> ticket #1")
post("/api/demo/reset")
r = post("/api/demo/request-pass")
st = get("/api/state")
check("pass request is waiting for the human", len(st["pending_pass_requests"]) == 1)
check("blast radius is computed", "can" in st["pending_pass_requests"][0]["blast_radius"])
check("sidecar has NO ticket before approval", st["sidecar"]["has_ticket"] is False)
post(f"/api/pass-requests/{r['request_id']}/approve")
time.sleep(2.5)
st = get("/api/state")
check("sidecar claimed ticket #1 after approval", st["sidecar"]["has_ticket"] and st["chain"]["next_seq"] == 1)
check("private key is not extractable / never in status", "d" not in st["sidecar"]["jwk"])

print("\n[2] Normal task + burn-after-use relay")
res = post("/api/agent/run/normal_task")
check("both normal actions ALLOWED", [s["decision"] for s in steps(res)] == ["ALLOW", "ALLOW"], steps(res))
st = get("/api/state")
burned = [t for t in st["tickets"] if t["status"] == "burned"]
check("two tickets burned, one active", len(burned) == 2 and sum(t["status"] == "active" for t in st["tickets"]) == 1)
check("chain advanced to seq 3", st["chain"]["next_seq"] == 3)

print("\n[3] Attacks (real HTTP requests to the gateway)")
a = post("/api/attack/stolen_ticket")
check("stolen ticket: both attempts blocked", a["all_blocked"], a)
check("stolen ticket: reasons KEY_MISMATCH + PROOF_SIGNATURE_INVALID",
      [x["reason"] for x in a["attempts"]] == ["KEY_MISMATCH", "PROOF_SIGNATURE_INVALID"], a["attempts"])
check("stolen ticket did NOT freeze the real chain", a["chain_state"] == "active")
check("real agent still works after theft attempt",
      act("files", "files:read", {"limit": 5})["decision"] == "ALLOW")
a = post("/api/attack/replay_captured")
check("replay blocked as PROOF_REPLAY", a["attempts"][0]["reason"] == "PROOF_REPLAY", a)
a = post("/api/attack/tamper_body")
check("tampered body blocked as BINDING_MISMATCH", a["attempts"][0]["reason"] == "BINDING_MISMATCH", a)
a = post("/api/attack/forged_ticket")
check("forged ticket blocked", a["attempts"][0]["reason"] == "TICKET_SIGNATURE_INVALID", a)
a = post("/api/attack/direct_tool")
check("direct tool access blocked (401) twice", a["all_blocked"] and len(a["attempts"]) == 2, a)

print("\n[4] Stale proof (signed by the real key, 60s old)")
cap = c.post(config.SIDECAR_URL + "/debug/intercept", json={
    "tool": "files", "action": "files:read", "iat_offset": -60}).json()
r = c.post(G + "/v1/call", content=cap["body"].encode(), headers=cap["headers"])
check("stale proof rejected", r.json()["reason"] == "PROOF_STALE", r.json())

print("\n[5] Prompt injection + taint")
fresh()
res = post("/api/agent/run/prompt_injection")
s = steps(res)
check("inbox read allowed", s[0]["decision"] == "ALLOW")
check("agent obeyed injection (2 attempts made)", len(s) == 3)
check("exfil email DENIED by intent", s[1]["decision"] == "DENY" and s[1]["reason"] == "INTENT_VIOLATION", s[1])
check("INR 50,000 payment DENIED by intent", s[2]["decision"] == "DENY" and s[2]["reason"] == "INTENT_VIOLATION", s[2])
w = get("/api/world")
check("no email reached the attacker", not any("evil.com" in m["to_addr"] for m in w["sent"]))
check("no money moved", len(w["payments"]) == 0)
check("chain is tainted", get("/api/state")["chain"]["tainted"] is True)

print("\n[6] Step-up: legitimate payment")
fresh()
post("/api/agent/run/read_inbox")
res = post("/api/agent/run/legit_payment")
r1 = steps(res)[0]
check("payment paused for human (202)", r1["decision"] == "STEP_UP" and r1["status"] == "pending_approval", r1)
check("payment NOT executed before approval", len(get("/api/world")["payments"]) == 0)
ap = get("/api/approvals?status=pending")["approvals"][0]
check("approval shows exact payee + amount", ap["params"]["payee"] == "acct_vendor_1" and ap["params"]["amount"] == 450)
bad = c.post(G + f"/api/approvals/{ap['id']}/decision", json={"decision": "approve", "request_hash": "wrong"})
check("approval with wrong action hash is refused", bad.status_code == 400)
code, body = approve_pending("approve")
check("human approval executes the payment", code == 200 and body["status"] == "approved", body)
check("payment appears in ledger (real data)", get("/api/world")["payments"][0]["amount"] == 450)
res = post("/api/agent/run/legit_payment")
check("second INR 450 payment blocked by cumulative budget (500)",
      steps(res)[0]["reason"] == "BUDGET_EXCEEDED", steps(res)[0])

print("\n[7] Human denies a step-up")
fresh()
post("/api/agent/run/legit_payment")
code, body = approve_pending("deny")
check("denied payment never executes", body["status"] == "denied" and len(get("/api/world")["payments"]) == 0)

print("\n[8] Behavior, scope, echo scrubber, budget")
fresh()
res = post("/api/agent/run/bulk_access")
check("bulk access -> STEP_UP (behavior)", steps(res)[0]["decision"] == "STEP_UP")
res = post("/api/agent/run/scope_violation")
check("files:delete -> SCOPE_DENIED", steps(res)[0]["reason"] == "SCOPE_DENIED")
fresh()
res = post("/api/agent/run/echo_leak")
dump = json.dumps(steps(res)[0]["result"])
real = vault.reveal("EMAIL_API_KEY", count=False)
check("tool echoed headers but REAL KEY IS NOT in the response", real not in dump and "[REDACTED]" in dump)
fresh()
res = post("/api/agent/run/budget_exhaustion")
d = [s["decision"] for s in steps(res)]
check("5 emails allowed, 6th denied by budget",
      d == ["ALLOW"] * 5 + ["DENY"] and steps(res)[5]["reason"] == "BUDGET_EXCEEDED", d)
check("exactly 5 emails really sent", len(get("/api/world")["sent"]) == 5)

print("\n[9] Idempotent retry (lost response)")
fresh()
act("email", "email:send", {"to": "a@company.com", "subject": "x", "body": "y"}, rid="rid_dupe")
r2 = act("email", "email:send", {"to": "a@company.com", "subject": "x", "body": "y"}, rid="rid_dupe")
check("same request_id executed exactly once", len(get("/api/world")["sent"]) == 1, r2)

print("\n[10] Key-holder anomaly: spent ticket reuse freezes the chain")
fresh()
post("/api/agent/run/normal_task")
a = post("/api/attack/reuse_spent_ticket")
check("spent ticket rejected as TICKET_ALREADY_USED",
      a["attempts"][0]["reason"] == "TICKET_ALREADY_USED", a)
check("chain frozen", a["chain_state"] == "frozen")
check("agent blocked while frozen", act("files", "files:read", {"limit": 5})["reason"] == "CHAIN_FROZEN")
cid = get("/api/state")["chain"]["id"]
post(f"/api/chains/{cid}/unfreeze")
check("after human re-approval the agent works again (auto-resync)",
      act("files", "files:read", {"limit": 5})["decision"] == "ALLOW")

print("\n[11] Canary tripwire + kill switch")
fresh()
res = post("/api/agent/run/canary_trip")
s = steps(res)
check("canary access DENIED (critical)", s[1]["reason"] == "CANARY_TRIPPED", s[1])
check("pass auto-revoked, next request refused", s[2]["reason"] == "PASS_REVOKED", s[2])
fresh()
pid = get("/api/state")["pass"]["id"]
post(f"/api/passes/{pid}/revoke")
check("kill switch: next call refused", act("files", "files:read", {"limit": 5})["reason"] == "PASS_REVOKED")

print("\n[12] Audit hash chain")
fresh()
post("/api/agent/run/normal_task")
check("audit chain valid", get("/api/audit/verify")["valid"])
t = post("/api/demo/tamper-audit")
check("tampering detected", t["verification"]["valid"] is False and t["verification"]["first_broken_id"] == t["tampered_record_id"], t)
check("no secrets in audit log", real not in json.dumps(get("/api/audit?limit=500")))

print("\n[13] Real data is exposed to the dashboard")
fresh()
post("/api/agent/run/normal_task")
st = get("/api/state")
m = st["metrics"]
check("metrics computed from audit log", m["total_requests"] == 2 and m["allowed"] == 2 and m["avg_latency_ms"] is not None, m)
check("vault lists names + fingerprints, never values",
      all("value" not in v and v["exposed_to_agent"] is False for v in st["vault"]) and any(v["uses"] > 0 for v in st["vault"]))
tr = get("/api/traces")["traces"]
check("traces listed", len(tr) >= 1)
check("trace graph returns nodes+edges", len(get("/api/trace/" + tr[0]["trace_id"])["nodes"]) >= 1)
ev = httpx.stream("GET", G + "/api/events", timeout=5)
with ev as resp:
    first = next(resp.iter_lines())
check("SSE stream delivers events", first.startswith("data:"))

print(f"\nRESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
