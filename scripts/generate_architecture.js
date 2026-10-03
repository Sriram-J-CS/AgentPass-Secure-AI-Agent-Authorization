const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const htmlArchitecture = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AgentPass Full System Architecture</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif; }
    body { background: #07090e; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    
    .canvas { width: 1380px; background: #0c101d; border: 1px solid #1e293b; border-radius: 16px; padding: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 20px; }
    
    .title-area { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; }
    .title-area h2 { font-size: 22px; font-weight: 800; color: #f8fafc; letter-spacing: -0.5px; }
    .title-area p { font-size: 13px; color: #94a3b8; margin-top: 3px; }
    .core-principle { background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; }

    /* Architecture Flow Grid */
    .flow-grid { display: grid; grid-template-columns: 1.1fr 1.3fr 1.6fr 1fr; gap: 16px; }
    
    .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; position: relative; }
    .box-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-bottom: 2px; }
    .box-title { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
    .box-tag { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 4px; }
    
    /* Box Themes */
    .box.human { border-color: #6366f1; background: #0d1226; }
    .box.human .box-title { color: #818cf8; }
    .box.human .box-tag { background: rgba(99,102,241,0.2); color: #a5b4fc; }
    
    .box.agent { border-color: #0ea5e9; background: #081528; }
    .box.agent .box-title { color: #38bdf8; }
    .box.agent .box-tag { background: rgba(14,165,233,0.2); color: #7dd3fc; }
    
    .box.gateway { border-color: #10b981; background: #07191d; }
    .box.gateway .box-title { color: #34d399; }
    .box.gateway .box-tag { background: rgba(16,185,129,0.2); color: #6ee7b7; }
    
    .box.outcomes { border-color: #f43f5e; background: #1a0f19; }
    .box.outcomes .box-title { color: #fb7185; }
    .box.outcomes .box-tag { background: rgba(244,63,94,0.2); color: #fda4af; }

    .node { background: #07090e; border: 1px solid #1e293b; border-radius: 8px; padding: 10px; font-size: 11.5px; line-height: 1.4; }
    .node b { color: #f8fafc; display: block; margin-bottom: 2px; font-size: 12px; }
    .node p { color: #94a3b8; font-size: 11px; }

    /* Gateway Pipeline */
    .pipeline { display: flex; flex-direction: column; gap: 6px; }
    .pipe-step { background: #070e17; border: 1px solid #142838; border-radius: 6px; padding: 7px 10px; font-size: 11px; display: flex; align-items: center; gap: 8px; }
    .pipe-num { background: #10b981; color: #000; font-size: 10px; font-weight: 800; width: 17px; height: 17px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pipe-text { color: #cbd5e1; }
    .pipe-text b { color: #f8fafc; }

    /* Verdicts */
    .verdict { border-radius: 6px; padding: 9px 11px; font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
    .v-allow { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
    .v-stepup { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; }
    .v-deny { background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #fb7185; }

    /* Bottom Architecture Bars */
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .bottom-panel { background: #090e1a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; }
    .bottom-panel h4 { font-size: 12px; color: #f8fafc; margin-bottom: 2px; }
    .bottom-panel p { color: #64748b; font-size: 11px; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="title-area">
      <div>
        <h2>AgentPass — Comprehensive System Architecture</h2>
        <p>End-to-End Cryptographic Trust Boundaries, Identity Lifecycle, and Runtime Policy Enforcement</p>
      </div>
      <div class="core-principle">Security Law: Never trust the model to decide its own authority</div>
    </div>

    <div class="flow-grid">
      <!-- 1. Human & Pass Issuer -->
      <div class="box human">
        <div class="box-header">
          <div class="box-title"><span>👤 Human & Issuer</span></div>
          <span class="box-tag">Trust Root</span>
        </div>
        <div class="node">
          <b>1. Task Definition</b>
          <p>Human defines scoped task ("Summarize this week's invoices", 15m expiry, max 50 reads).</p>
        </div>
        <div class="node">
          <b>2. Pass Issuer</b>
          <p>Generates <code>PASS-INV-001</code> with explicit scopes, budget quotas, and risk thresholds.</p>
        </div>
        <div class="node">
          <b>3. Gateway Key Registration</b>
          <p>Registers agent's public key (Ed25519) and pass metadata directly with the Gateway.</p>
        </div>
      </div>

      <!-- 2. Agent Runtime & Signer Sidecar -->
      <div class="box agent">
        <div class="box-header">
          <div class="box-title"><span>🤖 Agent Runtime</span></div>
          <span class="box-tag">Untrusted Zone</span>
        </div>
        <div class="node" style="border-left: 3px solid #0ea5e9;">
          <b>4. AI Agent / LLM</b>
          <p>Plans & executes task. <i>Untrusted by design.</i> Susceptible to prompt injections from files/emails.</p>
        </div>
        <div class="node" style="border-left: 3px solid #818cf8; background:#0b1122;">
          <b>5. Isolated Signer Sidecar</b>
          <p>Stores <b>Private Key</b> isolated from LLM context. Signs requests binding URL, Nonce, & Body SHA-256.</p>
        </div>
        <div class="node" style="border-left: 3px solid #38bdf8;">
          <b>6. Signed Tool Dispatch</b>
          <p>Submits signed proof + pass reference to Gateway. <i>Agent cannot call tools directly.</i></p>
        </div>
      </div>

      <!-- 3. Security Gateway Pipeline -->
      <div class="box gateway">
        <div class="box-header">
          <div class="box-title"><span>🛡️ Security Gateway</span></div>
          <span class="box-tag">Enforcement Point</span>
        </div>
        <div class="pipeline">
          <div class="pipe-step">
            <div class="pipe-num">1</div>
            <div class="pipe-text"><b>Proof-of-Possession:</b> Verifies Ed25519 signature with registered agent key</div>
          </div>
          <div class="pipe-step">
            <div class="pipe-num">2</div>
            <div class="pipe-text"><b>Anti-Replay Nonce:</b> Validates unique nonce and timestamp freshness window</div>
          </div>
          <div class="pipe-step">
            <div class="pipe-num">3</div>
            <div class="pipe-text"><b>Payload Integrity:</b> Verifies canonical SHA-256 hash of tool request body</div>
          </div>
          <div class="pipe-step">
            <div class="pipe-num">4</div>
            <div class="pipe-text"><b>Scope & Budget Engine:</b> Enforces pass scopes and decrements action budget</div>
          </div>
          <div class="pipe-step">
            <div class="pipe-num">5</div>
            <div class="pipe-text"><b>Intent Firewall:</b> Structured check comparing action against task intent</div>
          </div>
          <div class="pipe-step">
            <div class="pipe-num">6</div>
            <div class="pipe-text"><b>Behavioral Twin:</b> Flags volume spikes, frequency surges, or sequence anomalies</div>
          </div>
        </div>
      </div>

      <!-- 4. Enforcement & Execution -->
      <div class="box outcomes">
        <div class="box-header">
          <div class="box-title"><span>⚖️ Policy Verdicts</span></div>
          <span class="box-tag">Zero-Trust Guard</span>
        </div>
        <div class="verdict v-allow">
          <b>🟢 ALLOW (Low Risk)</b>
          <span>Safe read within scope. Gateway injects vaulted secrets & executes tool.</span>
        </div>
        <div class="verdict v-stepup">
          <b>🟡 STEP-UP (High Risk)</b>
          <span>Sensitive action (payment/delete). Pauses for WebAuthn operator sign-off.</span>
        </div>
        <div class="verdict v-deny">
          <b>🔴 DENY (Blocked)</b>
          <span>Out of scope, prompt injection, or stolen token. Mock tool never runs.</span>
        </div>
      </div>
    </div>

    <!-- Bottom Infrastructure Panels -->
    <div class="bottom-grid">
      <div class="bottom-panel">
        <div>
          <h4>⛓️ Tamper-Evident SHA-256 Hash Chain Audit Trail</h4>
          <p>Every request, proof, decision, and risk score is chained: <code>H(n) = SHA256(H(n-1) + CanonicalJSON)</code></p>
        </div>
        <span style="color:#34d399;font-weight:700;font-family:monospace;font-size:11px;">● HASH VERIFIED</span>
      </div>

      <div class="bottom-panel">
        <div>
          <h4>🕸️ Monotonic Sub-Agent Delegation & Emergency Kill Switch</h4>
          <p>Child agents receive strictly narrowed authority: <code>Child ⊆ Parent</code>. Revoking parent kills all children instantly.</p>
        </div>
        <span style="color:#38bdf8;font-weight:700;font-family:monospace;font-size:11px;">● DELEGATION BOUND</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 780, deviceScaleFactor: 2 });

  console.log('Rendering Updated Comprehensive Architecture Diagram...');
  await page.setContent(htmlArchitecture);
  await page.screenshot({ path: 'assets/system_architecture.png' });

  await browser.close();
  console.log('SYSTEM ARCHITECTURE DIAGRAM UPDATED SUCCESSFULLY');
})();
