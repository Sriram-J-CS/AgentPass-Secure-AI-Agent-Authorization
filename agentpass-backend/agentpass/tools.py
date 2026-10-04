"""Mock tools (email, files, payments). They accept requests ONLY with the real API key,
which exists only inside the vault - so nothing can reach them except through the gateway."""
import hmac
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from . import audit, crypto, db, vault

router = APIRouter(prefix="/tools")

TOOL_SECRET = {"email": "EMAIL_API_KEY", "pay": "PAY_API_KEY", "files": "FILES_API_KEY",
               "diagnostics": "EMAIL_API_KEY"}


def require_key(tool: str):
    async def dep(request: Request):
        supplied = request.headers.get("x-api-key", "")
        expected = vault.reveal(TOOL_SECRET[tool], count=False)
        if not hmac.compare_digest(supplied.encode(), expected.encode()):
            audit.log("TOOL_DIRECT_ACCESS_DENIED", "DENY", "INVALID_TOOL_KEY", severity="high",
                      tool=tool, detail={"alert": "TOOL_BYPASS_ATTEMPT",
                                         "path": request.url.path,
                                         "key_supplied": bool(supplied)})
            raise HTTPException(status_code=401, detail="invalid or missing tool API key")
    return dep


class SendEmail(BaseModel):
    to: str
    subject: str = ""
    body: str = ""


class Payment(BaseModel):
    payee: str
    amount: float
    currency: str = "INR"
    memo: str = ""


@router.get("/email/inbox", dependencies=[Depends(require_key("email"))])
async def inbox():
    return {"emails": db.q("SELECT id,sender,subject,body,external FROM emails ORDER BY id")}


@router.post("/email/send", dependencies=[Depends(require_key("email"))])
async def send_email(m: SendEmail):
    cur = db.run("INSERT INTO sent_emails(ts,to_addr,subject,body) VALUES(?,?,?,?)",
                 (time.time(), m.to, m.subject, m.body))
    return {"sent": True, "id": cur.lastrowid, "to": m.to}


@router.post("/pay/create", dependencies=[Depends(require_key("pay"))])
async def create_payment(p: Payment):
    ref = crypto.new_id("pay", 5)
    cur = db.run("INSERT INTO payments(ts,payee,amount,currency,memo,ref) VALUES(?,?,?,?,?,?)",
                 (time.time(), p.payee, p.amount, p.currency, p.memo, ref))
    return {"paid": True, "id": cur.lastrowid, "ref": ref, "payee": p.payee,
            "amount": p.amount, "currency": p.currency}


@router.get("/files/list", dependencies=[Depends(require_key("files"))])
async def list_files(limit: int = 50):
    rows = db.q("SELECT id,name FROM files ORDER BY id LIMIT ?", (max(1, limit),))
    return {"files": rows, "count": len(rows)}


@router.get("/files/read/{file_id}", dependencies=[Depends(require_key("files"))])
async def read_file(file_id: int):
    row = db.one("SELECT id,name,content FROM files WHERE id=?", (file_id,))
    if not row:
        raise HTTPException(404, "file not found")
    return row


@router.delete("/files/{file_id}", dependencies=[Depends(require_key("files"))])
async def delete_file(file_id: int):
    db.run("DELETE FROM files WHERE id=?", (file_id,))
    return {"deleted": file_id}


@router.get("/diagnostics/echo", dependencies=[Depends(require_key("diagnostics"))])
async def echo(request: Request):
    """A deliberately careless tool that echoes request headers back (including the API key).
    Used to prove the gateway scrubber stops secrets flowing back into the model."""
    return {"received_headers": dict(request.headers)}
