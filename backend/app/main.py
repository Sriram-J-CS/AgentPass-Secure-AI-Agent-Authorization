import base64
import hashlib
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from argon2 import PasswordHasher
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, select, func, update, JSON as SAJSON
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

APP_SECRET = os.getenv("APP_SECRET", "change-me-in-production")
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentpass.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
ph = PasswordHasher()
app = FastAPI(title="AgentPass API", version="1.0.0")

origins = ["*"] if FRONTEND_URL == "*" else [FRONTEND_URL]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    task: Mapped[str] = mapped_column(Text)
    scopes: Mapped[list[str]] = mapped_column(SAJSON, default=list)
    budget_limit: Mapped[float] = mapped_column(Float, default=0)
    budget_used: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    public_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class AgentPass(Base):
    __tablename__ = "agent_passes"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scopes: Mapped[list[str]] = mapped_column(SAJSON, default=list)
    budget_limit: Mapped[float] = mapped_column(Float, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AgentRequest(Base):
    __tablename__ = "agent_requests"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    agent_pass_id: Mapped[str] = mapped_column(ForeignKey("agent_passes.id"), index=True)
    method: Mapped[str] = mapped_column(String(12))
    tool: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(String(80))
    target: Mapped[str] = mapped_column(String(500))
    body: Mapped[dict[str, Any]] = mapped_column(SAJSON, default=dict)
    body_hash: Mapped[str] = mapped_column(String(64))
    nonce: Mapped[str] = mapped_column(String(128), index=True)
    proof_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    scope_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    intent_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    taint_status: Mapped[str] = mapped_column(String(80), default="NONE")
    behavior_score: Mapped[float] = mapped_column(Float, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    decision: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text)
    execution_status: Mapped[str] = mapped_column(String(40), default="NOT_EXECUTED")
    result: Mapped[Optional[dict[str, Any]]] = mapped_column(SAJSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("agent_requests.id"), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class AuthorizationTicket(Base):
    __tablename__ = "authorization_tickets"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("agent_requests.id"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="ISSUED")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class Nonce(Base):
    __tablename__ = "nonces"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(64), index=True)
    nonce: Mapped[str] = mapped_column(String(128), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80))
    request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    agent_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(SAJSON, default=dict)
    previous_hash: Mapped[str] = mapped_column(String(64), default="")
    current_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Secret(Base):
    __tablename__ = "secrets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    nonce: Mapped[str] = mapped_column(String(64))
    ciphertext: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(engine)

class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    task: str = Field(min_length=5, max_length=4000)
    scopes: list[str] = Field(default_factory=list)
    budget_limit: float = Field(default=0, ge=0)
    expires_in_hours: int = Field(default=24, ge=1, le=720)
    public_key: str = Field(min_length=20)

class GatewayRequest(BaseModel):
    agent_id: str
    pass_token: str = Field(min_length=20)
    method: str = Field(default="POST", max_length=12)
    tool: str = Field(default="agentpass", max_length=80)
    action: str = Field(max_length=80)
    target: str = Field(default="internal://agentpass", max_length=500)
    body: dict[str, Any] = Field(default_factory=dict)
    timestamp: int
    nonce: str = Field(min_length=8, max_length=128)
    signature: str = Field(min_length=20)
    taint_source: str = Field(default="NONE", max_length=80)

class SecretCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    value: str = Field(min_length=1, max_length=10000)

def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def issue_session(user_id: int) -> str:
    return jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        APP_SECRET,
        algorithm="HS256",
    )

def current_user(request: Request, session: Session = Depends(db)) -> User:
    token = request.cookies.get("agentpass_session")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        data = jwt.decode(token, APP_SECRET, algorithms=["HS256"])
        user = session.get(User, int(data["sub"]))
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user

def json_default(v: Any):
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)

def stable_body(body: dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), default=json_default)

def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def hash_pass(token: str) -> str:
    return sha256_text(token)

def build_signing_message(pass_id: str, method: str, target: str, body_hash: str, timestamp: int, nonce: str) -> bytes:
    return f"{pass_id}.{method.upper()}.{target}.{body_hash}.{timestamp}.{nonce}".encode()

