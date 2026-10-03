import { AppState, Decision, SecurityEvent } from "./types";

const now = () => new Date().toISOString();
const hash = (s:string) => Array.from(s).reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0).toString(16).replace("-","a");

export const demoState: AppState = {
  agents:[{
    id:"agt_fin_01", name:"FinanceBot", task:"Summarize this week's invoices.",
    status:"ACTIVE", trust:94, risk:18,
    scopes:["email.read:invoices","file.read:invoice_pdf"], budget:500,
    spent:120, expiresAt:new Date(Date.now()+1000*60*60*7).toISOString(),
    behavior:"NORMAL", keyId:"key_7F2A…91D", owner:"Workspace owner"
  }],
  passes:1,
  approvals:[],
  events:[
    {id:"evt_001",ts:"23:48:20",agent:"FinanceBot",action:"READ_EMAIL",tool:"mail",decision:"ALLOW",risk:14,reason:"Scope matched",proof:true,scope:true,intent:true,behavior:"NORMAL",hash:"6d8a…e1"},
    {id:"evt_002",ts:"23:48:23",agent:"FinanceBot",action:"SEND_EMAIL",tool:"mail",decision:"DENY",risk:96,reason:"Scope mismatch",proof:true,scope:false,intent:false,behavior:"ELEVATED",hash:"2ab1…9c"},
    {id:"evt_003",ts:"23:48:31",agent:"FinanceBot",action:"PAYMENT",tool:"payment",decision:"STEP-UP",risk:73,reason:"Human approval required",proof:true,scope:true,intent:true,behavior:"ELEVATED",hash:"c0f3…77"}
  ],
  attackState:null
};

let state:AppState = structuredClone(demoState);

function eventFor(scenario:string):SecurityEvent {
  const base={id:"evt_"+Date.now().toString(36),ts:new Date().toLocaleTimeString([], {hour12:false}),agent:"FinanceBot",action:"TOOL_CALL",tool:"gateway",proof:true,scope:true,intent:true,behavior:"NORMAL" as const};
  switch(scenario){
    case "prompt-injection": return {...base,action:"SEND_EMAIL",tool:"mail",decision:"DENY",risk:96,reason:"Intent mismatch · untrusted destination",scope:false,intent:false,behavior:"ELEVATED",scenario,hash:hash(JSON.stringify(base)).slice(0,6)+"…"+hash(JSON.stringify(base)).slice(-2)};
    case "stolen-pass": return {...base,action:"PAYMENT",tool:"payment",decision:"DENY",risk:100,reason:"Proof invalid · key mismatch",proof:false,scope:true,intent:true,scenario,hash:"00f1…x9"};
    case "tampering": return {...base,action:"PAYMENT",tool:"payment",decision:"DENY",risk:99,reason:"Body hash mismatch · proof binding invalid",scenario,hash:"bb71…4e"};
    case "payment": return {...base,action:"CREATE_PAYMENT",tool:"payment",decision:"STEP-UP",risk:73,reason:"Human approval required · sensitive financial action",behavior:"ELEVATED",scenario,hash:"a81c…f2"};
    case "behavior": return {...base,action:"BULK_EXPORT",tool:"files",decision:"STEP-UP",risk:88,reason:"Behavior deviates from baseline",behavior:"ANOMALOUS",scenario,hash:"4f12…d8"};
    case "revoke": return {...base,action:"REVOKE_AGENT",tool:"control-plane",decision:"DENY",risk:100,reason:"Agent revoked · new requests blocked",scenario,hash:"9a3c…be"};
    default: return {...base,action:"READ_FILE",tool:"files",decision:"ALLOW",risk:12,reason:"Proof verified · scope matched · behavior normal",scenario:"normal",hash:"70ad…19"};
  }
}

export function getState(){ return state; }
export function runScenario(scenario:string){
  if(scenario==="revoke"){
    state.agents=state.agents.map(a=>({...a,status:"REVOKED",trust:0,risk:100}));
  }
  const e=eventFor(scenario);
  state.events=[e,...state.events].slice(0,60);
  state.attackState={scenario,result:e.decision,eventId:e.id};
  if(scenario==="payment"){
    state.approvals=[{id:"apr_"+Date.now().toString(36),agent:"FinanceBot",tool:"payment",action:"Create payment",amount:50000,recipient:"acct_unknown",task:"Summarize this week's invoices.",risk:73,reason:"High-risk financial action",status:"PENDING"},...state.approvals];
  }
  return e;
}
export function decideApproval(id:string, decision:"APPROVED"|"DENIED"){
  const a=state.approvals.find(x=>x.id===id); if(!a) return null;
  a.status=decision;
  const e:SecurityEvent={id:"evt_"+Date.now().toString(36),ts:new Date().toLocaleTimeString([], {hour12:false}),agent:a.agent,action:a.action.toUpperCase(),tool:a.tool,decision:decision==="APPROVED"?"ALLOW":"DENY",risk:a.risk,reason:decision==="APPROVED"?"Approved by human · audit recorded":"Denied by human · action blocked",scenario:"approval"};
  state.events=[e,...state.events].slice(0,60);
  return a;
}
export function reset(){ state=structuredClone(demoState); return state; }
