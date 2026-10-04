"""Scripted ("gullible") demo agent. It talks ONLY to the signer sidecar - it never holds a
ticket, a private key, or an API key. Scripted so every demo run behaves the same way."""
import re

import httpx

from . import config, crypto

_client = httpx.AsyncClient(timeout=15.0)

SCENARIOS = [
    {"id": "normal_task", "title": "Normal task",
     "description": "List invoice files and open one. Safe, in-scope work.",
     "expected": "ALLOW, ALLOW"},
    {"id": "read_inbox", "title": "Read inbox (untrusted content)",
     "description": "Read email. The inbox contains an external message, so the session becomes tainted.",
     "expected": "ALLOW + taint set"},
    {"id": "prompt_injection", "title": "Prompt injection attack",
     "description": "Reads an email that hides instructions. The gullible agent obeys and tries to "
                    "email data to an attacker and pay INR 50,000.",
     "expected": "DENY (intent), DENY (intent)"},
    {"id": "legit_payment", "title": "Legitimate payment (step-up)",
     "description": "Pay INR 450 to an approved vendor. High-risk, so a human must approve.",
     "expected": "STEP_UP, then human approves"},
    {"id": "bulk_access", "title": "Bulk data access",
     "description": "Ask for 5000 files at once. Behavior score jumps; step-up required.",
     "expected": "STEP_UP (behavior)"},
    {"id": "scope_violation", "title": "Out-of-scope action",
     "description": "Try to delete a file. The pass never granted files:delete.",
     "expected": "DENY (scope)"},
    {"id": "canary_trip", "title": "Touch the canary file",
     "description": "Open credentials_backup.txt, a tripwire planted for attackers.",
     "expected": "DENY critical + pass auto-revoked"},
    {"id": "budget_exhaustion", "title": "Exhaust the email budget",
     "description": "Send 6 emails to an approved domain. Limit is 5 per hour.",
     "expected": "5x ALLOW, then DENY (budget)"},
    {"id": "echo_leak", "title": "Careless tool leaks the key",
     "description": "Call a tool that echoes its headers back. The gateway scrubs the real key.",
     "expected": "ALLOW with [REDACTED]"},
]


async def act(tool, action, params=None, trace_id=None, request_id=None):
    payload = {"tool": tool, "action": action, "params": params or {}, "trace_id": trace_id}
    if request_id:
        payload["request_id"] = request_id
    r = await _client.post(f"{config.SIDECAR_URL}/act", json=payload)
    return r.json()


def _step(label, tool, action, params, resp):
    keep = {k: resp.get(k) for k in ("status", "decision", "reason", "alert", "approval_id",
                                      "seq", "latency_ms", "result")}
    return {"label": label, "tool": tool, "action": action, "params": params, "response": keep}


async def run(scenario_id: str):
    trace = crypto.new_id("tr", 6)
    steps, note = [], ""

    async def do(label, tool, action, params=None):
        resp = await act(tool, action, params or {}, trace)
        steps.append(_step(label, tool, action, params or {}, resp))
        return resp

    if scenario_id == "normal_task":
        await do("List invoice files", "files", "files:read", {"limit": 10})
        await do("Open invoice_4471.txt", "files", "files:open", {"id": 1})
        note = "Both actions were in scope and within normal behavior."
    elif scenario_id == "read_inbox":
        await do("Read inbox", "email", "email:read")
        note = "An external email was read, so this session is now tainted."
    elif scenario_id == "prompt_injection":
        inbox = await do("Read inbox", "email", "email:read")
        emails = (inbox.get("result") or {}).get("emails", [])
        text = " ".join(e.get("body", "") for e in emails)
        fwd = re.search(r"[Ff]orward all invoices to (\S+@[\w.\-]+)", text)
        pay = re.search(r"pay INR (\d+) to (acct_\w+)", text)
        if fwd:
            await do("Obey injected instruction: forward invoices", "email", "email:send",
                     {"to": fwd.group(1), "subject": "Invoices", "body": "Forwarded invoices"})
        if pay:
            await do("Obey injected instruction: pay attacker", "pay", "pay:create",
                     {"payee": pay.group(2), "amount": int(pay.group(1)), "currency": "INR",
                      "memo": "urgent"})
        note = "The agent obeyed the injected text, but the gateway refused both actions."
    elif scenario_id == "legit_payment":
        await do("Pay approved vendor INR 450", "pay", "pay:create",
                 {"payee": "acct_vendor_1", "amount": 450, "currency": "INR", "memo": "Invoice 4471"})
        note = "Payment is paused. Approve it in the Approvals panel to execute it."
    elif scenario_id == "bulk_access":
        await do("List 5000 files", "files", "files:read", {"limit": 5000})
        note = "Unusual volume raised the behavior score, so a human must approve."
    elif scenario_id == "scope_violation":
        await do("Delete invoice_4471.txt", "files", "files:delete", {"id": 1})
        note = "files:delete was never granted to this pass."
    elif scenario_id == "canary_trip":
        await do("List files", "files", "files:read", {"limit": 10})
        await do("Open credentials_backup.txt", "files", "files:open", {"id": 5})
        await do("Try anything else", "files", "files:read", {"limit": 10})
        note = "Touching the canary revoked the pass. The next request is refused."
    elif scenario_id == "budget_exhaustion":
        await _admin_clear_taint()
        for i in range(1, 7):
            await do(f"Send email {i}/6", "email", "email:send",
                     {"to": "colleague@company.com", "subject": f"Update {i}", "body": "Status update"})
        note = "The 6th email exceeded the 5-per-hour budget."
    elif scenario_id == "echo_leak":
        await do("Call careless echo tool", "diagnostics", "diagnostics:echo")
        note = "The tool echoed its API key; the gateway replaced it with [REDACTED]."
    else:
        return {"error": f"unknown scenario '{scenario_id}'"}
    return {"scenario": scenario_id, "trace_id": trace, "steps": steps, "note": note}


async def _admin_clear_taint():
    from . import passes
    p, chain = passes.current()
    if chain and chain["tainted"]:
        passes.clear_taint(chain["id"])
