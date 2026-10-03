import { AppState, SecurityEvent, Approval } from "./types";
import { getState, runScenario, decideApproval, reset as resetDemo, demoState } from "./store";

const external = (process.env.NEXT_PUBLIC_AGENTPASS_API || "").replace(/\/$/,"");

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const url = external ? external + path : path;
  const res = await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers||{})},cache:"no-store"});
  if(!res.ok) throw new Error("Security gateway unavailable");
  return res.json();
}

export const api = {
  state: async ():Promise<AppState> => external ? request<AppState>("/api/state") : structuredClone(getState()),
  attack: async (scenario:string):Promise<SecurityEvent> => external ? request<SecurityEvent>("/api/attack",{method:"POST",body:JSON.stringify({scenario})}) : runScenario(scenario),
  approvals: async ():Promise<Approval[]> => external ? request<Approval[]>("/api/approvals") : structuredClone(getState().approvals),
  decide: async (id:string,decision:"APPROVED"|"DENIED"):Promise<Approval> => {
    if(external) return request<Approval>("/api/approvals",{method:"POST",body:JSON.stringify({id,decision})});
    const a=decideApproval(id,decision); if(!a) throw new Error("Approval not found"); return structuredClone(a);
  },
  revoke: async ():Promise<SecurityEvent> => external ? request<SecurityEvent>("/api/revoke",{method:"POST"}) : runScenario("revoke"),
  reset: async ():Promise<AppState> => external ? request<AppState>("/api/reset",{method:"POST"}) : resetDemo(),
  health: async ():Promise<{ok:boolean;mode:string;webAuthn:boolean}> => external ? request<{ok:boolean;mode:string;webAuthn:boolean}>("/api/health") : {ok:true,mode:"local-demo",webAuthn:false}
};

export const demoBaseline = structuredClone(demoState);
