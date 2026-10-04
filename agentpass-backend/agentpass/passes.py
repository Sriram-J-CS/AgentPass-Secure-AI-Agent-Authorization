"""Pass lifecycle: request -> human approval -> ticket #1 -> resync / revoke / unfreeze."""
import json
import time

import jwt

from . import audit, config, crypto, db, pipeline, policy


def _verify_signed_request(proof_token, method, path, raw=b""):
    """Verify a ticket-less proof (used for claim and resync). Returns (jwk, jkt, claims)."""
    header = jwt.get_unverified_header(proof_token)
    jwk = header["jwk"]
    if header.get("typ") != "dpop+jwt" or header.get("alg") != "ES256":
        raise ValueError("bad header")
    pub = crypto.jwk_to_public_key(jwk)
    claims = jwt.decode(proof_token, pub, algorithms=["ES256"], options=crypto.NO_TIME_CHECKS)
    now = time.time()
    if abs(now - claims.get("iat", 0)) > config.PROOF_WINDOW_SECONDS:
        raise ValueError("stale")
    if claims.get("htm") != method or claims.get("htu") != config.GATEWAY_URL + path:
        raise ValueError("binding")
    if claims.get("bdh") != crypto.sha256_b64u(raw):
        raise ValueError("body")
    db.run("INSERT INTO nonces(jti,seen_at) VALUES(?,?)", (str(claims["jti"]), now))  # replay guard
    return jwk, crypto.jwk_thumbprint(jwk), claims


def create_request(body: dict) -> dict:
    d = policy.DEFAULT_REQUEST
    jwk = body["public_jwk"]
    jkt = crypto.jwk_thumbprint(jwk)
    crypto.jwk_to_public_key(jwk)  # validates
    rid = crypto.new_id("preq", 6)
    scopes = body.get("scopes") or d["scopes"]
    budget = body.get("budget") or d["budget"]
    task = body.get("task") or d["task"]
    ttl = int(body.get("ttl_seconds") or d["ttl_seconds"])
    db.run("INSERT INTO pass_requests(id,agent_id,public_jwk,jkt,scopes,budget,task,ttl_seconds,"
           "status,created_at) VALUES(?,?,?,?,?,?,?,?,'pending',?)",
           (rid, body.get("agent_id") or d["agent_id"], db.jdump(jwk), jkt, db.jdump(scopes),
            db.jdump(budget), db.jdump(task), ttl, time.time()))
    audit.log("PASS_REQUESTED", "INFO", "AWAITING_HUMAN", severity="info",
              detail={"request_id": rid, "agent_id": body.get("agent_id") or d["agent_id"],
                      "key_thumbprint": jkt[:16], "scopes": scopes})
    return {"request_id": rid, "status": "pending"}


def request_view(r):
    scopes, budget, task = (db.jload(r["scopes"], []), db.jload(r["budget"], {}),
                            db.jload(r["task"], {}))
    return {"id": r["id"], "agent_id": r["agent_id"], "status": r["status"],
            "key_thumbprint": r["jkt"], "scopes": scopes, "budget": budget, "task": task,
            "ttl_seconds": r["ttl_seconds"], "created": db.iso(r["created_at"]),
            "pass_id": r["pass_id"],
            "blast_radius": policy.blast_radius(scopes, budget, task, r["ttl_seconds"])}