def verify_signature(public_key_b64: str, signature_b64: str, message: bytes) -> bool:
    try:
        der = base64.b64decode(public_key_b64)
        sig_raw = base64.b64decode(signature_b64)
        if len(sig_raw) != 64:
            return False
        r = int.from_bytes(sig_raw[:32], "big")
        s = int.from_bytes(sig_raw[32:], "big")
        sig_der = utils.encode_dss_signature(r, s)
        key = serialization.load_der_public_key(der)
        key.verify(sig_der, message, ec.ECDSA(hashes.SHA256()))
        return True
    except Exception:
        return False

def audit(session: Session, *, event_type: str, user_id: Optional[int], agent_id: Optional[str], request_id: Optional[str], payload: dict[str, Any]):
    previous = session.scalar(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1))
    previous_hash = previous.current_hash if previous else ""
    canonical = json.dumps(
        {"event_type": event_type, "user_id": user_id, "agent_id": agent_id, "request_id": request_id, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        default=json_default,
    )
    current_hash = sha256_text(previous_hash + canonical)
    event = AuditEvent(
        event_type=event_type,
        user_id=user_id,
        agent_id=agent_id,
        request_id=request_id,
        payload=payload,
        previous_hash=previous_hash,
        current_hash=current_hash,
    )
    session.add(event)
    session.flush()
    return event

class WSManager:
    def __init__(self):
        self.clients: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.clients.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        self.clients.get(user_id, set()).discard(websocket)

    async def send(self, user_id: int, payload: dict[str, Any]):
        for ws in list(self.clients.get(user_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(user_id, ws)

ws_manager = WSManager()

def evaluate_intent(task: str, action: str) -> tuple[bool, str]:
    t = task.lower()
    a = action.upper()
    if a in {"READ_EMAIL", "READ_FILE", "SUMMARIZE"}:
        return (any(k in t for k in ["read", "invoice", "email", "file", "summarize", "analyse", "analyze"]), "Aligned with the assigned task.")
    if a in {"SEND_EMAIL", "DELETE_FILE", "EXPORT_DATA", "CHANGE_CREDENTIAL", "PAYMENT"}:
        if any(k in t for k in ["send", "delete", "export", "payment", "pay", "credential"]):
            return True, "Sensitive action is explicitly represented in the task."
        return False, "Requested action is outside the original human task."
    return True, "No intent contradiction detected."

def behavior_score(session: Session, agent_id: str) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    count = session.scalar(
        select(func.count()).select_from(AgentRequest).where(
            AgentRequest.agent_id == agent_id,
            AgentRequest.created_at >= cutoff,
        )
    ) or 0
    return min(100.0, max(0.0, (count - 3) * 12.5))

def risk_score(*, proof_ok: bool, scope_ok: bool, intent_ok: bool, taint: str, behavior: float, budget_over: bool, action: str) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0
    sensitive = action.upper() in {"SEND_EMAIL", "DELETE_FILE", "EXPORT_DATA", "CHANGE_CREDENTIAL", "PAYMENT"}
    if not proof_ok:
        reasons.append("Invalid proof-of-possession signature")
        return 100.0, reasons
    if not scope_ok:
        score += 45
        reasons.append("Action is outside agent scope")
    if not intent_ok:
        score += 30
        reasons.append("Action conflicts with human task intent")
    if taint != "NONE":
        score += 10
        reasons.append(f"Request carries untrusted influence: {taint}")
    if behavior >= 50:
        score += 15
        reasons.append("Behavior is above the agent's observed baseline")
    if budget_over:
        score += 40
        reasons.append("Budget limit would be exceeded")
    if sensitive:
        score += 25
        reasons.append("Action is classified as sensitive")
    return min(100.0, score), reasons

def execute_internal_tool(session: Session, request: AgentRequest, agent: Agent) -> dict[str, Any]:
    if request.tool != "agentpass":
        return {"status": "CONNECTOR_NOT_CONFIGURED", "detail": "No external connector is configured for this tool."}
    action = request.action.upper()
    if action == "HEALTH_CHECK":
        return {"status": "OK", "service": "AgentPass", "timestamp": datetime.now(timezone.utc).isoformat()}
    if action == "READ_AGENT":
        return {"status": "OK", "agent": {"id": agent.id, "name": agent.name, "task": agent.task, "status": agent.status, "budget_used": agent.budget_used, "budget_limit": agent.budget_limit}}
    if action == "AUDIT_SUMMARY":
        allowed = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == request.user_id, AgentRequest.decision == "ALLOW")) or 0
        denied = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == request.user_id, AgentRequest.decision == "DENY")) or 0
        return {"status": "OK", "allowed": allowed, "denied": denied}
    return {"status": "CONNECTOR_NOT_CONFIGURED", "detail": "This action is reserved for a real connector configured by the deployment owner."}

