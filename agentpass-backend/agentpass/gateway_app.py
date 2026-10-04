"""AgentPass gateway: protected /v1 API + dashboard /api + mock tools. Run via run.py."""
import asyncio
import json
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import (agent, attacks, audit, config, crypto, db, passes, pipeline, policy, tools, vault,
               world)

START = time.time()
_http = httpx.AsyncClient(timeout=5.0)


@asynccontextmanager
async def lifespan(app):
    db.conn()
    crypto.gateway_key()
    vault.seed()
    if not db.one("SELECT id FROM emails LIMIT 1"):
        world.seed()
    yield


app = FastAPI(title="AgentPass Gateway", version="1.0",
              description="Key-bound, burn-after-use authorization for AI agents.",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
                   allow_headers=["*"])
app.include_router(tools.router)


def err(status, message):
    return JSONResponse({"error": message}, status_code=status)


# =====================================================================
# Protected API (used by the signer sidecar)
# =====================================================================
@app.post("/v1/call", tags=["protected"])
async def v1_call(request: Request):
    return await pipeline.handle_call("POST", request.url.path, await request.body(),
                                      request.headers.get("authorization", ""),
                                      request.headers.get("x-agentpass-proof", ""))


@app.post("/v1/resync", tags=["protected"])
async def v1_resync(request: Request):
    status, body = passes.resync(await request.body(), request.headers.get("x-agentpass-proof", ""),
                                 request.url.path)
    return JSONResponse(body, status_code=status)


@app.post("/api/passes/request", tags=["passes"])
async def pass_request(request: Request):
    try:
        return passes.create_request(await request.json())
    except Exception as e:
        return err(400, f"invalid pass request: {e}")


@app.get("/api/passes/requests/{rid}/ticket", tags=["passes"])
async def pass_claim(rid: str, request: Request):
    status, body = passes.claim_ticket(rid, request.headers.get("x-agentpass-proof", ""),
                                       request.url.path)
    return JSONResponse(body, status_code=status)


# =====================================================================
# Dashboard API
# =====================================================================
@app.get("/api/health", tags=["dashboard"])
async def health():
    return {"ok": True, "uptime_seconds": int(time.time() - START), "time": db.iso(time.time())}


async def sidecar_status():
    try:
        r = await _http.get(f"{config.SIDECAR_URL}/status", timeout=1.5)
        return {"reachable": True, **r.json()}
    except Exception:
        return {"reachable": False}


def _metrics():
    calls = db.q("SELECT decision, reason, detail FROM audit WHERE event_type IN "
                 "('CALL_ALLOWED','CALL_DENIED','CALL_PENDING_APPROVAL')")
    by_decision, by_reason, lat = {"ALLOW": 0, "DENY": 0, "STEP_UP": 0}, {}, []
    for c in calls:
        by_decision[c["decision"]] = by_decision.get(c["decision"], 0) + 1
        if c["decision"] == "DENY":
            by_reason[c["reason"]] = by_reason.get(c["reason"], 0) + 1
        v = db.jload(c["detail"], {}).get("latency_ms")
        if v is not None:
            lat.append(v)
    lat.sort()
    alerts = db.one("SELECT COUNT(*) n FROM audit WHERE severity IN ('high','critical')")["n"]
    return {"total_requests": len(calls), "allowed": by_decision.get("ALLOW", 0),
            "denied": by_decision.get("DENY", 0), "step_up": by_decision.get("STEP_UP", 0),
            "alerts": alerts, "deny_reasons": by_reason,
            "avg_latency_ms": round(sum(lat) / len(lat), 2) if lat else None,
            "p95_latency_ms": lat[int(len(lat) * 0.95) - 1] if len(lat) >= 2 else (lat[0] if lat else None)}


