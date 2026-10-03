import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Agent = { id: string; name: string; scopes: string[] };
type Result = {
  action: string; decision: string; risk_score: number; proof_valid: boolean;
  execution_status: string; reason: string; result?: any;
};

async function api(path:string, init?:RequestInit){
  const res=await fetch(API+path,{credentials:"include",headers:{"Content-Type":"application/json",...(init?.headers||{})},...init});
  if(!res.ok){let msg="Request failed";try{const d=await res.json();msg=d.detail||msg}catch{}throw new Error(msg)}
  return res.json();
}
function b64(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes)))}
function nonce(){return crypto.randomUUID()+"-"+crypto.randomUUID()}
function sortedBody(body:any){return JSON.stringify(body,Object.keys(body).sort())}
async function sha256(text:string){return b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))}
async function sign(jwk:JsonWebKey,message:string){
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  return b64(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(message)));
}

export default function LiveRequestConsole(){
  const [agents,setAgents]=useState<Agent[]>([]);
  const [agentId,setAgentId]=useState("");
  const [pass,setPass]=useState("");
  const [passId,setPassId]=useState("");
  const [action,setAction]=useState("HEALTH_CHECK");
  const [target,setTarget]=useState("internal://agentpass");
  const [taint,setTaint]=useState("NONE");
  const [amount,setAmount]=useState("0");
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{api("/api/agents").then(d=>{setAgents(d.agents);if(d.agents[0])setAgentId(d.agents[0].id)})},[]);
  useEffect(()=>{const raw=localStorage.getItem("agentpass.meta."+agentId);if(raw){const m=JSON.parse(raw);setPassId(m.passId||"")}else setPassId("")},[agentId]);
  async function send(){
    setError("");setResult(null);
    try{
      if(!agentId||!pass) throw new Error("Select an agent and enter the AgentPass token.");
      const meta=JSON.parse(localStorage.getItem("agentpass.meta."+agentId)||"null");
      if(!meta?.privateKeyJwk || !meta?.passId) throw new Error("Signing metadata is missing. Re-create this agent in this browser.");
      const body=action==="PAYMENT"?{amount:Number(amount)}:{};
      const bodyHash=await sha256(sortedBody(body));
      const timestamp=Math.floor(Date.now()/1000);
      const n=nonce();
      const method="POST";
      const message=`${meta.passId}.${method}.${target}.${bodyHash}.${timestamp}.${n}`;
      const signature=await sign(meta.privateKeyJwk,message);
      const d=await api("/api/gateway/requests",{method:"POST",body:JSON.stringify({agent_id:agentId,pass_token:pass,method,tool:"agentpass",action,target,body,timestamp,nonce:n,signature,taint_source:taint})});
      setResult(d.request);
    }catch(e:any){setError(e.message)}
  }
  return <div>
    <div className="mb-6"><div className="text-2xl font-semibold">Request console</div><div className="mt-1 text-sm text-slate-400">Send a real proof-bound request through the gateway.</div></div>
    <div className="card rounded-3xl p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <select value={agentId} onChange={e=>setAgentId(e.target.value)} className="field"><option value="">Select agent</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="AgentPass token" className="field"/>
        <input value={passId} readOnly placeholder="Pass ID" className="field opacity-60"/>
        <select value={action} onChange={e=>setAction(e.target.value)} className="field">{["HEALTH_CHECK","READ_AGENT","AUDIT_SUMMARY","READ_EMAIL","READ_FILE","SEND_EMAIL","DELETE_FILE","EXPORT_DATA","PAYMENT"].map(x=><option key={x}>{x}</option>)}</select>
        <input value={target} onChange={e=>setTarget(e.target.value)} placeholder="Target" className="field"/>
        <select value={taint} onChange={e=>setTaint(e.target.value)} className="field">{["NONE","EMAIL","FILE","WEB","EXTERNAL_API"].map(x=><option key={x}>{x}</option>)}</select>
        {action==="PAYMENT"&&<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" placeholder="Amount" className="field"/>}
      </div>
      {error&&<div className="mt-4 rounded-xl border border-red-400/10 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
      <button onClick={send} className="mt-5 rounded-xl bg-blue-500 px-5 py-3 font-semibold hover:bg-blue-400">Send signed request</button>
      {result&&<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between gap-4"><div className="font-medium">{result.action}</div><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{result.decision.replace("_"," ")}</span></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3"><div><div className="text-xs text-slate-500">Risk</div><div className="mt-1 text-2xl font-semibold">{result.risk_score}</div></div><div><div className="text-xs text-slate-500">Proof</div><div className="mt-1 text-sm">{result.proof_valid?"Verified":"Rejected"}</div></div><div><div className="text-xs text-slate-500">Execution</div><div className="mt-1 text-sm">{result.execution_status}</div></div></div>
        <div className="mt-4 text-sm leading-6 text-slate-300">{result.reason}</div>
        {result.result&&<pre className="mt-4 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-slate-400">{JSON.stringify(result.result,null,2)}</pre>}
      </div>}
    </div>
  </div>
}