@app.get("/health")
def health(session: Session = Depends(db)):
    try:
        session.execute(select(func.count()).select_from(User)).scalar()
        return {"status": "ok", "database": "ok", "time": datetime.now(timezone.utc).isoformat()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

@app.post("/api/auth/register")
def register(data: AuthRequest, request: Request, session: Session = Depends(db)):
    existing = session.scalar(select(User).where(User.email == data.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=data.email.lower(), password_hash=ph.hash(data.password))
    session.add(user)
    session.commit()
    token = issue_session(user.id)
    response = {"user": {"id": user.id, "email": user.email}}
    from fastapi.responses import JSONResponse
    out = JSONResponse(response)
    out.set_cookie("agentpass_session", token, httponly=True, secure=request.url.scheme == "https", samesite="lax", max_age=604800)
    return out

@app.post("/api/auth/login")
def login(data: AuthRequest, request: Request, session: Session = Depends(db)):
    user = session.scalar(select(User).where(User.email == data.email.lower()))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        ph.verify(user.password_hash, data.password)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = issue_session(user.id)
    from fastapi.responses import JSONResponse
    out = JSONResponse({"user": {"id": user.id, "email": user.email}})
    out.set_cookie("agentpass_session", token, httponly=True, secure=request.url.scheme == "https", samesite="lax", max_age=604800)
    audit(session, event_type="LOGIN", user_id=user.id, agent_id=None, request_id=None, payload={"email": user.email})
    session.commit()
    return out

@app.post("/api/auth/logout")
def logout(request: Request, user: User = Depends(current_user)):
    from fastapi.responses import JSONResponse
    out = JSONResponse({"ok": True})
    out.delete_cookie("agentpass_session")
    return out

@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"user": {"id": user.id, "email": user.email}}

@app.post("/api/agents")
def create_agent(data: AgentCreate, user: User = Depends(current_user), session: Session = Depends(db)):
    agent_id = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=data.expires_in_hours)
    agent = Agent(
        id=agent_id, owner_id=user.id, name=data.name, task=data.task,
        scopes=data.scopes, budget_limit=data.budget_limit, public_key=data.public_key,
        created_at=now, expires_at=expires,
    )
    raw_pass = "ap_" + secrets.token_urlsafe(32)
    ap = AgentPass(
        id=secrets.token_hex(16), agent_id=agent_id, token_hash=hash_pass(raw_pass),
        scopes=data.scopes, budget_limit=data.budget_limit, expires_at=expires
    )
    session.add_all([agent, ap])
    audit(session, event_type="AGENT_CREATED", user_id=user.id, agent_id=agent.id, request_id=None, payload={"name": agent.name, "scopes": data.scopes, "expires_at": expires.isoformat()})
    session.commit()
    return {"agent": {"id": agent.id, "name": agent.name, "task": agent.task, "scopes": agent.scopes, "budget_limit": agent.budget_limit, "budget_used": agent.budget_used, "status": agent.status, "expires_at": expires.isoformat(), "public_key_registered": True}, "agent_pass_id": ap.id, "agent_pass": raw_pass}

@app.get("/api/agents")
def list_agents(user: User = Depends(current_user), session: Session = Depends(db)):
    agents = session.scalars(select(Agent).where(Agent.owner_id == user.id).order_by(Agent.created_at.desc())).all()
    return {"agents": [serialize_agent(a) for a in agents]}

def serialize_agent(a: Agent):
    return {"id": a.id, "name": a.name, "task": a.task, "scopes": a.scopes, "budget_limit": a.budget_limit, "budget_used": a.budget_used, "status": a.status, "created_at": a.created_at.isoformat(), "expires_at": a.expires_at.isoformat(), "revoked_at": a.revoked_at.isoformat() if a.revoked_at else None}

