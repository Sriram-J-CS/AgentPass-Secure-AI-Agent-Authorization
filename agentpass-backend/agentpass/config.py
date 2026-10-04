import os
import pathlib

BASE = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(os.environ.get("AGENTPASS_DATA", BASE / "data"))
DATA.mkdir(parents=True, exist_ok=True)

GATEWAY_PORT = int(os.environ.get("GATEWAY_PORT", "8000"))
SIDECAR_PORT = int(os.environ.get("SIDECAR_PORT", "8001"))
GATEWAY_URL = os.environ.get("GATEWAY_URL", f"http://127.0.0.1:{GATEWAY_PORT}")
SIDECAR_URL = os.environ.get("SIDECAR_URL", f"http://127.0.0.1:{SIDECAR_PORT}")
DB_PATH = DATA / "agentpass.db"

TICKET_TTL_SECONDS = 300       # an unused ticket expires after this long (resync issues a new one)
PROOF_WINDOW_SECONDS = 30      # allowed clock skew for a signed proof
APPROVAL_TTL_SECONDS = 120     # how long a human has to answer a step-up
PASS_TTL_SECONDS = 900         # default life of a pass (15 min)

STEP_UP_SCORE = 70             # behavior score that forces human approval
DENY_SCORE = 90                # behavior score that blocks outright

# Simulation endpoints (sidecar /debug/*) stand in for traffic an attacker
# could capture from logs, networks or memory. Never enable in production.
SIMULATION = os.environ.get("AGENTPASS_SIMULATION", "1") == "1"

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