def approve_request(rid: str) -> dict:
    r = db.one("SELECT * FROM pass_requests WHERE id=?", (rid,))
    if not r:
        raise LookupError("pass request not found")
    if r["status"] != "pending":
        raise ValueError(f"request already {r['status']}")
    now = time.time()
    pass_id, chain_id, tid = crypto.new_id("pass", 6), crypto.new_id("chain", 6), crypto.new_id("t", 8)
    scopes = db.jload(r["scopes"], [])
    db.run("INSERT INTO passes(id,agent_id,jkt,public_jwk,scopes,budget,task,risk_policy,status,"
           "created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,'active',?,?)",
           (pass_id, r["agent_id"], r["jkt"], r["public_jwk"], r["scopes"], r["budget"], r["task"],
            db.jdump(policy.risk_policy_for(scopes)), now, now + r["ttl_seconds"]))
    db.run("INSERT INTO chains(id,pass_id,state,expected_seq,current_tid,created_at) "
           "VALUES(?,?,'active',1,?,?)", (chain_id, pass_id, tid, now))
    db.run("INSERT INTO tickets(tid,chain_id,seq,status,issued_at) VALUES(?,?,1,'active',?)",
           (tid, chain_id, now))
    db.run("UPDATE pass_requests SET status='approved', decided_at=?, pass_id=? WHERE id=?",
           (now, pass_id, rid))
    audit.log("PASS_ISSUED", "ALLOW", "HUMAN_APPROVED", severity="info", pass_id=pass_id,
              chain_id=chain_id, seq=1,
              detail={"request_id": rid, "agent_id": r["agent_id"], "scopes": scopes,
                      "expires": db.iso(now + r["ttl_seconds"]),
                      "bound_key_thumbprint": r["jkt"][:16]})
    return {"pass_id": pass_id, "chain_id": chain_id}


def reject_request(rid: str):
    r = db.one("SELECT * FROM pass_requests WHERE id=?", (rid,))
    if not r or r["status"] != "pending":
        raise LookupError("no pending request")
    db.run("UPDATE pass_requests SET status='rejected', decided_at=? WHERE id=?", (time.time(), rid))
    audit.log("PASS_REJECTED", "DENY", "HUMAN_REJECTED", severity="info", detail={"request_id": rid})


def claim_ticket(rid: str, proof_token: str, path: str):
    """Sidecar fetches ticket #1 once, proving it holds the key the pass is bound to."""
    r = db.one("SELECT * FROM pass_requests WHERE id=?", (rid,))
    if not r:
        return 404, {"error": "unknown request"}
    try:
        _, jkt, _ = _verify_signed_request(proof_token, "GET", path)
    except Exception:
        return 401, {"error": "invalid proof"}
    if jkt != r["jkt"]:
        return 401, {"error": "key does not match this request"}
    if r["status"] == "pending":
        return 202, {"status": "pending"}
    if r["status"] != "approved":
        return 403, {"status": r["status"]}
    if r["claimed"]:
        return 409, {"error": "ticket already claimed; use /v1/resync"}
    chain = db.one("SELECT * FROM chains WHERE pass_id=?", (r["pass_id"],))
    pass_row = db.one("SELECT * FROM passes WHERE id=?", (r["pass_id"],))
    ticket = crypto.mint_ticket(tid=chain["current_tid"], chain=chain["id"], seq=chain["expected_seq"],
                                pass_id=pass_row["id"], jkt=pass_row["jkt"])
    db.run("UPDATE pass_requests SET claimed=1 WHERE id=?", (rid,))
    return 200, {"status": "approved", "ticket": ticket, "chain_id": chain["id"],
                 "pass_id": pass_row["id"], "seq": chain["expected_seq"]}


