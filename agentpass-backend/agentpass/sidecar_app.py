"""Signer sidecar. Holds the agent's PRIVATE KEY and its current ticket in this process's
memory only. The AI agent talks to /act and gets results back - it never sees the key,
the ticket, or any API key."""
import asyncio
import json

import httpx
import jwt
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import config, crypto

app = FastAPI(title="AgentPass Signer Sidecar", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
                   allow_headers=["*"])
client = httpx.AsyncClient(timeout=15.0)
S = {}


def fresh_state():
    key = crypto.new_ec_key()
    S.clear()
    S.update(key=key, jwk=crypto.public_jwk(key), agent_id="invoice-assistant", request_id=None,
             ticket=None, chain_id=None, pass_id=None, seq=None, last_request=None, spent=[],
             claim_task=None, claim_status="not_requested")
    S["jkt"] = crypto.jwk_thumbprint(S["jwk"])


fresh_state()


def _ticket_exp(t):
    return jwt.decode(t, options={"verify_signature": False}).get("exp", 0)


def _clean(data, http_status):
    keep = ("status", "decision", "reason", "alert", "result", "approval_id", "request_id",
            "trace_id", "seq", "latency_ms")
    out = {k: data.get(k) for k in keep}
    out["http_status"] = http_status
    return out


def _signed(body_obj, ticket, iat_offset=0):
    raw = crypto.canonical(body_obj).encode()
    proof = crypto.build_proof(S["key"], S["jwk"], htm="POST", htu=config.GATEWAY_URL + "/v1/call",
                               body=raw, ticket=ticket, rid=body_obj["request_id"],
                               iat_offset=iat_offset)
    headers = {"Authorization": "Ticket " + ticket, "X-Agentpass-Proof": proof,
               "Content-Type": "application/json"}
    return raw, headers


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/status")
async def status():
    """Safe status: the ticket and private key are never returned."""
    return {"agent_id": S["agent_id"], "jwk": S["jwk"], "key_thumbprint": S["jkt"],
            "key_extractable": False, "request_id": S["request_id"],
            "claim_status": S["claim_status"], "has_ticket": bool(S["ticket"]),
            "chain_id": S["chain_id"], "pass_id": S["pass_id"], "seq": S["seq"]}


@app.post("/reset")
async def reset():
    t = S.get("claim_task")
    if t:
        t.cancel()
    fresh_state()
    return {"ok": True, "key_thumbprint": S["jkt"]}


@app.post("/register")
async def register(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    payload = {"public_jwk": S["jwk"], "agent_id": S["agent_id"], **body}
    r = await client.post(config.GATEWAY_URL + "/api/passes/request", json=payload)
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text)
    S["request_id"] = r.json()["request_id"]
    S["claim_status"] = "waiting_for_human"
    if S["claim_task"]:
        S["claim_task"].cancel()
    S["claim_task"] = asyncio.create_task(_claim_loop(S["request_id"]))
    return r.json()


async def _claim_loop(rid):
    path = f"/api/passes/requests/{rid}/ticket"
    for _ in range(900):
        proof = crypto.build_proof(S["key"], S["jwk"], htm="GET", htu=config.GATEWAY_URL + path)
        try:
            r = await client.get(config.GATEWAY_URL + path, headers={"X-Agentpass-Proof": proof})
        except httpx.HTTPError:
            await asyncio.sleep(1)
            continue
        if r.status_code == 200:
            d = r.json()
            S.update(ticket=d["ticket"], chain_id=d["chain_id"], pass_id=d["pass_id"], seq=d["seq"],
                     claim_status="claimed")
            return
        if r.status_code in (403, 404, 409):
            S["claim_status"] = f"failed_{r.status_code}"
            return
        await asyncio.sleep(1)
    S["claim_status"] = "timed_out"


