"""The gateway pipeline for POST /v1/call - every protected action goes through here.

Order (fail closed):
  A identity   ticket sig -> key match -> proof sig -> freshness -> nonce -> request binding
  B idempotent safe retry of a lost response (no second execution, no second burn)
  C validity   pass active / not expired / chain active
  D BURN       atomic one-time use of the ticket (every identity-valid attempt)
  E policy     scope -> canary -> intent -> budget -> behavior -> taint -> risk
  F outcome    ALLOW (vault injects key, tool runs, response scrubbed) | STEP_UP | DENY
"""
import json
import time

import httpx
import jwt
from fastapi.responses import JSONResponse

from . import audit, config, crypto, db, policy, vault

_client = httpx.AsyncClient(timeout=10.0)


# ---------- ticket helpers ----------
def _set_ticket_row(tid, chain_id, seq):
    db.run("INSERT OR REPLACE INTO tickets(tid,chain_id,seq,status,issued_at) VALUES(?,?,?,'active',?)",
           (tid, chain_id, seq, time.time()))


def next_ticket_for(chain, pass_row, tid, seq):
    _set_ticket_row(tid, chain["id"], seq)
    return crypto.mint_ticket(tid=tid, chain=chain["id"], seq=seq, pass_id=pass_row["id"],
                              jkt=pass_row["jkt"])


def _respond(status_code, body):
    return JSONResponse(body, status_code=status_code)


