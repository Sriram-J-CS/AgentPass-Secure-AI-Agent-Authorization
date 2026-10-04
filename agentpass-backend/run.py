"""Start the gateway (8000) and the signer sidecar (8001) as two separate processes."""
import os
import signal
import subprocess
import sys
import time

import httpx

from agentpass import config

procs = []


def start(module, port):
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", module, "--host", "0.0.0.0",
                          "--port", str(port), "--log-level", "warning"])
    procs.append(p)
    return p


def wait(url, name):
    for _ in range(60):
        try:
            if httpx.get(url, timeout=1).status_code == 200:
                print(f"  {name} ready: {url}")
                return
        except Exception:
            time.sleep(0.5)
    print(f"  {name} FAILED to start"); stop(); sys.exit(1)


def stop(*_):
    for p in procs:
        p.terminate()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda *a: (stop(), sys.exit(0)))
    print("Starting AgentPass...")
    start("agentpass.gateway_app:app", config.GATEWAY_PORT)
    start("agentpass.sidecar_app:app", config.SIDECAR_PORT)
    wait(f"{config.GATEWAY_URL}/api/health", "Gateway")
    wait(f"{config.SIDECAR_URL}/health", "Signer sidecar")
    print(f"\n  API docs:  {config.GATEWAY_URL}/docs\n  Dashboard API base: {config.GATEWAY_URL}/api\n"
          f"  First step: POST {config.GATEWAY_URL}/api/demo/bootstrap\n  Ctrl+C to stop.")
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(1)
    finally:
        stop()