async def _resync():
    raw = crypto.canonical({"chain_id": S["chain_id"]}).encode()
    path = "/v1/resync"
    proof = crypto.build_proof(S["key"], S["jwk"], htm="POST", htu=config.GATEWAY_URL + path, body=raw)
    r = await client.post(config.GATEWAY_URL + path, content=raw,
                          headers={"X-Agentpass-Proof": proof, "Content-Type": "application/json"})
    if r.status_code == 200:
        S["ticket"], S["seq"] = r.json()["ticket"], r.json()["seq"]
        return True
    return False


@app.post("/act")
async def act(request: Request):
    b = await request.json()
    if not S["ticket"]:
        raise HTTPException(409, "no ticket yet: request a pass and have a human approve it first")
    body_obj = {"request_id": b.get("request_id") or crypto.new_id("rid", 6),
                "trace_id": b.get("trace_id") or crypto.new_id("tr", 6),
                "tool": b["tool"], "action": b["action"], "params": b.get("params") or {}}
    last = {"status": "error", "decision": "DENY", "reason": "GATEWAY_UNREACHABLE"}
    for _ in range(3):
        if _ticket_exp(S["ticket"]) < __import__("time").time() + 3:
            await _resync()
        old = S["ticket"]
        raw, headers = _signed(body_obj, old)
        try:
            r = await client.post(config.GATEWAY_URL + "/v1/call", content=raw, headers=headers)
        except httpx.HTTPError:
            continue  # same request_id, fresh proof: the gateway makes retries safe (idempotent)
        S["last_request"] = {"headers": headers, "body": raw.decode()}
        data = r.json()
        nt = data.get("next_ticket")
        if nt and data.get("seq", 0) > (S["seq"] or 0):
            S["spent"] = (S["spent"] + [{"ticket": old, "seq": S["seq"]}])[-5:]
            S["ticket"], S["seq"] = nt, data["seq"]
        if r.status_code == 401 and data.get("reason") in ("TICKET_EXPIRED", "TICKET_SUPERSEDED"):
            if await _resync():
                continue
        return _clean(data, r.status_code)
    return {**last, "http_status": 0}


# ---------------------------------------------------------------------------
# SIMULATION ONLY: stand in for traffic an attacker could capture from logs, networks or
# memory. They never expose the private key. Disable with AGENTPASS_SIMULATION=0.
# ---------------------------------------------------------------------------
def _sim():
    if not config.SIMULATION:
        raise HTTPException(404, "simulation endpoints are disabled")


@app.get("/debug/leak_ticket")
async def leak_ticket():
    _sim()
    return {"ticket": S["ticket"]}


@app.get("/debug/last_request")
async def last_request():
    _sim()
    if not S["last_request"]:
        raise HTTPException(404, "no request captured yet - run a scenario first")
    return S["last_request"]


@app.post("/debug/intercept")
async def intercept(request: Request):
    """A signed request captured in flight (never sent). Optional iat_offset for staleness tests."""
    _sim()
    b = await request.json()
    body_obj = {"request_id": crypto.new_id("rid", 6), "trace_id": b.get("trace_id"),
                "tool": b["tool"], "action": b["action"], "params": b.get("params") or {}}
    raw, headers = _signed(body_obj, S["ticket"], int(b.get("iat_offset", 0)))
    return {"headers": headers, "body": raw.decode()}


@app.post("/debug/reuse_spent")
async def reuse_spent(request: Request):
    """Worst case: key AND an already-burned ticket. Proves burn-after-use stands alone."""
    _sim()
    b = await request.json() if request.headers.get("content-length") not in (None, "0") else {}
    if not S["spent"]:
        raise HTTPException(404, "no spent ticket yet - run a scenario first")
    body_obj = {"request_id": crypto.new_id("rid", 6), "trace_id": b.get("trace_id"),
                "tool": "pay", "action": "pay:create",
                "params": {"payee": "acct_vendor_1", "amount": 100, "currency": "INR"}}
    raw, headers = _signed(body_obj, S["spent"][-1]["ticket"])
    r = await client.post(config.GATEWAY_URL + "/v1/call", content=raw, headers=headers)
    return {"http_status": r.status_code, "body": _clean(r.json(), r.status_code)}