# ---------- main entry ----------
async def handle_call(method: str, path: str, raw: bytes, auth: str, proof_token: str):
    t0 = time.perf_counter()
    now = time.time()
    ctx = {"trace_id": None, "pass_id": None, "chain_id": None, "seq": None, "tool": None,
           "action": None, "request_hash": crypto.sha256_hex(raw)}

    def fail(http, code, *, alert=None, severity="warn", detail=None, event="CALL_DENIED",
             extra=None):
        d = {"alert": alert, "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
             **(detail or {})}
        audit.log(event, "DENY", code, severity=severity, detail=d, **ctx)
        body = {"status": "denied", "decision": "DENY", "reason": code, "alert": alert,
                "trace_id": ctx["trace_id"], **(extra or {})}
        return _respond(http, body)

    # ---------- A. identity ----------
    if not auth.startswith("Ticket ") or not proof_token:
        return fail(401, "MISSING_CREDENTIALS")
    ticket = auth[7:].strip()
    try:
        tc = crypto.decode_ticket(ticket)
    except Exception:
        return fail(401, "TICKET_SIGNATURE_INVALID", alert="FORGED_TICKET", severity="high")
    ctx.update(pass_id=tc.get("pass"), chain_id=tc.get("chain"), seq=tc.get("seq"))
    if tc.get("exp", 0) < now:
        return fail(401, "TICKET_EXPIRED", severity="info")

    try:
        header = jwt.get_unverified_header(proof_token)
        jwk = header["jwk"]
        if header.get("typ") != "dpop+jwt" or header.get("alg") != "ES256":
            raise ValueError("header")
        jkt = crypto.jwk_thumbprint(jwk)
        pub = crypto.jwk_to_public_key(jwk)
    except Exception:
        return fail(401, "PROOF_MALFORMED", severity="warn")
    if jkt != tc["cnf"]["jkt"]:
        return fail(401, "KEY_MISMATCH", alert="STOLEN_TICKET_ATTEMPT", severity="high",
                    detail={"why": "proof key is not the key this ticket is bound to"})
    try:
        pc = jwt.decode(proof_token, pub, algorithms=["ES256"], options=crypto.NO_TIME_CHECKS)
    except Exception:
        return fail(401, "PROOF_SIGNATURE_INVALID", alert="STOLEN_TICKET_ATTEMPT", severity="high",
                    detail={"why": "signature was not made by the bound private key"})

    if abs(now - pc.get("iat", 0)) > config.PROOF_WINDOW_SECONDS:
        return fail(401, "PROOF_STALE", alert="CAPTURED_REQUEST_REPLAY", severity="high",
                    detail={"age_seconds": round(now - pc.get("iat", 0), 1)})
    try:
        db.run("INSERT INTO nonces(jti,seen_at) VALUES(?,?)", (str(pc.get("jti")), now))
    except Exception:
        return fail(401, "PROOF_REPLAY", alert="CAPTURED_REQUEST_REPLAY", severity="high",
                    detail={"why": "this proof was already used"})
    if now % 7 < 0.05:
        db.run("DELETE FROM nonces WHERE seen_at<?", (now - 300,))

    expected_htu = config.GATEWAY_URL + path
    body_hash = crypto.sha256_b64u(raw)
    if pc.get("htm") != method or pc.get("htu") != expected_htu:
        return fail(401, "BINDING_MISMATCH", alert="BODY_TAMPER_ATTEMPT", severity="high",
                    detail={"why": "proof was made for a different method or URL"})
    if pc.get("bdh") != body_hash:
        return fail(401, "BINDING_MISMATCH", alert="BODY_TAMPER_ATTEMPT", severity="high",
                    detail={"why": "request body changed after it was signed"})
    if pc.get("ath") != crypto.sha256_b64u(ticket):
        return fail(401, "BINDING_MISMATCH", alert="BODY_TAMPER_ATTEMPT", severity="high",
                    detail={"why": "proof is not bound to this ticket"})
    try:
        body = json.loads(raw)
        rid, tool, action = str(body["request_id"]), str(body["tool"]), str(body["action"])
        params = body.get("params") or {}
        ctx["trace_id"] = body.get("trace_id") or crypto.new_id("tr", 6)
        if not isinstance(params, dict) or pc.get("rid") != rid:
            raise ValueError("body")
    except Exception:
        return fail(400, "BAD_REQUEST_BODY")
    ctx.update(tool=tool, action=action)

    # ---------- B. idempotent retry ----------
    cached = db.one("SELECT * FROM responses WHERE chain_id=? AND rid=?", (tc["chain"], rid))
    if cached:
        if cached["body_hash"] != body_hash:
            return fail(401, "BINDING_MISMATCH", alert="BODY_TAMPER_ATTEMPT", severity="high",
                        detail={"why": "request_id reused with a different body"})
        audit.log("IDEMPOTENT_REPLAY", "ALLOW", "CACHED_RESPONSE", severity="info",
                  detail={"request_id": rid, "note": "same request retried; not executed again"},
                  **ctx)
        return _respond(200, json.loads(cached["response"]))

    # ---------- C. pass / chain validity ----------
    chain = db.one("SELECT * FROM chains WHERE id=?", (tc["chain"],))
    pass_row = db.one("SELECT * FROM passes WHERE id=?", (tc["pass"],))
    if not chain or not pass_row or pass_row["jkt"] != jkt:
        return fail(401, "CHAIN_UNKNOWN")
    if pass_row["status"] == "revoked":
        return fail(403, "PASS_REVOKED", severity="warn",
                    detail={"revoked_reason": pass_row["revoke_reason"]})
    if pass_row["expires_at"] < now:
        return fail(403, "PASS_EXPIRED")
    if chain["state"] != "active":
        return fail(409, "CHAIN_FROZEN", severity="high")

    # ---------- D. BURN (atomic one-time use) ----------
    next_tid = crypto.new_id("t", 8)
    cur = db.run("UPDATE chains SET expected_seq=expected_seq+1, current_tid=?, last_burned_tid=? "
                 "WHERE id=? AND state='active' AND expected_seq=? AND current_tid=?",
                 (next_tid, tc["tid"], chain["id"], tc["seq"], tc["tid"]))
    if cur.rowcount != 1:
        fresh = db.one("SELECT * FROM chains WHERE id=?", (chain["id"],))
        if tc["seq"] < fresh["expected_seq"]:
            # valid signature + fresh nonce + spent ticket = the KEY HOLDER reused a burned ticket
            db.run("UPDATE chains SET state='frozen' WHERE id=?", (chain["id"],))
            audit.log("CHAIN_FROZEN", "DENY", "KEY_HOLDER_ANOMALY", severity="critical",
                      detail={"alert": "KEY_HOLDER_ANOMALY",
                              "why": "a spent ticket was presented with a valid signature",
                              "ticket_seq": tc["seq"], "expected_seq": fresh["expected_seq"]},
                      **ctx)
            return _respond(409, {"status": "denied", "decision": "DENY",
                                  "reason": "TICKET_ALREADY_USED", "alert": "KEY_HOLDER_ANOMALY",
                                  "trace_id": ctx["trace_id"]})
        return fail(401, "TICKET_SUPERSEDED", severity="info")

    db.run("UPDATE tickets SET status='burned', burned_at=?, burned_rid=? WHERE tid=?",
           (time.time(), rid, tc["tid"]))
    next_seq = tc["seq"] + 1
    next_ticket = next_ticket_for(chain, pass_row, next_tid, next_seq)

    def finish(http, status, decision, reason, event, severity, alert=None, result=None,
               extra=None, detail=None, approval_id=None):
        latency = round((time.perf_counter() - t0) * 1000, 2)
        db.run("UPDATE tickets SET outcome=?, summary=? WHERE tid=?",
               (decision, f"{action} -> {decision} ({reason})", tc["tid"]))
        body_out = {"status": status, "decision": decision, "reason": reason, "alert": alert,
                    "result": result, "approval_id": approval_id, "request_id": rid,
                    "trace_id": ctx["trace_id"], "seq": next_seq, "next_ticket": next_ticket,
                    "latency_ms": latency, **(extra or {})}
        d = {"alert": alert, "latency_ms": latency, "request_id": rid, "params": _redact(params),
             "ticket_burned": tc["seq"], "next_seq": next_seq, **(detail or {})}
        audit.log(event, decision, reason, severity=severity, detail=d, **ctx)
        db.run("INSERT OR REPLACE INTO responses(chain_id,rid,body_hash,response,created_at) "
               "VALUES(?,?,?,?,?)", (chain["id"], rid, body_hash, json.dumps(body_out), time.time()))
        return _respond(http, body_out)

    # ---------- E. policy ----------
    tcfg, acfg = policy.action_cfg(tool, action)
    if not acfg:
        return finish(403, "denied", "DENY", "UNKNOWN_ACTION", "CALL_DENIED", "high",
                      alert="SCOPE_VIOLATION", detail={"why": "tool/action not registered"})
    err = _validate_params(action, params)
    if err:
        return finish(400, "denied", "DENY", "INVALID_PARAMS", "CALL_DENIED", "warn",
                      detail={"why": err})
    decision = policy.evaluate(pass_row, chain, tool, action, params, acfg["risk"])
    dec_detail = {"risk": decision["risk"], "tainted": decision["tainted"],
                  "behavior_score": decision["behavior_score"],
                  "behavior_breakdown": decision["behavior_breakdown"], **decision["detail"]}

    if decision["decision"] == "DENY":
        if decision.get("revoke"):
            _revoke(pass_row["id"], f"auto-revoked: {decision['reason']}", ctx["trace_id"])
        return finish(403, "denied", "DENY", decision["reason"], "CALL_DENIED",
                      decision["severity"], alert=decision["alert"], detail=dec_detail)

    if decision["decision"] == "STEP_UP":
        approval_id = _create_approval(pass_row, chain, tc["seq"], tool, action, params,
                                       decision["reasons"], ctx["trace_id"])
        return finish(202, "pending_approval", "STEP_UP", decision["reason"],
                      "CALL_PENDING_APPROVAL", "warn", approval_id=approval_id,
                      detail={**dec_detail, "reasons": decision["reasons"],
                              "approval_id": approval_id})

    # ---------- F. ALLOW: vault -> tool -> scrub ----------
    try:
        result, redactions = await broker_call(tool, action, params)
    except Exception as exc:  # tool failure is still a recorded, burned attempt
        return finish(502, "error", "ALLOW", "TOOL_ERROR", "CALL_ALLOWED", "warn",
                      detail={**dec_detail, "error": str(exc)[:200]})
    policy.consume_budget(pass_row["id"], action, params)
    taint_note = _maybe_taint(chain["id"], pass_row["id"], acfg, result, ctx)
    return finish(200, "ok", "ALLOW", "OK", "CALL_ALLOWED", "info", result=result,
                  detail={**dec_detail, "redactions": redactions, "result_summary":
                          _summarize(action, result), "taint": taint_note})