@app.get("/api/state", tags=["dashboard"])
async def state():
    p, chain = passes.current()
    tickets = []
    if chain:
        for t in db.q("SELECT * FROM tickets WHERE chain_id=? ORDER BY seq DESC, issued_at DESC LIMIT 40",
                      (chain["id"],)):
            tickets.append({"seq": t["seq"], "id": t["tid"], "status": t["status"],
                            "issued": db.iso(t["issued_at"]), "burned": db.iso(t["burned_at"]),
                            "outcome": t["outcome"], "summary": t["summary"]})
    behavior = None
    if p:
        score, breakdown = policy.behavior(p["id"], "-", {})
        behavior = {"score": score, "breakdown": breakdown,
                    "step_up_at": config.STEP_UP_SCORE, "deny_at": config.DENY_SCORE}
    pv = passes.pass_view(p)
    pending_reqs = [passes.request_view(r) for r in
                    db.q("SELECT * FROM pass_requests WHERE status='pending' ORDER BY created_at DESC")]
    approvals = [pipeline.approval_view(r) for r in
                 db.q("SELECT * FROM approvals WHERE status='pending' ORDER BY created_at DESC")]
    return {
        "server_time": db.iso(time.time()),
        "sidecar": await sidecar_status(),
        "pass": pv,
        "chain": ({"id": chain["id"], "state": chain["state"], "next_seq": chain["expected_seq"],
                   "tainted": bool(chain["tainted"]), "taint_reason": chain["taint_reason"]}
                  if chain else None),
        "tickets": tickets,
        "budgets": policy.budget_usage(p["id"], db.jload(p["budget"], {})) if p else {},
        "behavior": behavior,
        "metrics": _metrics(),
        "pending_pass_requests": pending_reqs,
        "pending_approvals": approvals,
        "vault": vault.summary(),
        "audit": audit.verify(),
    }


@app.get("/api/events", tags=["dashboard"])
async def events(request: Request):
    q = audit.bus.subscribe()

    async def stream():
        try:
            for rec in reversed(audit.recent(25)):
                yield f"data: {json.dumps({'kind': 'audit', 'record': rec, 'backlog': True})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(q.get(), timeout=10)
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            audit.bus.unsubscribe(q)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/audit", tags=["dashboard"])
async def audit_list(limit: int = 100, before_id: int = None, alerts_only: bool = False):
    return {"records": audit.recent(min(limit, 500), before_id,
                                    ["high", "critical"] if alerts_only else None)}


@app.get("/api/audit/verify", tags=["dashboard"])
async def audit_verify():
    return audit.verify()


@app.get("/api/traces", tags=["dashboard"])
async def traces():
    rows = db.q("SELECT trace_id, COUNT(*) n, MIN(ts) first_ts, MAX(ts) last_ts, "
                "SUM(CASE WHEN severity IN ('high','critical') THEN 1 ELSE 0 END) alerts "
                "FROM audit WHERE trace_id IS NOT NULL GROUP BY trace_id ORDER BY first_ts DESC LIMIT 40")
    out = []
    for r in rows:
        first = db.one("SELECT action, tool, event_type FROM audit WHERE trace_id=? ORDER BY id LIMIT 1",
                       (r["trace_id"],))
        out.append({"trace_id": r["trace_id"], "events": r["n"], "alerts": r["alerts"],
                    "started": db.iso(r["first_ts"]), "first_action": first["action"] or first["event_type"]})
    return {"traces": out}


@app.get("/api/trace/{trace_id}", tags=["dashboard"])
async def trace(trace_id: str):
    rows = db.q("SELECT * FROM audit WHERE trace_id=? ORDER BY id", (trace_id,))
    nodes = []
    for r in rows:
        d = db.jload(r["detail"], {})
        nodes.append({"id": r["id"], "event_type": r["event_type"], "decision": r["decision"],
                      "reason": r["reason"], "severity": r["severity"], "tool": r["tool"],
                      "action": r["action"], "time": db.iso(r["ts"]), "alert": d.get("alert"),
                      "explanation": d.get("why") or d.get("result_summary") or d.get("taint") or "",
                      "label": f"{r['action'] or r['event_type']} -> {r['decision']} ({r['reason']})"})
    edges = [{"source": nodes[i]["id"], "target": nodes[i + 1]["id"]} for i in range(len(nodes) - 1)]
    return {"trace_id": trace_id, "nodes": nodes, "edges": edges}


@app.get("/api/world", tags=["dashboard"])
async def world_view():
    return world.snapshot()


@app.get("/api/vault", tags=["dashboard"])
async def vault_view():
    return {"secrets": vault.summary(),
            "note": "Values are never returned. They are decrypted only inside the gateway "
                    "for the instant a tool call is made."}


@app.get("/api/policy", tags=["dashboard"])
async def policy_view():
    return {**policy.POLICY, "default_pass_request": policy.DEFAULT_REQUEST}


@app.get("/api/approvals", tags=["dashboard"])
async def approvals(status: str = None):
    rows = (db.q("SELECT * FROM approvals WHERE status=? ORDER BY created_at DESC", (status,))
            if status else db.q("SELECT * FROM approvals ORDER BY created_at DESC LIMIT 50"))
    return {"approvals": [pipeline.approval_view(r) for r in rows]}


