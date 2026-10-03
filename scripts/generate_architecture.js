const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const htmlArchitecture = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AgentPass Human-Understandable Architecture</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif; }
    body { background: #07090e; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 30px; }
    
    .canvas { width: 1300px; background: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 24px; }
    
    .title-area { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #1e293b; padding-bottom: 18px; }
    .title-area h2 { font-size: 22px; font-weight: 800; color: #f8fafc; letter-spacing: -0.5px; }
    .title-area p { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .principle-badge { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; }

    /* Architecture Flow Grid */
    .flow-row { display: grid; grid-template-columns: 1fr 1.4fr 1.6fr 1.1fr; gap: 18px; position: relative; }
    
    .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; position: relative; }
    .box-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 10px; }
    .box-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
    .box-sub { font-size: 11px; color: #64748b; font-weight: 500; }
    
    /* Specific Box Themes */
    .box.human { border-color: #6366f1; background: #0d1226; }
    .box.human .box-title { color: #818cf8; }
    
    .box.agent-runtime { border-color: #0ea5e9; background: #081528; }
    .box.agent-runtime .box-title { color: #38bdf8; }
    
    .box.gateway { border-color: #10b981; background: #081c1c; }
    .box.gateway .box-title { color: #34d399; }
    
    .box.outcomes { border-color: #f43f5e; background: #1a0f18; }
    .box.outcomes .box-title { color: #fb7185; }

    .node-item { background: #07090e; border: 1px solid #1e293b; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.4; }
    .node-item b { color: #f8fafc; display: block; margin-bottom: 2px; }
    .node-item span { color: #94a3b8; font-size: 11px; }

    /* Gateway checklist */
    .checks-list { display: flex; flex-direction: column; gap: 7px; }
    .check-item { background: #070e17; border: 1px solid #162a38; border-radius: 6px; padding: 8px 10px; font-size: 11.5px; display: flex; align-items: center; gap: 8px; }
    .check-num { background: #10b981; color: #000; font-size: 10px; font-weight: 800; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

    /* Verdicts */
    .verdict-card { border-radius: 6px; padding: 10px; font-size: 11.5px; display: flex; flex-direction: column; gap: 3px; font-weight: 600; }
    .verdict-allow { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
    .verdict-stepup { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; }
    .verdict-deny { background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #fb7185; }

    /* Bottom Audit Banner */
    .audit-bar { background: #0d1322; border: 1px dashed #334155; border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
    .audit-left { display: flex; align-items: center; gap: 10px; }
    .audit-icon { font-size: 18px; }
    .audit-text b { color: #f8fafc; }
    .audit-text p { color: #64748b; font-size: 11px; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="title-area">
      <div>
        <h2>AgentPass — High-Level System Architecture</h2>
        <p>Human-Understandable Trust Boundaries & Runtime Execution Flow</p>
      </div>
      <div class="principle-badge">Core Principle: Never trust the model to decide its own authority</div>
    </div>

    <div class="flow-row">
      <!-- 1. Human Operator & Issuer -->
      <div class="box human">
        <div class="box-header">
          <div class="box-title"><span>👤 Human & Issuer</span></div>
          <div class="box-sub">Trust Root</div>
        </div>
        <div class="node-item">
          <b>1. Human Defines Task</b>
          <span>"Summarize this week's invoices (Read-only, 15m limit)"</span>
        </div>
        <div class="node-item">
          <b>2. Pass Issuer</b>
          <span>Creates Pass (PASS-INV-001) with explicit scopes, budget limits, and expiry.</span>
        </div>
        <div class="node-item">
          <b>3. Registers Public Key</b>
          <span>Registers agent's public key with the Security Gateway.</span>
        </div>
      </div>

      <!-- 2. AI Agent Runtime -->
      <div class="box agent-runtime">
        <div class="box-header">
          <div class="box-title"><span>🤖 AI Agent Runtime</span></div>
          <div class="box-sub">Untrusted Zone</div>
        </div>
        <div class="node-item" style="border-left: 3px solid #38bdf8;">
          <b>4. AI Agent (LLM)</b>
          <span>Executes task. <i>Untrusted by design.</i> Can be prompt-injected or manipulated by documents.</span>
        </div>
        <div class="node-item" style="border-left: 3px solid #818cf8; background: #0c1220;">
          <b>5. Isolated Signer Sidecar</b>
          <span>Holds <b>Private Signing Key</b> outside LLM reach. Computes Body SHA-256, Nonce, and cryptographic signature.</span>
        </div>
        <div class="node-item">
          <b>6. Tool Call Request</b>
          <span>Agent submits signed proof + pass ID to Gateway for evaluation.</span>
        </div>
      </div>

      <!-- 3. Security Gateway -->
      <div class="box gateway">
        <div class="box-header">
          <div class="box-title"><span>🛡️ AgentPass Gateway</span></div>
          <div class="box-sub">Enforcement Point</div>
        </div>
        <div class="checks-list">
          <div class="check-item">
            <div class="check-num">1</div>
            <div><b>Signature Check:</b> Verified by Agent Public Key</div>
          </div>
          <div class="check-item">
            <div class="check-num">2</div>
            <div><b>Anti-Replay:</b> Single-use Nonce & Timestamp Valid</div>
          </div>
          <div class="check-item">
            <div class="check-num">3</div>
            <div><b>Body Integrity:</b> SHA-256 Body Hash Matches</div>
          </div>
          <div class="check-item">
            <div class="check-num">4</div>
            <div><b>Scope & Budget:</b> Action allowed by current Pass</div>
          </div>
          <div class="check-item">
            <div class="check-num">5</div>
            <div><b>Intent Firewall:</b> Action matches authorized task</div>
          </div>
          <div class="check-item">
            <div class="check-num">6</div>
            <div><b>Behavioral Twin:</b> Volume & frequency within bounds</div>
          </div>
        </div>
      </div>

      <!-- 4. Decision & Outcomes -->
      <div class="box outcomes">
        <div class="box-header">
          <div class="box-title"><span>⚖️ Decisions</span></div>
          <div class="box-sub">Zero-Trust Guard</div>
        </div>
        <div class="verdict-card verdict-allow">
          <b>🟢 ALLOW</b>
          <span>Safe in-scope read action. Gateway brokers API key & executes tool.</span>
        </div>
        <div class="verdict-card verdict-stepup">
          <b>🟡 STEP-UP</b>
          <span>High-risk action (payment/delete). Pauses for WebAuthn human sign-off.</span>
        </div>
        <div class="verdict-card verdict-deny">
          <b>🔴 DENY</b>
          <span>Out of scope, prompt injection, or stolen token. Mock tool never runs.</span>
        </div>
      </div>
    </div>

    <!-- 5. Tamper Evident Audit Chain -->
    <div class="audit-bar">
      <div class="audit-left">
        <div class="audit-icon">⛓️</div>
        <div class="audit-text">
          <b>Tamper-Evident SHA-256 Hash Chain Audit Trail</b>
          <p>Every request, proof, decision, and risk score is cryptographically chained. Log tampering is mathematically detectable.</p>
        </div>
      </div>
      <div style="font-family:monospace;color:#34d399;font-weight:700;font-size:12px;">
        STATUS: INTEGRITY VERIFIED
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
  await page.setViewport({ width: 1400, height: 750, deviceScaleFactor: 2 });

  console.log('Rendering System Architecture Diagram...');
  await page.setContent(htmlArchitecture);
  await page.screenshot({ path: 'assets/system_architecture.png' });

  await browser.close();
  console.log('SYSTEM ARCHITECTURE DIAGRAM GENERATED SUCCESSFULLY');
})();
