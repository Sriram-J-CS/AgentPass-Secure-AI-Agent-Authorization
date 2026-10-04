"""Encrypted key vault (AES-256-GCM) + response scrubber.

Real API keys live here and nowhere else. The agent and the sidecar never see them.
In production the master key would come from a cloud KMS / HSM.
"""
import base64
import os
import secrets
import time
import urllib.parse

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from . import config, crypto, db

SECRET_NAMES = ["EMAIL_API_KEY", "PAY_API_KEY", "FILES_API_KEY"]


def _master() -> bytes:
    env = os.environ.get("AGENTPASS_MASTER_KEY")
    if env:
        return base64.b64decode(env)
    path = config.DATA / "master.key"
    if path.exists():
        return base64.b64decode(path.read_text())
    key = AESGCM.generate_key(bit_length=256)
    path.write_text(base64.b64encode(key).decode())
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return key


def _store(name: str, value: str):
    nonce = secrets.token_bytes(12)
    ct = AESGCM(_master()).encrypt(nonce, value.encode(), name.encode())  # name bound as AAD
    db.run("INSERT OR REPLACE INTO secrets(name,ciphertext,nonce,fingerprint,created_at,uses,last_used)"
           " VALUES(?,?,?,?,?,0,NULL)",
           (name, ct, nonce, crypto.sha256_hex(value)[:12], time.time()))


def seed():
    """Create any missing secrets with fresh random values (stand-ins for real provider keys)."""
    for name in SECRET_NAMES:
        if not db.one("SELECT name FROM secrets WHERE name=?", (name,)):
            _store(name, "sk_live_" + secrets.token_urlsafe(24))


def reveal(name: str, count: bool = True) -> str:
    row = db.one("SELECT * FROM secrets WHERE name=?", (name,))
    if not row:
        raise KeyError(name)
    value = AESGCM(_master()).decrypt(bytes(row["nonce"]), bytes(row["ciphertext"]), name.encode())
    if count:
        db.run("UPDATE secrets SET uses=uses+1, last_used=? WHERE name=?", (time.time(), name))
    return value.decode()


def summary():
    """Safe view of the vault: names, fingerprints, usage. Never the values."""
    rows = db.q("SELECT name,fingerprint,created_at,uses,last_used FROM secrets ORDER BY name")
    return [{"name": r["name"], "fingerprint": r["fingerprint"], "uses": r["uses"],
             "created": db.iso(r["created_at"]), "last_used": db.iso(r["last_used"]),
             "stored": "AES-256-GCM encrypted", "exposed_to_agent": False} for r in rows]


def scrub(text: str, secret_values) -> (str, int):
    """Replace any occurrence of a secret (raw, URL-encoded, base64) with [REDACTED]."""
    count = 0
    for s in secret_values:
        variants = {s, urllib.parse.quote(s), base64.b64encode(s.encode()).decode(),
                    base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")}
        for v in variants:
            if v and v in text:
                count += text.count(v)
                text = text.replace(v, "[REDACTED]")
    return text, count
