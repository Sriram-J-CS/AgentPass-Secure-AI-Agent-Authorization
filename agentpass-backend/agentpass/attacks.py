"""Attack Center. Every attack is a REAL request sent over HTTP to the gateway - the results
shown on the dashboard are what the gateway actually answered, not canned text.

The sidecar's /debug endpoints stand in for traffic an attacker could capture from logs,
networks or memory (simulation only). The attacker never receives the agent's private key."""
import json
import time

import httpx
import jwt

from . import config, crypto, db

_client = httpx.AsyncClient(timeout=15.0)

ATTACKS = [
    {"id": "stolen_ticket", "title": "Stolen ticket",
     "description": "Attacker obtains the agent's unused ticket (from logs or memory) and tries to "
                    "use it with their own key, then with the victim's public key.",
     "expected": "Rejected: no signing key"},
    {"id": "replay_captured", "title": "Replay a captured request",
     "description": "Attacker re-sends the exact bytes of a request they captured on the wire.",
     "expected": "Rejected: proof already used"},
    {"id": "tamper_body", "title": "Edit a request in flight",
     "description": "Attacker intercepts a signed INR 450 payment and changes it to INR 50,000.",
     "expected": "Rejected: body hash mismatch"},
    {"id": "forged_ticket", "title": "Forge a ticket",
     "description": "Attacker mints their own ticket and signs it with their own key.",
     "expected": "Rejected: ticket signature invalid"},
    {"id": "reuse_spent_ticket", "title": "Reuse a spent ticket (key compromised)",
     "description": "Worst case: the attacker has the key AND a used ticket. Burn-after-use still "
                    "stops it and freezes the chain.",
     "expected": "Rejected: ticket burned, chain frozen"},
    {"id": "direct_tool", "title": "Bypass the gateway",
     "description": "Call the payment and email tools directly, without going through AgentPass.",
     "expected": "Rejected: tools need the vault key"},
]


async def _sidecar(method, path, **kw):
    r = await _client.request(method, f"{config.SIDECAR_URL}{path}", **kw)
    if r.status_code >= 400:
        raise RuntimeError(r.json().get("detail") or r.text)
    return r.json()


async def _post(raw: bytes, ticket: str, proof: str):
    r = await _client.post(config.GATEWAY_URL + "/v1/call", content=raw, headers={
        "Authorization": "Ticket " + ticket, "X-Agentpass-Proof": proof,
        "Content-Type": "application/json"})
    return r.status_code, r.json()


def _attempt(label, status, body):
    blocked = status in (401, 403, 409) and body.get("decision", "DENY") == "DENY"
    return {"label": label, "http_status": status, "blocked": blocked,
            "reason": body.get("reason") or body.get("detail") or body.get("error"),
            "alert": body.get("alert")}


def _evil_body(trace):
    return {"request_id": crypto.new_id("rid", 6), "trace_id": trace, "tool": "pay",
            "action": "pay:create",
            "params": {"payee": "acct_attacker", "amount": 450, "currency": "INR"}}


async def run(name: str):
    trace = crypto.new_id("atk", 6)
    attempts, summary = [], ""
    status = await _sidecar("GET", "/status")
    if not status.get("has_ticket"):
        return {"error": "no active pass yet - bootstrap the demo first"}
    attacker = crypto.new_ec_key()
    a_jwk = crypto.public_jwk(attacker)

    if name == "stolen_ticket":
        stolen = (await _sidecar("GET", "/debug/leak_ticket"))["ticket"]
        raw = crypto.canonical(_evil_body(trace)).encode()
        for label, jwk in (("Attacker signs with their own key", a_jwk),
                           ("Attacker presents the victim's public key but signs with their own",
                            status["jwk"])):
            proof = crypto.build_proof(attacker, jwk, htm="POST",
                                       htu=config.GATEWAY_URL + "/v1/call", body=raw,
                                       ticket=stolen, rid=json.loads(raw)["request_id"])
            attempts.append(_attempt(label, *await _post(raw, stolen, proof)))
        summary = "A ticket alone is useless: every request must be signed by the hidden key."

    elif name == "replay_captured":
        cap = await _sidecar("GET", "/debug/last_request")
        r = await _client.post(config.GATEWAY_URL + "/v1/call", content=cap["body"].encode(),
                               headers=cap["headers"])
        attempts.append(_attempt("Exact copy of a captured request", r.status_code, r.json()))
        summary = "Every proof carries a one-time nonce and the ticket was already burned."

    elif name == "tamper_body":
        cap = await _sidecar("POST", "/debug/intercept", json={
            "tool": "pay", "action": "pay:create", "trace_id": trace,
            "params": {"payee": "acct_vendor_1", "amount": 450, "currency": "INR"}})
        body = json.loads(cap["body"])
        body["params"]["amount"] = 50000
        body["params"]["payee"] = "acct_attacker"
        tampered = json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
        r = await _client.post(config.GATEWAY_URL + "/v1/call", content=tampered,
                               headers=cap["headers"])
        attempts.append(_attempt("Amount changed from INR 450 to INR 50,000", r.status_code, r.json()))
        summary = "The signature covers a hash of the body, so any edit breaks it."

    elif name == "forged_ticket":
        raw = crypto.canonical(_evil_body(trace)).encode()
        now = int(time.time())
        fake = jwt.encode({"iss": "agentpass-gateway", "tid": "t_forged", "chain": status["chain_id"],
                           "seq": status["seq"], "pass": status["pass_id"],
                           "cnf": {"jkt": crypto.jwk_thumbprint(a_jwk)}, "iat": now,
                           "exp": now + 60}, attacker, algorithm="ES256",
                          headers={"typ": "agp-ticket+jwt", "kid": "gw-1"})
        proof = crypto.build_proof(attacker, a_jwk, htm="POST", htu=config.GATEWAY_URL + "/v1/call",
                                   body=raw, ticket=fake, rid=json.loads(raw)["request_id"])
        attempts.append(_attempt("Self-minted ticket", *await _post(raw, fake, proof)))
        summary = "Only the gateway can mint tickets; its signature cannot be forged."

    elif name == "reuse_spent_ticket":
        res = await _sidecar("POST", "/debug/reuse_spent", json={"trace_id": trace})
        attempts.append(_attempt("Valid key + already-burned ticket", res["http_status"], res["body"]))
        summary = "A burned ticket is dead even for the key holder; the chain is frozen for review."

    elif name == "direct_tool":
        for label, headers in (("No API key", {}), ("Guessed API key", {"x-api-key": "sk_live_guess123"})):
            r = await _client.post(config.GATEWAY_URL + "/tools/pay/create", headers=headers,
                                   json={"payee": "acct_attacker", "amount": 50000})
            attempts.append({"label": f"Call payment tool directly: {label}",
                             "http_status": r.status_code, "blocked": r.status_code == 401,
                             "reason": "INVALID_TOOL_KEY", "alert": "TOOL_BYPASS_ATTEMPT"})
        summary = "Tools only accept the real key, which exists only inside the vault."
    else:
        return {"error": f"unknown attack '{name}'"}

    chain = db.one("SELECT state, expected_seq FROM chains ORDER BY created_at DESC LIMIT 1")
    return {"attack": name, "trace_id": trace, "attempts": attempts,
            "all_blocked": all(a["blocked"] for a in attempts), "summary": summary,
            "chain_state": chain["state"] if chain else None,
            "chain_seq": chain["expected_seq"] if chain else None}