@app.post("/api/agents/{agent_id}/revoke")
async def revoke_agent(agent_id: str, user: User = Depends(current_user), session: Session = Depends(db)):
    agent = session.scalar(select(Agent).where(Agent.id == agent_id, Agent.owner_id == user.id))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = "REVOKED"
    agent.revoked_at = datetime.now(timezone.utc)
    session.execute(update(AgentPass).where(AgentPass.agent_id == agent.id, AgentPass.status == "ACTIVE").values(status="REVOKED"))
    audit(session, event_type="AGENT_REVOKED", user_id=user.id, agent_id=agent.id, request_id=None, payload={"reason": "User initiated revocation"})
    session.commit()
    await ws_manager.send(user.id, {"type": "agent.revoked", "agent_id": agent.id})
    return {"ok": True}

@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), session: Session = Depends(db)):
    agents = session.scalar(select(func.count()).select_from(Agent).where(Agent.owner_id == user.id, Agent.status == "ACTIVE")) or 0
    today = datetime.now(timezone.utc) - timedelta(days=1)
    req_today = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == user.id, AgentRequest.created_at >= today)) or 0
    allowed = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == user.id, AgentRequest.decision == "ALLOW")) or 0
    denied = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == user.id, AgentRequest.decision == "DENY")) or 0
    stepup = session.scalar(select(func.count()).select_from(AgentRequest).where(AgentRequest.user_id == user.id, AgentRequest.decision == "STEP_UP")) or 0
    security_events = denied + stepup
    active_passes = session.scalar(select(func.count()).select_from(AgentPass).join(Agent, AgentPass.agent_id == Agent.id).where(Agent.owner_id == user.id, AgentPass.status == "ACTIVE", AgentPass.expires_at > datetime.now(timezone.utc))) or 0
    budget_limit = session.scalar(select(func.coalesce(func.sum(Agent.budget_limit), 0)).where(Agent.owner_id == user.id)) or 0
    budget_used = session.scalar(select(func.coalesce(func.sum(Agent.budget_used), 0)).where(Agent.owner_id == user.id)) or 0
    return {"active_agents": agents, "requests_today": req_today, "allowed_actions": allowed, "step_up_requests": stepup, "denied_actions": denied, "active_passes": active_passes, "budget_limit": budget_limit, "budget_used": budget_used, "security_events": security_events}

@app.get("/api/requests")
def requests(limit: int = 50, user: User = Depends(current_user), session: Session = Depends(db)):
    rows = session.scalars(select(AgentRequest).where(AgentRequest.user_id == user.id).order_by(AgentRequest.created_at.desc()).limit(min(limit, 200))).all()
    return {"requests": [serialize_request(r) for r in rows]}

def serialize_request(r: AgentRequest):
    return {"id": r.id, "agent_id": r.agent_id, "method": r.method, "tool": r.tool, "action": r.action, "target": r.target, "proof_valid": r.proof_valid, "scope_ok": r.scope_ok, "intent_ok": r.intent_ok, "taint_status": r.taint_status, "behavior_score": r.behavior_score, "risk_score": r.risk_score, "decision": r.decision, "reason": r.reason, "execution_status": r.execution_status, "result": r.result, "created_at": r.created_at.isoformat()}