# ---------- broker: the ONLY place real API keys are used ----------
async def broker_call(tool, action, params):
    tcfg, acfg = policy.action_cfg(tool, action)
    secret = vault.reveal(tcfg["secret"])
    path = acfg["path"].replace("{id}", str(int(params.get("id", 0)))) if "{id}" in acfg["path"] \
        else acfg["path"]
    url = f"{config.GATEWAY_URL}/tools{path}"
    kwargs = {"headers": {tcfg["auth_header"]: secret}}
    if acfg["method"] == "GET" and action == "files:read":
        kwargs["params"] = {"limit": int(params.get("limit", 50) or 50)}
    elif acfg["method"] in ("POST", "PUT"):
        kwargs["json"] = {k: v for k, v in params.items()}
    try:
        resp = await _client.request(acfg["method"], url, **kwargs)
        text, redactions = vault.scrub(resp.text, [secret])
    finally:
        secret = None  # drop the reference immediately (Python strings cannot be zeroed)
    if resp.status_code >= 400:
        raise RuntimeError(f"tool returned {resp.status_code}")
    try:
        return json.loads(text), redactions
    except ValueError:
        return {"raw": text}, redactions


def _validate_params(action, p):
    try:
        if action == "email:send":
            assert isinstance(p.get("to"), str) and "@" in p["to"], "to must be an email address"
        if action == "pay:create":
            assert isinstance(p.get("payee"), str) and p["payee"], "payee required"
            assert isinstance(p.get("amount"), (int, float)) and p["amount"] > 0, "amount must be > 0"
        if action in ("files:open", "files:delete"):
            assert isinstance(p.get("id"), int), "id must be an integer"
        if action == "files:read" and "limit" in p:
            assert isinstance(p["limit"], int) and p["limit"] > 0, "limit must be a positive integer"
    except AssertionError as e:
        return str(e)
    return None


