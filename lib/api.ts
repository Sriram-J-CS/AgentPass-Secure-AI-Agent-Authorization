import { AppState, SecurityEvent, Approval } from "./types";

const external = (process.env.NEXT_PUBLIC_AGENTPASS_API || "").replace(/\/$/,"");

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const url = external ? external + path : path;
  const res = await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers||{})},cache:"no-store"});
  if(!res.ok) throw new Error("Security gateway unavailable");
  return res.json();
}
export const api = {
  state:()=>request<AppState>("/api/state"),
  attack:(scenario:string)=>request<SecurityEvent>("/api/attack",{method:"POST",body:JSON.stringify({scenario})}),
  approvals:()=>request<Approval[]>("/api/approvals"),
  decide:(id:string,decision:"APPROVED"|"DENIED")=>request<Approval>("/api/approvals",{method:"POST",body:JSON.stringify({id,decision})}),
  revoke:()=>request<SecurityEvent>("/api/revoke",{method:"POST"}),
  reset:()=>request<AppState>("/api/reset",{method:"POST"}),
  health:()=>request<{ok:boolean;mode:string;webAuthn:boolean}>("/api/health")
};