@app.post("/api/gateway/requests")
async def gateway_request(data: GatewayRequest, user: User = Depends(current_user), session: Session = Depends(db)):
    agent = session.scalar(select(Agent).where(Agent.id == data.agent_id, Agent.owner_id == user.id))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    now = int(time.time())
    body_hash = sha256_text(stable_body(data.body))
    request_id = secrets.token_hex(16)
    ap = session.scalar(select(AgentPass).where(AgentPass.agent_id == agent.id, AgentPass.token_hash == hash_pass(data.pass_token)))
    hard_reason = None
    if not ap:
        hard_reason = "Invalid AgentPass"
    elif ap.status != "ACTIVE":
        hard_reason = f"AgentPass is {ap.status.lower()}"
    elif ap.expires_at <= datetime.now(timezone.utc):
        ap.status = "EXPIRED"
        hard_reason = "AgentPass expired"
    elif agent.status != "ACTIVE":
        hard_reason = "Agent is revoked or disabled"
    elif abs(now - data.timestamp) > 90:
        hard_reason = "Request timestamp outside allowed window"

    proof_ok = False
    if not hard_reason:
        message = build_signing_message(ap.id, data.method, data.target, body_hash, data.timestamp, data.nonce)
        proof_ok = verify_signature(agent.public_key, data.signature, message)
        if not proof_ok:
            hard_reason = "Invalid proof-of-possession signature"
        elif session.scalar(select(Nonce).where(Nonce.nonce == data.nonce)):
            hard_reason = "Replay detected: nonce already used"
        else:
            session.add(Nonce(agent_id=agent.id, nonce=data.nonce))

    scope_ok = data.action.upper() in set(ap.scopes if ap else agent.scopes)
    intent_ok, intent_reason = evaluate_intent(agent.task, data.action)
    behavior = behavior_score(session, agent.id)
    amount = float(data.body.get("amount", 0) or 0)
    budget_over = agent.budget_used + amount > agent.budget_limit if agent.budget_limit > 0 else False

    if hard_reason:
        risk, reasons = 100.0, [hard_reason]
        decision = "DENY"
    else:
        risk, reasons = risk_score(proof_ok=proof_ok, scope_ok=scope_ok, intent_ok=intent_ok, taint=data.taint_source, behavior=behavior, budget_over=budget_over, action=data.action)
        if not reasons:
            reasons.append(intent_reason)
        decision = "ALLOW" if risk <= 35 else ("STEP_UP" if risk <= 70 else "DENY")

    req = AgentRequest(
        id=request_id, user_id=user.id, agent_id=agent.id, agent_pass_id=ap.id if ap else "",
        method=data.method.upper(), tool=data.tool, action=data.action.upper(), target=data.target,
        body=data.body, body_hash=body_hash, nonce=data.nonce, proof_valid=proof_ok,
        scope_ok=scope_ok, intent_ok=intent_ok, taint_status=data.taint_source, behavior_score=behavior,
        risk_score=risk, decision=decision, reason="; ".join(reasons)
    )

    if decision == "ALLOW":
        result = execute_internal_tool(session, req, agent)
        req.result = result
        req.execution_status = "EXECUTED" if result.get("status") == "OK" else "NOT_EXECUTED"
        if req.execution_status == "EXECUTED":
            agent.budget_used += amount
    elif decision == "STEP_UP":
        session.add(Approval(request_id=request_id, user_id=user.id))
        req.execution_status = "PENDING_APPROVAL"
    else:
        req.execution_status = "BLOCKED"

    session.add(req)
    audit(session, event_type="GATEWAY_DECISION", user_id=user.id, agent_id=agent.id, request_id=req.id, payload={"action": req.action, "decision": decision, "risk": risk, "scope_ok": scope_ok, "intent_ok": intent_ok, "taint": data.taint_source, "behavior_score": behavior})
    session.commit()

    await ws_manager.send(user.id, {"type": "gateway.event", "request": serialize_request(req)})
    return {"request": serialize_request(req)}

@app.get("/api/approvals")
def approvals(user: User = Depends(current_user), session: Session = Depends(db)):
    items = session.execute(
        select(Approval, AgentRequest, Agent).join(AgentRequest, Approval.request_id == AgentRequest.id).join(Agent, AgentRequest.agent_id == Agent.id)
        .where(Approval.user_id == user.id).order_by(Approval.created_at.desc())
    ).all()
    return {"approvals": [{"id": ap.id, "status": ap.status, "created_at": ap.created_at.isoformat(), "request": serialize_request(req), "agent": {"id": ag.id, "name": ag.name}} for ap, req, ag in items]}

async def finalize_approved(request_id: str, user: User, session: Session):
    req = session.get(AgentRequest, request_id)
    if not req or req.user_id != user.id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.decision != "STEP_UP":
        raise HTTPException(status_code=400, detail="Request is not awaiting step-up")
    ticket = session.scalar(select(AuthorizationTicket).where(AuthorizationTicket.request_id == request_id))
    if not ticket:
        ticket = AuthorizationTicket(id=secrets.token_hex(16), request_id=request_id, expires_at=datetime.now(timezone.utc) + timedelta(minutes=2))
        session.add(ticket)
        session.flush()
    result = session.execute(
        update(AuthorizationTicket)
        .where(AuthorizationTicket.id == ticket.id, AuthorizationTicket.status == "ISSUED", AuthorizationTicket.expires_at > datetime.now(timezone.utc))
        .values(status="USED", used_at=datetime.now(timezone.utc))
    )
    if result.rowcount != 1:
        raise HTTPException(status_code=409, detail="Authorization ticket already used or expired")
    agent = session.get(Agent, req.agent_id)
    result_data = execute_internal_tool(session, req, agent)
    req.result = result_data
    req.execution_status = "EXECUTED" if result_data.get("status") == "OK" else "NOT_EXECUTED"
    req.decision = "ALLOW"
    req.reason = req.reason + "; Human approval granted."
    approval = session.scalar(select(Approval).where(Approval.request_id == req.id))
    approval.status = "APPROVED"
    approval.decided_at = datetime.now(timezone.utc)
    amount = float(req.body.get("amount", 0) or 0)
    if req.execution_status == "EXECUTED":
        agent.budget_used += amount
    audit(session, event_type="STEP_UP_APPROVED", user_id=user.id, agent_id=req.agent_id, request_id=req.id, payload={"ticket_id": ticket.id, "execution_status": req.execution_status})
    session.commit()
    return serialize_request(req)