def resync(raw: bytes, proof_token: str, path: str):
    """Replacement ticket for the same sequence number (lost response / expired ticket).
    Needs the private key, never skips a sequence number, supersedes the older ticket."""
    try:
        _, jkt, _ = _verify_signed_request(proof_token, "POST", path, raw)
        chain_id = json.loads(raw)["chain_id"]
    except Exception:
        return 401, {"error": "invalid proof"}
    chain = db.one("SELECT * FROM chains WHERE id=?", (chain_id,))
    pass_row = db.one("SELECT * FROM passes WHERE id=?", (chain["pass_id"],)) if chain else None
    if not chain or pass_row["jkt"] != jkt:
        return 401, {"error": "key does not match this chain"}
    if pass_row["status"] != "active" or pass_row["expires_at"] < time.time():
        return 403, {"error": "PASS_NOT_ACTIVE"}
    if chain["state"] != "active":
        return 409, {"error": "CHAIN_FROZEN"}
    new_tid = crypto.new_id("t", 8)
    db.run("UPDATE tickets SET status='superseded' WHERE tid=? AND status='active'",
           (chain["current_tid"],))
    db.run("UPDATE chains SET current_tid=? WHERE id=?", (new_tid, chain_id))
    db.run("INSERT INTO tickets(tid,chain_id,seq,status,issued_at) VALUES(?,?,?,'active',?)",
           (new_tid, chain_id, chain["expected_seq"], time.time()))
    audit.log("TICKET_RESYNC", "INFO", "REPLACEMENT_TICKET", severity="info", pass_id=pass_row["id"],
              chain_id=chain_id, seq=chain["expected_seq"],
              detail={"note": "ticket replaced for the same sequence number"})
    ticket = crypto.mint_ticket(tid=new_tid, chain=chain_id, seq=chain["expected_seq"],
                                pass_id=pass_row["id"], jkt=pass_row["jkt"])
    return 200, {"ticket": ticket, "seq": chain["expected_seq"]}


def current():
    """The most recent pass and its chain (the demo uses one agent at a time)."""
    p = db.one("SELECT * FROM passes ORDER BY created_at DESC LIMIT 1")
    if not p:
        return None, None
    return p, db.one("SELECT * FROM chains WHERE pass_id=? ORDER BY created_at DESC LIMIT 1", (p["id"],))


def pass_view(p):
    if not p:
        return None
    scopes, budget, task = (db.jload(p["scopes"], []), db.jload(p["budget"], {}),
                            db.jload(p["task"], {}))
    status = p["status"]
    if status == "active" and p["expires_at"] < time.time():
        status = "expired"
    return {"id": p["id"], "agent_id": p["agent_id"], "status": status, "scopes": scopes,
            "budget": budget, "task": task, "risk_policy": db.jload(p["risk_policy"], {}),
            "key_thumbprint": p["jkt"], "created": db.iso(p["created_at"]),
            "expires": db.iso(p["expires_at"]),
            "seconds_left": max(0, int(p["expires_at"] - time.time())),
            "revoked": db.iso(p["revoked_at"]), "revoke_reason": p["revoke_reason"],
            "blast_radius": policy.blast_radius(scopes, budget, task,
                                                max(1, p["expires_at"] - p["created_at"]))}


def unfreeze(chain_id: str):
    chain = db.one("SELECT * FROM chains WHERE id=?", (chain_id,))
    if not chain or chain["state"] != "frozen":
        raise LookupError("chain is not frozen")
    new_tid = crypto.new_id("t", 8)
    db.run("UPDATE tickets SET status='superseded' WHERE tid=? AND status='active'", (chain["current_tid"],))
    db.run("UPDATE chains SET state='active', current_tid=? WHERE id=?", (new_tid, chain_id))
    db.run("INSERT INTO tickets(tid,chain_id,seq,status,issued_at) VALUES(?,?,?,'active',?)",
           (new_tid, chain_id, chain["expected_seq"], time.time()))
    audit.log("CHAIN_UNFROZEN", "INFO", "HUMAN_REAPPROVED", severity="warn", chain_id=chain_id,
              pass_id=chain["pass_id"], detail={"note": "human re-approved after key-holder anomaly"})


def clear_taint(chain_id: str):
    chain = db.one("SELECT * FROM chains WHERE id=?", (chain_id,))
    if not chain:
        raise LookupError("unknown chain")
    db.run("UPDATE chains SET tainted=0, taint_reason=NULL WHERE id=?", (chain_id,))
    audit.log("TAINT_CLEARED", "INFO", "HUMAN_REVIEWED", severity="info", chain_id=chain_id,
              pass_id=chain["pass_id"], detail={"note": "human reviewed the untrusted content"})
