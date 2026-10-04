"""Cryptographic helpers shared by the gateway, sidecar and attacker simulator."""
import base64
import hashlib
import json
import secrets
import time

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from . import config

NO_TIME_CHECKS = {
    "verify_signature": True,
    "verify_exp": False,
    "verify_iat": False,
    "verify_nbf": False,
    "verify_aud": False,
}


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64u_dec(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def canonical(obj) -> str:
    """Stable JSON: sorted keys, no spaces. Same data always hashes the same."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(data) -> str:
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


def sha256_b64u(data) -> str:
    if isinstance(data, str):
        data = data.encode()
    return b64u(hashlib.sha256(data).digest())


def new_id(prefix: str, n: int = 8) -> str:
    return f"{prefix}_{secrets.token_hex(n)}"


# ---------- EC keys (P-256) ----------
def new_ec_key():
    return ec.generate_private_key(ec.SECP256R1())


def public_jwk(private_key) -> dict:
    nums = private_key.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64u(nums.x.to_bytes(32, "big")),
        "y": b64u(nums.y.to_bytes(32, "big")),
    }


def jwk_thumbprint(jwk: dict) -> str:
    """RFC 7638 thumbprint of an EC public key."""
    core = {"crv": jwk["crv"], "kty": jwk["kty"], "x": jwk["x"], "y": jwk["y"]}
    return sha256_b64u(canonical(core))


def jwk_to_public_key(jwk: dict):
    if jwk.get("kty") != "EC" or jwk.get("crv") != "P-256" or "d" in jwk:
        raise ValueError("unsupported or private JWK")
    nums = ec.EllipticCurvePublicNumbers(
        int.from_bytes(b64u_dec(jwk["x"]), "big"),
        int.from_bytes(b64u_dec(jwk["y"]), "big"),
        ec.SECP256R1(),
    )
    return nums.public_key()


# ---------- gateway ticket-signing key (persisted so tickets survive restarts) ----------
_gateway_key = None


def gateway_key():
    global _gateway_key
    if _gateway_key is None:
        path = config.DATA / "gateway_ticket_key.pem"
        if path.exists():
            _gateway_key = serialization.load_pem_private_key(path.read_bytes(), password=None)
        else:
            _gateway_key = new_ec_key()
            path.write_bytes(
                _gateway_key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                )
            )
            try:
                path.chmod(0o600)
            except OSError:
                pass
    return _gateway_key


def mint_ticket(*, tid: str, chain: str, seq: int, pass_id: str, jkt: str,
                ttl: int = None, rh: str = None) -> str:
    now = int(time.time())
    claims = {
        "iss": "agentpass-gateway",
        "tid": tid,
        "chain": chain,
        "seq": seq,
        "pass": pass_id,
        "cnf": {"jkt": jkt},
        "iat": now,
        "exp": now + (ttl or config.TICKET_TTL_SECONDS),
    }
    if rh:
        claims["rh"] = rh
    return jwt.encode(claims, gateway_key(), algorithm="ES256",
                      headers={"typ": "agp-ticket+jwt", "kid": "gw-1"})


def decode_ticket(token: str) -> dict:
    return jwt.decode(token, gateway_key().public_key(), algorithms=["ES256"],
                      options=NO_TIME_CHECKS)


# ---------- DPoP-style proof ----------
def build_proof(private_key, jwk: dict, *, htm: str, htu: str, body: bytes = b"",
                ticket: str = None, rid: str = None, extra: dict = None,
                iat_offset: int = 0) -> str:
    claims = {
        "jti": secrets.token_urlsafe(16),
        "htm": htm,
        "htu": htu,
        "iat": int(time.time()) + iat_offset,
        "bdh": sha256_b64u(body),
    }
    if ticket:
        claims["ath"] = sha256_b64u(ticket)
    if rid:
        claims["rid"] = rid
    if extra:
        claims.update(extra)
    return jwt.encode(claims, private_key, algorithm="ES256",
                      headers={"typ": "dpop+jwt", "jwk": jwk})


def read_proof(proof: str):
    """Return (jwk, claims) after verifying the proof against the JWK in its own header."""
    header = jwt.get_unverified_header(proof)
    if header.get("typ") != "dpop+jwt" or header.get("alg") != "ES256":
        raise ValueError("bad proof header")
    jwk = header["jwk"]
    claims = jwt.decode(proof, jwk_to_public_key(jwk), algorithms=["ES256"],
                        options=NO_TIME_CHECKS)
    return jwk, claims
