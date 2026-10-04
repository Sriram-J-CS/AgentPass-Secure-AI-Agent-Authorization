"""Runtime policy: scope, intent, budget, canary, behavior, taint, risk -> ALLOW / STEP_UP / DENY.
Pure, deterministic rules (no ML) so every decision can be explained."""
import time

from . import config, db, world

POLICY = {
    "tools": {
        "email": {"secret": "EMAIL_API_KEY", "auth_header": "x-api-key", "actions": {
            "email:read": {"risk": "low", "method": "GET", "path": "/email/inbox",
                           "untrusted_output": True,
                           "description": "Read the inbox (content may be untrusted)"},
            "email:send": {"risk": "medium", "method": "POST", "path": "/email/send",
                           "description": "Send an email"}}},
        "pay": {"secret": "PAY_API_KEY", "auth_header": "x-api-key", "actions": {
            "pay:create": {"risk": "high", "method": "POST", "path": "/pay/create",
                           "description": "Create a payment"}}},
        "files": {"secret": "FILES_API_KEY", "auth_header": "x-api-key", "actions": {
            "files:read": {"risk": "low", "method": "GET", "path": "/files/list",
                           "description": "List files"},
            "files:open": {"risk": "low", "method": "GET", "path": "/files/read/{id}",
                           "description": "Open one file"},
            "files:delete": {"risk": "high", "method": "DELETE", "path": "/files/{id}",
                             "description": "Delete a file"}}},
        "diagnostics": {"secret": "EMAIL_API_KEY", "auth_header": "x-api-key", "actions": {
            "diagnostics:echo": {"risk": "low", "method": "GET", "path": "/diagnostics/echo",
                                 "description": "Echo request headers (leaky tool, for scrubber demo)"}}},
    },
    "thresholds": {"behavior_step_up": config.STEP_UP_SCORE, "behavior_deny": config.DENY_SCORE,
                   "ticket_ttl_seconds": config.TICKET_TTL_SECONDS,
                   "proof_window_seconds": config.PROOF_WINDOW_SECONDS,
                   "approval_ttl_seconds": config.APPROVAL_TTL_SECONDS,
                   "unknown_action_risk": "high"},
}

# Default delegation requested by the demo agent (note: files:delete is NOT granted).
DEFAULT_REQUEST = {
    "agent_id": "invoice-assistant",
    "scopes": ["email:read", "email:send", "pay:create", "files:read", "files:open",
               "diagnostics:echo"],
    "budget": {"email:send": {"limit": 5, "window_seconds": 3600},
               "pay:create": {"max_total": 500, "currency": "INR"}},
    "task": {"purpose": "Summarize invoices and pay approved vendor invoices up to INR 500",
             "allowed_recipient_domains": ["company.com"],
             "allowed_payees": ["acct_vendor_1", "acct_vendor_2"],
             "max_payment": 500},
    "ttl_seconds": config.PASS_TTL_SECONDS,
}


def action_cfg(tool, action):
    t = POLICY["tools"].get(tool)
    if not t:
        return None, None
    return t, t["actions"].get(action)


def risk_policy_for(scopes):
    out = {}
    for t in POLICY["tools"].values():
        for a, cfg in t["actions"].items():
            if a in scopes:
                out[a] = cfg["risk"]
    return out


def blast_radius(scopes, budget, task, ttl_seconds):
    """Plain-language worst case shown to the human before approving a pass."""
    can, cannot = [], []
    if "email:read" in scopes:
        can.append("read the inbox (treated as untrusted content)")
    if "email:send" in scopes:
        b = budget.get("email:send", {})
        doms = ", ".join(task.get("allowed_recipient_domains", [])) or "approved domains"
        can.append(f"send up to {b.get('limit', '?')} emails per hour to {doms}")
    if "pay:create" in scopes:
        b = budget.get("pay:create", {})
        can.append(f"create payments up to {b.get('currency', 'INR')} {b.get('max_total', '?')} total, "
                   f"each one needs your approval")
    if "files:read" in scopes or "files:open" in scopes:
        can.append("list and open files")
    if "files:delete" not in scopes:
        cannot.append("delete files")
    if "email:send" not in scopes:
        cannot.append("send email")
    if "pay:create" not in scopes:
        cannot.append("move money")
    return {"can": can, "cannot": cannot, "expires_in_minutes": round(ttl_seconds / 60, 1),
            "max_money": budget.get("pay:create", {}).get("max_total", 0),
            "max_emails_per_hour": budget.get("email:send", {}).get("limit", 0)}