def _redact(params):
    out = {}
    for k, v in params.items():
        out[k] = (v[:120] + "...") if isinstance(v, str) and len(v) > 120 else v
    return out


def _summarize(action, result):
    if action == "email:read":
        emails = result.get("emails", [])
        ext = sum(1 for e in emails if e.get("external"))
        return f"{len(emails)} emails ({ext} external)"
    if action == "files:read":
        return f"{result.get('count', 0)} files listed"
    if action == "pay:create":
        return f"paid {result.get('currency')} {result.get('amount')} to {result.get('payee')}"
    if action == "email:send":
        return f"sent email to {result.get('to')}"
    if action == "files:open":
        return f"opened {result.get('name')}"
    return "ok"


def _maybe_taint(chain_id, pass_id, acfg, result, ctx):
    if not acfg.get("untrusted_output"):
        return None
    external = [e for e in result.get("emails", []) if e.get("external")]
    if not external:
        return None
    reason = f"read external content from {external[0]['sender']}"
    db.run("UPDATE chains SET tainted=1, taint_reason=? WHERE id=?", (reason, chain_id))
    audit.log("TAINT_SET", "INFO", "UNTRUSTED_CONTENT_READ", severity="warn",
              detail={"reason": reason}, **{**ctx, "pass_id": pass_id, "chain_id": chain_id})
    return reason


# ---------- approvals (step-up) ----------
def _create_approval(pass_row, chain, seq, tool, action, params, reasons, trace_id):
    aid = crypto.new_id("apr", 6)
    rh = crypto.sha256_hex(crypto.canonical({"pass": pass_row["id"], "chain": chain["id"],
                                             "seq": seq, "tool": tool, "action": action,
                                             "params": params}))
    now = time.time()
    db.run("INSERT INTO approvals(id,pass_id,chain_id,seq,tool,action,params,request_hash,status,"
           "created_at,expires_at,trace_id,reasons) VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?,?)",
           (aid, pass_row["id"], chain["id"], seq, tool, action, db.jdump(params), rh, now,
            now + config.APPROVAL_TTL_SECONDS, trace_id, db.jdump(reasons)))
    audit.bus.publish({"kind": "approval", "id": aid})
    return aid


