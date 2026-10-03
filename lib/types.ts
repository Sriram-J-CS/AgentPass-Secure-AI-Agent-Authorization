export type Decision = "ALLOW" | "STEP-UP" | "DENY";
export type AgentStatus = "ACTIVE" | "REVOKED";
export type PassStatus = "ACTIVE" | "EXPIRING" | "REVOKED" | "EXPIRED" | "FROZEN";

export type Agent = {
  id:string; name:string; task:string; status:AgentStatus; trust:number;
  risk:number; scopes:string[]; budget:number; spent:number; expiresAt:string;
  behavior:"NORMAL"|"ELEVATED"|"ANOMALOUS"; keyId:string; owner:string;
};

export type SecurityEvent = {
  id:string; ts:string; agent:string; action:string; tool:string; decision:Decision;
  risk:number; reason:string; scenario?:string; hash?:string;
  proof?:boolean; scope?:boolean; intent?:boolean; behavior?:string;
};

export type Approval = {
  id:string; agent:string; tool:string; action:string; amount?:number; recipient?:string;
  task:string; risk:number; reason:string; status:"PENDING"|"APPROVED"|"DENIED";
};

export type GraphNode = { id:string; label:string; kind:string; meta?:string };
export type AppState = {
  agents:Agent[]; passes:number; events:SecurityEvent[]; approvals:Approval[];
  attackState?:{scenario:string; result:Decision; eventId:string}|null;
};