@app.post("/api/approvals/{aid}/decision", tags=["dashboard"])
async def approval_decision(aid: str, request: Request):
    b = await request.json()
    if b.get("decision") not in ("approve", "deny"):
        return err(400, "decision must be 'approve' or 'deny'")
    status, body = await pipeline.decide_approval(aid, b["decision"], b.get("request_hash", ""))
    return JSONResponse(body, status_code=status)


@app.get("/api/pass-requests", tags=["dashboard"])
async def pass_requests():
    return {"requests": [passes.request_view(r) for r in
                         db.q("SELECT * FROM pass_requests ORDER BY created_at DESC LIMIT 20")]}


@app.post("/api/pass-requests/{rid}/approve", tags=["dashboard"])
async def pass_approve(rid: str):
    try:
        return passes.approve_request(rid)
    except LookupError as e:
        return err(404, str(e))
    except ValueError as e:
        return err(409, str(e))


@app.post("/api/pass-requests/{rid}/reject", tags=["dashboard"])
async def pass_reject(rid: str):
    try:
        passes.reject_request(rid)
        return {"ok": True}
    except LookupError as e:
        return err(404, str(e))


@app.post("/api/passes/{pass_id}/revoke", tags=["dashboard"])
async def pass_revoke(pass_id: str):
    if not db.one("SELECT id FROM passes WHERE id=?", (pass_id,)):
        return err(404, "unknown pass")
    pipeline.revoke_pass(pass_id, "kill switch pressed by human")
    return {"ok": True}


@app.post("/api/chains/{chain_id}/unfreeze", tags=["dashboard"])
async def chain_unfreeze(chain_id: str):
    try:
        passes.unfreeze(chain_id)
        return {"ok": True}
    except LookupError as e:
        return err(404, str(e))


@app.post("/api/chains/{chain_id}/clear-taint", tags=["dashboard"])
async def chain_clear_taint(chain_id: str):
    try:
        passes.clear_taint(chain_id)
        return {"ok": True}
    except LookupError as e:
        return err(404, str(e))


@app.get("/api/world/reset-hint", include_in_schema=False)
async def _hint():
    return {}


# ---------- agent + attacks ----------
@app.get("/api/agent/scenarios", tags=["demo"])
async def scenarios():
    return {"scenarios": agent.SCENARIOS}


@app.post("/api/agent/run/{scenario_id}", tags=["demo"])
async def run_scenario(scenario_id: str):
    return await agent.run(scenario_id)


@app.get("/api/attack/list", tags=["demo"])
async def attack_list():
    return {"attacks": attacks.ATTACKS}


@app.post("/api/attack/{name}", tags=["demo"])
async def run_attack(name: str):
    try:
        return await attacks.run(name)
    except Exception as e:
        return err(500, f"attack could not run: {e}")


# ---------- demo control ----------
@app.post("/api/demo/reset", tags=["demo"])
async def demo_reset():
    db.wipe_state()
    vault.seed()
    world.seed()
    try:
        await _http.post(f"{config.SIDECAR_URL}/reset")
    except Exception:
        pass
    audit.log("DEMO_RESET", "INFO", "STATE_CLEARED", severity="info",
              detail={"note": "all runtime data cleared; new vault keys generated"})
    return {"ok": True}


@app.post("/api/demo/request-pass", tags=["demo"])
async def demo_request_pass():
    r = await _http.post(f"{config.SIDECAR_URL}/register", json={})
    return JSONResponse(r.json(), status_code=r.status_code)


@app.post("/api/demo/bootstrap", tags=["demo"])
async def demo_bootstrap():
    """Request a pass, approve it as the human, and wait for the sidecar to claim ticket #1."""
    r = await _http.post(f"{config.SIDECAR_URL}/register", json={})
    if r.status_code != 200:
        return JSONResponse(r.json(), status_code=r.status_code)
    passes.approve_request(r.json()["request_id"])
    for _ in range(40):
        st = await sidecar_status()
        if st.get("has_ticket"):
            return {"ok": True, "sidecar": st}
        await asyncio.sleep(0.25)
    return err(504, "sidecar did not claim its ticket in time")


@app.post("/api/demo/tamper-audit", tags=["demo"])
async def demo_tamper_audit():
    """Edit one audit row directly in the database to prove the hash chain detects it."""
    rows = db.q("SELECT id FROM audit ORDER BY id")
    if len(rows) < 3:
        return err(409, "not enough audit records yet")
    target = rows[len(rows) // 2]["id"]
    db.run("UPDATE audit SET reason='EDITED_BY_ATTACKER' WHERE id=?", (target,))
    return {"tampered_record_id": target, "verification": audit.verify()}