# ---------------- budgets ----------------
def _budget_row(pass_id, key):
    return db.one("SELECT * FROM budgets WHERE pass_id=? AND key=?", (pass_id, key))


def budget_usage(pass_id, budget):
    now = time.time()
    out = {}
    e = budget.get("email:send")
    if e:
        row = _budget_row(pass_id, "email:send")
        used = row["amount"] if row and now - row["window_start"] < e["window_seconds"] else 0
        out["email:send"] = {"used": int(used), "limit": e["limit"],
                             "window_seconds": e["window_seconds"], "unit": "emails"}
    p = budget.get("pay:create")
    if p:
        row = _budget_row(pass_id, "pay:create")
        used = row["amount"] if row else 0
        out["pay:create"] = {"used": used, "limit": p["max_total"], "unit": p.get("currency", "INR")}
    return out


def check_budget(pass_id, action, params, budget):
    usage = budget_usage(pass_id, budget)
    if action == "email:send" and "email:send" in usage:
        u = usage["email:send"]
        if u["used"] + 1 > u["limit"]:
            return False, "BUDGET_EXCEEDED", {"budget": "email:send", **u}
    if action == "pay:create" and "pay:create" in usage:
        u = usage["pay:create"]
        amount = float(params.get("amount", 0))
        if u["used"] + amount > u["limit"]:
            return False, "BUDGET_EXCEEDED", {"budget": "pay:create", "requested": amount, **u}
    return True, None, {}


def consume_budget(pass_id, action, params):
    now = time.time()
    if action == "email:send":
        row = _budget_row(pass_id, "email:send")
        pas = db.one("SELECT budget FROM passes WHERE id=?", (pass_id,))
        window = db.jload(pas["budget"], {}).get("email:send", {}).get("window_seconds", 3600)
        if not row or now - row["window_start"] >= window:
            db.run("INSERT OR REPLACE INTO budgets(pass_id,key,window_start,amount) VALUES(?,?,?,1)",
                   (pass_id, "email:send", now))
        else:
            db.run("UPDATE budgets SET amount=amount+1 WHERE pass_id=? AND key=?",
                   (pass_id, "email:send"))
    if action == "pay:create":
        amount = float(params.get("amount", 0))
        if not _budget_row(pass_id, "pay:create"):
            db.run("INSERT INTO budgets(pass_id,key,window_start,amount) VALUES(?,?,?,?)",
                   (pass_id, "pay:create", now, amount))
        else:
            db.run("UPDATE budgets SET amount=amount+? WHERE pass_id=? AND key=?",
                   (amount, pass_id, "pay:create"))


# ---------------- behavior twin ----------------
def behavior(pass_id, action, params):
    now = time.time()
    rows = db.q("SELECT ts,decision FROM audit WHERE pass_id=? AND event_type IN "
                "('CALL_ALLOWED','CALL_DENIED','CALL_PENDING_APPROVAL') AND ts>?",
                (pass_id, now - 120))
    last_min = [r for r in rows if r["ts"] > now - 60]
    denials = [r for r in rows if r["decision"] == "DENY"]
    breakdown, score = [], 0

    if len(last_min) > 8:
        score += 40
        breakdown.append({"signal": "high_request_rate", "points": 40,
                          "why": f"{len(last_min)} requests in the last 60s"})
    elif len(last_min) > 5:
        score += 20
        breakdown.append({"signal": "elevated_request_rate", "points": 20,
                          "why": f"{len(last_min)} requests in the last 60s"})
    if action == "files:read" and int(params.get("limit", 0) or 0) > 100:
        score += 70
        breakdown.append({"signal": "bulk_data_access", "points": 70,
                          "why": f"asked for {params.get('limit')} files at once (normal is <= 100)"})
    if len(denials) >= 2:
        score += 30
        breakdown.append({"signal": "probing_after_denials", "points": 30,
                          "why": f"{len(denials)} denied requests in the last 120s"})
    return min(score, 100), breakdown


