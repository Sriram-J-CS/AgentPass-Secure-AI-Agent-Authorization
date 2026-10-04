"""SQLite storage. One shared connection guarded by a lock; WAL mode."""
import json
import sqlite3
import threading
import time
from contextlib import contextmanager

from . import config

_lock = threading.RLock()
_conn = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS pass_requests(
  id TEXT PRIMARY KEY, agent_id TEXT, public_jwk TEXT, jkt TEXT, scopes TEXT, budget TEXT,
  task TEXT, ttl_seconds INTEGER, status TEXT, created_at REAL, decided_at REAL, pass_id TEXT,
  claimed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS passes(
  id TEXT PRIMARY KEY, agent_id TEXT, jkt TEXT, public_jwk TEXT, scopes TEXT, budget TEXT,
  task TEXT, risk_policy TEXT, status TEXT, created_at REAL, expires_at REAL,
  revoked_at REAL, revoke_reason TEXT);
CREATE TABLE IF NOT EXISTS chains(
  id TEXT PRIMARY KEY, pass_id TEXT, state TEXT, expected_seq INTEGER, current_tid TEXT,
  last_burned_tid TEXT, tainted INTEGER DEFAULT 0, taint_reason TEXT, created_at REAL);
CREATE TABLE IF NOT EXISTS tickets(
  tid TEXT PRIMARY KEY, chain_id TEXT, seq INTEGER, status TEXT, issued_at REAL,
  burned_at REAL, burned_rid TEXT, outcome TEXT, summary TEXT);
CREATE TABLE IF NOT EXISTS nonces(jti TEXT PRIMARY KEY, seen_at REAL);
CREATE TABLE IF NOT EXISTS responses(
  chain_id TEXT, rid TEXT, body_hash TEXT, response TEXT, created_at REAL,
  PRIMARY KEY(chain_id, rid));
CREATE TABLE IF NOT EXISTS secrets(
  name TEXT PRIMARY KEY, ciphertext BLOB, nonce BLOB, fingerprint TEXT, created_at REAL,
  uses INTEGER DEFAULT 0, last_used REAL);
CREATE TABLE IF NOT EXISTS budgets(
  pass_id TEXT, key TEXT, window_start REAL, amount REAL, PRIMARY KEY(pass_id, key));
CREATE TABLE IF NOT EXISTS approvals(
  id TEXT PRIMARY KEY, pass_id TEXT, chain_id TEXT, seq INTEGER, tool TEXT, action TEXT,
  params TEXT, request_hash TEXT, status TEXT, created_at REAL, expires_at REAL,
  decided_at REAL, result TEXT, trace_id TEXT, reasons TEXT);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, trace_id TEXT, pass_id TEXT, chain_id TEXT,
  seq INTEGER, event_type TEXT, decision TEXT, reason TEXT, severity TEXT, tool TEXT,
  action TEXT, request_hash TEXT, detail TEXT, prev_hash TEXT, record_hash TEXT);
CREATE TABLE IF NOT EXISTS emails(
  id INTEGER PRIMARY KEY, sender TEXT, subject TEXT, body TEXT, external INTEGER);
CREATE TABLE IF NOT EXISTS sent_emails(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, to_addr TEXT, subject TEXT, body TEXT);
CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, payee TEXT, amount REAL, currency TEXT,
  memo TEXT, ref TEXT);
CREATE TABLE IF NOT EXISTS files(
  id INTEGER PRIMARY KEY, name TEXT, content TEXT, canary INTEGER DEFAULT 0);
"""

ALL_TABLES = ["pass_requests", "passes", "chains", "tickets", "nonces", "responses",
              "budgets", "approvals", "audit", "emails", "sent_emails", "payments", "files"]


def conn():
    global _conn
    with _lock:
        if _conn is None:
            c = sqlite3.connect(str(config.DB_PATH), check_same_thread=False, isolation_level=None)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("PRAGMA synchronous=NORMAL")
            c.executescript(SCHEMA)
            _conn = c
        return _conn


def q(sql, args=()):
    with _lock:
        return [dict(r) for r in conn().execute(sql, args).fetchall()]


def one(sql, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def run(sql, args=()):
    with _lock:
        return conn().execute(sql, args)


@contextmanager
def tx():
    with _lock:
        c = conn()
        c.execute("BEGIN IMMEDIATE")
        try:
            yield c
            c.execute("COMMIT")
        except Exception:
            c.execute("ROLLBACK")
            raise


def jdump(obj):
    return json.dumps(obj, separators=(",", ":"), sort_keys=True)


def jload(s, default=None):
    if s is None:
        return default
    try:
        return json.loads(s)
    except (TypeError, ValueError):
        return default


def iso(ts):
    if ts is None:
        return None
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ts)) + f".{int((ts % 1) * 1000):03d}Z"


def wipe_state():
    """Delete all runtime data (keeps nothing). Vault and mock world are re-seeded by callers."""
    with _lock:
        c = conn()
        for t in ALL_TABLES + ["secrets"]:
            c.execute(f"DELETE FROM {t}")
        try:
            c.execute("DELETE FROM sqlite_sequence")
        except sqlite3.OperationalError:
            pass