@app.post("/api/approvals/{approval_id}/approve")
async def approve(approval_id: int, user: User = Depends(current_user), session: Session = Depends(db)):
    approval = session.get(Approval, approval_id)
    if not approval or approval.user_id != user.id or approval.status != "PENDING":
        raise HTTPException(status_code=404, detail="Pending approval not found")
    result = await finalize_approved(approval.request_id, user, session)
    await ws_manager.send(user.id, {"type": "approval.updated", "request": result})
    return {"request": result}

@app.post("/api/approvals/{approval_id}/deny")
async def deny(approval_id: int, user: User = Depends(current_user), session: Session = Depends(db)):
    approval = session.get(Approval, approval_id)
    if not approval or approval.user_id != user.id or approval.status != "PENDING":
        raise HTTPException(status_code=404, detail="Pending approval not found")
    approval.status = "DENIED"
    approval.decided_at = datetime.now(timezone.utc)
    req = session.get(AgentRequest, approval.request_id)
    req.decision = "DENY"
    req.execution_status = "BLOCKED"
    audit(session, event_type="STEP_UP_DENIED", user_id=user.id, agent_id=req.agent_id, request_id=req.id, payload={"approval_id": approval.id})
    session.commit()
    await ws_manager.send(user.id, {"type": "approval.updated", "request": serialize_request(req)})
    return {"request": serialize_request(req)}

@app.get("/api/audit")
def audit_log(limit: int = 100, user: User = Depends(current_user), session: Session = Depends(db)):
    rows = session.scalars(select(AuditEvent).where(AuditEvent.user_id == user.id).order_by(AuditEvent.id.desc()).limit(min(limit, 200))).all()
    return {"events": [{"id": e.id, "event_type": e.event_type, "request_id": e.request_id, "agent_id": e.agent_id, "payload": e.payload, "previous_hash": e.previous_hash, "current_hash": e.current_hash, "created_at": e.created_at.isoformat()} for e in rows]}

@app.get("/api/vault/secrets")
def list_secrets(user: User = Depends(current_user), session: Session = Depends(db)):
    rows = session.scalars(select(Secret).where(Secret.owner_id == user.id).order_by(Secret.created_at.desc())).all()
    return {"secrets": [{"id": s.id, "name": s.name, "created_at": s.created_at.isoformat()} for s in rows]}

@app.post("/api/vault/secrets")
def create_secret(data: SecretCreate, user: User = Depends(current_user), session: Session = Depends(db)):
    key_raw = os.getenv("VAULT_MASTER_KEY")
    if not key_raw:
        raise HTTPException(status_code=503, detail="Vault is not configured: VAULT_MASTER_KEY is missing")
    try:
        key = base64.urlsafe_b64decode(key_raw + "===")
        if len(key) != 32:
            raise ValueError
    except Exception:
        raise HTTPException(status_code=500, detail="VAULT_MASTER_KEY must be base64url-encoded 32 bytes")
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(key).encrypt(nonce, data.value.encode(), data.name.encode())
    record = Secret(owner_id=user.id, name=data.name, nonce=base64.urlsafe_b64encode(nonce).decode(), ciphertext=base64.urlsafe_b64encode(ciphertext).decode())
    session.add(record)
    audit(session, event_type="SECRET_STORED", user_id=user.id, agent_id=None, request_id=None, payload={"name": data.name})
    session.commit()
    return {"id": record.id, "name": record.name, "stored": True}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.cookies.get("agentpass_session")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        data = jwt.decode(token, APP_SECRET, algorithms=["HS256"])
        user_id = int(data["sub"])
    except Exception:
        await websocket.close(code=4401)
        return
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