# ---------------- intent + decision ----------------
def intent_check(task, action, params):
    if action == "email:send":
        to = str(params.get("to", ""))
        domain = to.split("@")[-1].lower() if "@" in to else ""
        if domain not in [d.lower() for d in task.get("allowed_recipient_domains", [])]:
            return False, "INTENT_VIOLATION", {"why": "recipient_not_authorized", "recipient": to}
    if action == "pay:create":
        payee = str(params.get("payee", ""))
        amount = float(params.get("amount", 0))
        if payee not in task.get("allowed_payees", []):
            return False, "INTENT_VIOLATION", {"why": "payee_not_authorized", "payee": payee}
        if amount > task.get("max_payment", 0):
            return False, "INTENT_VIOLATION", {"why": "amount_exceeds_task_limit", "amount": amount,
                                              "task_limit": task.get("max_payment")}
    return True, None, {}


def canary_hit(action, params):
    if action == "files:open":
        row = db.one("SELECT canary,name FROM files WHERE id=?", (int(params.get("id", -1)),))
        if row and row["canary"]:
            return row["name"]
    for v in params.values():
        if isinstance(v, str) and world.CANARY_MARKER in v:
            return "canary token in parameters"
    return None


def evaluate(pass_row, chain_row, tool, action, params, risk):
    """Return the decision for one request that already passed identity checks."""
    scopes = db.jload(pass_row["scopes"], [])
    budget = db.jload(pass_row["budget"], {})
    task = db.jload(pass_row["task"], {})
    tainted = bool(chain_row["tainted"])
    score, breakdown = behavior(pass_row["id"], action, params)
    base = {"risk": risk, "tainted": tainted, "behavior_score": score,
            "behavior_breakdown": breakdown}

    def deny(code, alert, detail=None, severity="warn", revoke=False):
        return {**base, "decision": "DENY", "reason": code, "alert": alert, "severity": severity,
                "revoke": revoke, "detail": detail or {}}

    if action not in scopes:
        return deny("SCOPE_DENIED", "SCOPE_VIOLATION", {"action": action}, "high")
    hit = canary_hit(action, params)
    if hit:
        return deny("CANARY_TRIPPED", "CANARY_TRIPPED", {"canary": hit}, "critical", revoke=True)
    ok, code, detail = intent_check(task, action, params)
    if not ok:
        return deny(code, "INTENT_VIOLATION", detail, "high")
    ok, code, detail = check_budget(pass_row["id"], action, params, budget)
    if not ok:
        return deny(code, "BUDGET_VIOLATION", detail, "warn")
    if score >= config.DENY_SCORE:
        return deny("BEHAVIOR_ANOMALY", "BEHAVIOR_ANOMALY", {}, "high")

    reasons = []
    if risk == "high":
        reasons.append("HIGH_RISK_ACTION")
    if tainted and risk in ("medium", "high"):
        reasons.append("TAINTED_CONTEXT")
    if score >= config.STEP_UP_SCORE:
        reasons.append("BEHAVIOR_SCORE_HIGH")
    if reasons:
        return {**base, "decision": "STEP_UP", "reason": reasons[0], "reasons": reasons,
                "alert": None, "severity": "warn", "revoke": False, "detail": {}}
    return {**base, "decision": "ALLOW", "reason": "OK", "reasons": [], "alert": None,
            "severity": "info", "revoke": False, "detail": {}}