def approval_view(row):
    return {"id": row["id"], "pass_id": row["pass_id"], "chain_id": row["chain_id"],
            "tool": row["tool"], "action": row["action"], "params": db.jload(row["params"], {}),
            "request_hash": row["request_hash"], "status": row["status"],
            "reasons": db.jload(row["reasons"], []), "created": db.iso(row["created_at"]),
            "expires": db.iso(row["expires_at"]),
            "seconds_left": max(0, int(row["expires_at"] - time.time())),
            "decided": db.iso(row["decided_at"]), "result": db.jload(row["result"]),
            "trace_id": row["trace_id"]}


async def decide_approval(aid, decision, request_hash):
    row = db.one("SELECT * FROM approvals WHERE id=?", (aid,))
    if not row:
        return 404, {"error": "approval not found"}
    if row["status"] != "pending":
        return 409, {"error": f"already {row['status']}"}
    if request_hash != row["request_hash"]:
        return 400, {"error": "request_hash does not match the exact action being approved"}
    ctx = dict(trace_id=row["trace_id"], pass_id=row["pass_id"], chain_id=row["chain_id"],
               seq=row["seq"], tool=row["tool"], action=row["action"],
               request_hash=row["request_hash"])
    params = db.jload(row["params"], {})
    if row["expires_at"] < time.time():
        db.run("UPDATE approvals SET status='expired', decided_at=? WHERE id=?", (time.time(), aid))
        audit.log("APPROVAL_EXPIRED", "DENY", "APPROVAL_TIMEOUT", severity="warn",
                  detail={"approval_id": aid, "alert": "APPROVAL_TIMEOUT"}, **ctx)
        return 410, {"error": "approval expired"}
    if decision == "deny":
        db.run("UPDATE approvals SET status='denied', decided_at=? WHERE id=?", (time.time(), aid))
        audit.log("APPROVAL_DENIED", "DENY", "HUMAN_DENIED", severity="warn",
                  detail={"approval_id": aid, "alert": "APPROVAL_DENIED", "params": _redact(params)},
                  **ctx)
        return 200, approval_view(db.one("SELECT * FROM approvals WHERE id=?", (aid,)))
    pass_row = db.one("SELECT * FROM passes WHERE id=?", (row["pass_id"],))
    if pass_row["status"] != "active" or pass_row["expires_at"] < time.time():
        return 409, {"error": "pass is no longer active"}
    try:
        result, redactions = await broker_call(row["tool"], row["action"], params)
    except Exception as exc:
        return 502, {"error": f"tool error: {exc}"}
    policy.consume_budget(row["pass_id"], row["action"], params)
    db.run("UPDATE approvals SET status='approved', decided_at=?, result=? WHERE id=?",
           (time.time(), db.jdump(result), aid))
    audit.log("APPROVAL_APPROVED", "ALLOW", "HUMAN_APPROVED", severity="info",
              detail={"approval_id": aid, "params": _redact(params), "redactions": redactions,
                      "result_summary": _summarize(row["action"], result)}, **ctx)
    return 200, approval_view(db.one("SELECT * FROM approvals WHERE id=?", (aid,)))


# ---------- pass lifecycle helpers ----------
def _revoke(pass_id, reason, trace_id=None):
    db.run("UPDATE passes SET status='revoked', revoked_at=?, revoke_reason=? WHERE id=?",
           (time.time(), reason, pass_id))
    db.run("UPDATE chains SET state='closed' WHERE pass_id=?", (pass_id,))
    audit.log("PASS_REVOKED", "DENY", "KILL_SWITCH", severity="critical", pass_id=pass_id,
              trace_id=trace_id, detail={"reason": reason, "alert": "PASS_REVOKED"})


revoke_pass = _revoke
