"""Hash-chained audit log + live event bus for the dashboard (Server-Sent Events)."""
import asyncio
import time

from . import crypto, db

GENESIS = "GENESIS"
HASHED_FIELDS = ["ts", "trace_id", "pass_id", "chain_id", "seq", "event_type", "decision",
                 "reason", "severity", "tool", "action", "request_hash", "detail"]


class Bus:
    def __init__(self):
        self.subs = set()
        self.loop = None

    def subscribe(self):
        self.loop = asyncio.get_running_loop()
        q = asyncio.Queue(maxsize=500)
        self.subs.add(q)
        return q

    def unsubscribe(self, q):
        self.subs.discard(q)

    def publish(self, item):
        def _put():
            for q in list(self.subs):
                try:
                    q.put_nowait(item)
                except asyncio.QueueFull:
                    pass
        if self.loop is not None:
            self.loop.call_soon_threadsafe(_put)


bus = Bus()


def _row_to_public(row):
    out = dict(row)
    out["detail"] = db.jload(row.get("detail"), {})
    out["time"] = db.iso(row["ts"])
    return out


def _hash(prev_hash, rec):
    return crypto.sha256_hex(prev_hash + crypto.canonical({k: rec[k] for k in HASHED_FIELDS}))


def log(event_type, decision="INFO", reason="", *, trace_id=None, pass_id=None, chain_id=None,
        seq=None, severity="info", tool=None, action=None, request_hash=None, detail=None):
    with db.tx() as c:
        last = c.execute("SELECT record_hash FROM audit ORDER BY id DESC LIMIT 1").fetchone()
        prev = last["record_hash"] if last else GENESIS
        rec = {
            "ts": time.time(), "trace_id": trace_id, "pass_id": pass_id, "chain_id": chain_id,
            "seq": seq, "event_type": event_type, "decision": decision, "reason": reason,
            "severity": severity, "tool": tool, "action": action, "request_hash": request_hash,
            "detail": db.jdump(detail or {}),
        }
        rh = _hash(prev, rec)
        cur = c.execute(
            "INSERT INTO audit(ts,trace_id,pass_id,chain_id,seq,event_type,decision,reason,"
            "severity,tool,action,request_hash,detail,prev_hash,record_hash) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (rec["ts"], rec["trace_id"], rec["pass_id"], rec["chain_id"], rec["seq"],
             rec["event_type"], rec["decision"], rec["reason"], rec["severity"], rec["tool"],
             rec["action"], rec["request_hash"], rec["detail"], prev, rh))
        rec_id = cur.lastrowid
    row = db.one("SELECT * FROM audit WHERE id=?", (rec_id,))
    pub = _row_to_public(row)
    bus.publish({"kind": "audit", "record": pub})
    return pub


def verify():
    rows = db.q("SELECT * FROM audit ORDER BY id ASC")
    prev = GENESIS
    for i, r in enumerate(rows):
        if r["prev_hash"] != prev or _hash(prev, r) != r["record_hash"]:
            return {"valid": False, "length": len(rows), "checked": i + 1,
                    "first_broken_id": r["id"]}
        prev = r["record_hash"]
    return {"valid": True, "length": len(rows), "checked": len(rows), "first_broken_id": None}


def recent(limit=100, before_id=None, severity=None):
    sql, args = "SELECT * FROM audit", []
    cond = []
    if before_id:
        cond.append("id < ?")
        args.append(before_id)
    if severity:
        cond.append("severity IN (%s)" % ",".join("?" * len(severity)))
        args += severity
    if cond:
        sql += " WHERE " + " AND ".join(cond)
    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    return [_row_to_public(r) for r in db.q(sql, tuple(args))]
