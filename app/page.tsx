"use client";

import { useEffect, useState } from "react";
import {
  Activity, Archive, ArrowRight, Bot, Boxes, Check, ChevronDown, CircleStop,
  CircleDot, Command, FileCheck2, Fingerprint, GitBranch, KeyRound,
  LayoutDashboard, LockKeyhole, Network, Play, RefreshCw, Search,
  Settings2, Shield, ShieldAlert, ShieldCheck, Skull, UserRoundCheck,
  LogOut, X
} from "lucide-react";
import { api } from "@/lib/api";
import { AppState, SecurityEvent, Decision } from "@/lib/types";
import {
  Button, DecisionBadge, EmptyState, HeroLabel, LiveDot, Metric, PanelRow,
  Pipeline, RiskBadge, Section, SecurityChip, Shortcut
} from "@/components/security-ui";
import { ArchitectureFlow, CausalGraph, DelegationGraph } from "@/components/graph";

type Screen = "overview"|"agents"|"passes"|"attacks"|"requests"|"approvals"|"causal"|"audit"|"vault"|"architecture"|"dataflow"|"settings";

const NAV: [Screen,string,any][] = [
  ["overview","Overview",LayoutDashboard],
  ["agents","Agents",Bot],
  ["passes","Passes",KeyRound],
  ["attacks","Attack Center",ShieldAlert],
  ["requests","Requests",Activity],
  ["approvals","Approvals",UserRoundCheck],
  ["causal","Causal Trace",GitBranch],
  ["audit","Audit",FileCheck2],
  ["vault","Vault",LockKeyhole],
  ["architecture","Architecture",Network],
  ["dataflow","Data Flow",Boxes],
  ["settings","Settings",Settings2]
];

const ATTACKS = [
  {id:"normal", title:"Normal Task", desc:"In-scope invoice reads stay within the delegated task.", control:"Proof + scope + behavior", expected:"ALLOW" as Decision},
  {id:"prompt-injection", title:"Prompt Injection", desc:"A malicious document tries to redirect invoice data to an external recipient.", control:"Intent + destination", expected:"DENY" as Decision},
  {id:"stolen-pass", title:"Stolen Pass Replay", desc:"A captured authorization reference is replayed without the agent key.", control:"Proof-of-possession", expected:"DENY" as Decision},
  {id:"tampering", title:"Request Tampering", desc:"Payment parameters change between signing and execution.", control:"Body-hash binding", expected:"DENY" as Decision},
  {id:"payment", title:"High-Risk Payment", desc:"A sensitive financial action pauses for a human decision.", control:"Step-up", expected:"STEP-UP" as Decision},
  {id:"behavior", title:"Behavioral Anomaly", desc:"Volume, sequence and destination drift beyond the baseline.", control:"Behavior baseline", expected:"STEP-UP" as Decision},
  {id:"revoke", title:"Revoke Agent", desc:"The kill switch invalidates current authority and blocks new requests.", control:"Revocation", expected:"DENY" as Decision}
];

export default function Home(){
  const [entered,setEntered]=useState(false);
  const [screen,setScreen]=useState<Screen>("overview");
  const [state,setState]=useState<AppState|null>(null);
  const [selected,setSelected]=useState<SecurityEvent|null>(null);
  const [loading,setLoading]=useState(true);
  const [running,setRunning]=useState<string|null>(null);
  const [toast,setToast]=useState("");
  const [command,setCommand]=useState(false);

  async function refresh(){
    try{ setLoading(true); setState(await api.state()); }
    catch{ setToast("Security gateway unavailable"); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{
    refresh();
    const id=window.setInterval(refresh,5000);
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
        e.preventDefault(); setCommand(v=>!v);
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>{window.clearInterval(id);window.removeEventListener("keydown",onKey)};
  },[]);

  useEffect(()=>{
    if(!toast) return;
    const id=window.setTimeout(()=>setToast(""),3000);
    return()=>window.clearTimeout(id);
  },[toast]);

  async function run(id:string){
    try{
      setRunning(id);
      const event=await api.attack(id);
      setSelected(event);
      await refresh();
      setScreen(id==="payment"?"approvals":"attacks");
      setToast(event.decision==="ALLOW"?"Action authorized":event.decision==="STEP-UP"?"Human approval required":"Action blocked");
    }catch{setToast("Security gateway unavailable");}
    finally{setRunning(null);}
  }

  async function reset(){
    try{setRunning("reset");await api.reset();setSelected(null);await refresh();setToast("Demo state reset");}
    finally{setRunning(null);}
  }

  async function revoke(){
    try{setRunning("revoke");await api.revoke();await refresh();setToast("Pass revoked · new requests denied");}
    finally{setRunning(null);}
  }

  if(!entered){
    return <Landing onConsole={()=>setEntered(true)} onAttack={()=>{setEntered(true);setScreen("attacks")}}/>
  }

  const pending=(state?.approvals||[]).filter(a=>a.status==="PENDING").length;

  return <div className="min-h-screen">
    <div className="flex min-h-screen">
      <aside className="hidden w-[250px] shrink-0 border-r border-white/[.07] bg-[#070a0f]/95 px-3 py-4 lg:flex lg:flex-col">
        <div className="px-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[.04]"><ShieldCheck size={16}/></div>
            <div><div className="text-sm font-semibold">AgentPass</div><div className="text-[10px] text-white/35">Security Control</div></div>
          </div>
        </div>
        <div className="mt-7 px-3 text-[10px] uppercase tracking-[.14em] text-white/25">Workspace</div>
        <div className="mt-2 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2.5">
          <div className="flex items-center justify-between text-xs"><span>Sriram workspace</span><ChevronDown size={12} className="text-white/30"/></div>
          <div className="mt-1 text-[10px] text-white/30">Production policy</div>
        </div>
        <nav className="mt-4 space-y-0.5">
          {NAV.map(([id,label,Icon])=><button key={id} onClick={()=>setScreen(id)} className={"group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs transition "+(screen===id?"bg-white/[.07] text-white":"text-white/45 hover:bg-white/[.035] hover:text-white/80")}>
            <Icon size={15}/><span>{label}</span>{id==="approvals"&&pending>0?<span className="ml-auto rounded-full bg-[#edc66b]/10 px-1.5 py-0.5 text-[9px] text-[#edc66b]">{pending}</span>:null}
          </button>)}
        </nav>
        <div className="mt-auto border-t border-white/[.07] pt-3">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[.05] text-[10px]">SJ</div>
            <div className="min-w-0"><div className="truncate text-xs">Workspace owner</div><div className="truncate text-[10px] text-white/30">Protected workspace</div></div>
          </div>
          <button onClick={()=>setEntered(false)} className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-white/40 hover:bg-white/[.03]"><LogOut size={14}/>Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#05070b]/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
            <div>
              <div className="text-[10px] uppercase tracking-[.16em] text-white/30">AgentPass / Security Console</div>
              <div className="mt-0.5 text-sm font-medium">{screen.replace("-"," ")}</div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <LiveDot>{pending>0?String(pending)+" action requires attention":"Security system operational"}</LiveDot>
              <button onClick={()=>setCommand(true)} className="hidden md:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.025] px-2.5 py-2 text-white/35"><Search size={14}/><span className="text-[10px]">Search</span><Shortcut keys="Ctrl K"/></button>
              <button onClick={refresh} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[.025] text-white/40"><RefreshCw size={14} className={loading?"animate-spin":""}/></button>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6 xl:p-8">
          {!state ? <EmptyState title="Security gateway unavailable" body="The control plane did not respond. Retry to restore the security console." button={<Button onClick={refresh}>Retry</Button>}/> : <ScreenView screen={screen} state={state} run={run} running={running} reset={reset} revoke={revoke} selected={selected} setSelected={setSelected} setScreen={setScreen} refresh={refresh}/>}
        </div>
      </main>
    </div>
    {toast?<div className="fixed bottom-5 right-5 z-50 glass flex items-center gap-3 rounded-xl px-4 py-3 text-xs shadow-2xl"><span className="h-2 w-2 rounded-full bg-white"/>{toast}</div>:null}
    {command?<CommandPalette close={()=>setCommand(false)} run={run} setScreen={setScreen} reset={reset} revoke={revoke}/>:null}
  </div>
}

function Landing({onConsole,onAttack}:{onConsole:()=>void;onAttack:()=>void}){
 return <div className="min-h-screen overflow-hidden">
   <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
     <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.04]"><Shield size={17}/></div><span className="text-sm font-semibold">AgentPass</span></div>
     <div className="hidden items-center gap-7 text-xs text-white/40 md:flex"><span>Runtime security</span><span>Authorization</span><span>Attack simulation</span></div>
     <Button variant="ghost" onClick={onConsole}>Open console <ArrowRight size={14}/></Button>
   </header>
   <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:pb-24 lg:pt-20">
     <div>
       <HeroLabel/>
       <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-[-.055em] md:text-7xl">Agents can request an action.<br/><span className="text-white/45">AgentPass decides.</span></h1>
       <p className="mt-7 max-w-2xl text-base leading-7 text-white/45 md:text-lg">Every AI agent gets a short-lived identity, key-bound proof, narrow authority, runtime policy and a decision gate outside the model.</p>
       <div className="mt-8 flex flex-wrap gap-3"><Button onClick={onConsole}>Open Security Console <ArrowRight size={15}/></Button><Button variant="ghost" onClick={onAttack}><Play size={14}/>View Attack Demo</Button></div>
       <div className="mt-8 flex flex-wrap gap-2"><SecurityChip tone="green">Vault</SecurityChip><SecurityChip tone="green">Bind</SecurityChip><SecurityChip tone="amber">Burn</SecurityChip><SecurityChip>Step-up</SecurityChip><SecurityChip>Audit chain</SecurityChip></div>
     </div>
     <div className="relative">
       <div className="absolute -inset-8 rounded-[40px] bg-[#667cff]/10 blur-3xl"/>
       <div className="relative glass rounded-[24px] p-5 md:p-6">
         <div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-[.14em] text-white/30">Live enforcement</div><div className="mt-1 text-sm font-medium">FinanceBot · invoice task</div></div><SecurityChip tone="green">Operational</SecurityChip></div>
         <div className="mt-6 space-y-2">
           {["Task policy","Agent identity","Key-bound proof","AgentPass gateway"].map((x,i)=><div key={x} className="rounded-xl border border-white/10 bg-white/[.025] px-4 py-3"><div className="flex items-center justify-between"><span className="text-xs">{x}</span><span className="mono text-[10px] text-white/30">0{i+1}</span></div></div>)}
         </div>
         <div className="grid grid-cols-3 gap-2 pt-3"><DecisionTile label="Allow" value="14" tone="green"/><DecisionTile label="Step-up" value="73" tone="amber"/><DecisionTile label="Deny" value="96" tone="red"/></div>
       </div>
     </div>
   </div>
   <div className="mx-auto max-w-7xl border-t border-white/[.07] px-6 py-9"><div className="grid gap-6 md:grid-cols-3"><Value title="VAULT" body="Real API keys stay outside the agent context." icon={<LockKeyhole size={16}/>}/><Value title="BIND" body="Every request proves possession of the registered agent key." icon={<Fingerprint size={16}/>}/><Value title="BURN" body="Every authorization ticket is consumed once." icon={<Archive size={16}/>}/></div></div>
 </div>
}

function DecisionTile({label,value,tone}:{label:string;value:string;tone:"green"|"amber"|"red"}){
 const cls=tone==="green"?"border-[#59e38a]/20 bg-[#59e38a]/[.07] text-[#59e38a]":tone==="amber"?"border-[#edc66b]/20 bg-[#edc66b]/[.07] text-[#edc66b]":"border-[#ff717d]/20 bg-[#ff717d]/[.07] text-[#ff717d]";
 return <div className={"rounded-xl border p-3 text-center "+cls}><div className="text-[10px] uppercase">{label}</div><div className="mono mt-1 text-lg">{value}</div></div>
}
function Value({title,body,icon}:{title:string;body:string;icon:React.ReactNode}){return <div className="flex gap-3"><div className="mt-0.5 text-white/40">{icon}</div><div><div className="mono text-[10px] tracking-[.14em] text-white/35">{title}</div><p className="mt-1 text-xs leading-5 text-white/45">{body}</p></div></div>}

function ScreenView(props:{screen:Screen;state:AppState;run:(s:string)=>void;running:string|null;reset:()=>void;revoke:()=>void;selected:SecurityEvent|null;setSelected:(e:SecurityEvent)=>void;setScreen:(s:Screen)=>void;refresh:()=>void}){
 const {screen,state}=props;
 if(screen==="overview") return <Overview state={state} setScreen={props.setScreen}/>;
 if(screen==="agents") return <Agents state={state} revoke={props.revoke}/>;
 if(screen==="passes") return <Passes state={state}/>;
 if(screen==="attacks") return <AttackCenter state={state} {...props}/>;
 if(screen==="requests") return <Requests state={state} setSelected={props.setSelected}/>;
 if(screen==="approvals") return <Approvals state={state} refresh={props.refresh}/>;
 if(screen==="causal") return <Causal selected={props.selected}/>;
 if(screen==="audit") return <Audit state={state}/>;
 if(screen==="vault") return <Vault/>;
 if(screen==="architecture") return <Architecture/>;
 if(screen==="dataflow") return <DataFlow/>;
 return <SettingsScreen/>;
}

function Overview({state,setScreen}:{state:AppState;setScreen:(s:Screen)=>void}){
 return <div className="space-y-6">
   <PageIntro eyebrow="Overview" title="Runtime security, at a glance" body="Authority is checked before a protected tool executes." action={<Button variant="ghost" onClick={()=>setScreen("attacks")}><Play size={14}/>Run security scenario</Button>}/>
   <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
     <Metric label="Active agents" value={state.agents.filter(a=>a.status==="ACTIVE").length}/>
     <Metric label="Active passes" value={state.passes}/>
     <Metric label="Allowed actions" value={state.events.filter(e=>e.decision==="ALLOW").length}/>
     <Metric label="Blocked actions" value={state.events.filter(e=>e.decision==="DENY").length}/>
     <Metric label="Step-up requests" value={state.events.filter(e=>e.decision==="STEP-UP").length}/>
     <Metric label="Attacks contained" value={state.events.filter(e=>e.scenario&&e.decision!=="ALLOW").length}/>
   </div>
   <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
     <Section title="Live security event stream" subtitle="Latest gateway decisions">
       <div className="divide-y divide-white/[.06]">{state.events.slice(0,8).map(e=><div key={e.id} className="flex items-center gap-4 px-5 py-4">
         <div className="mono w-16 shrink-0 text-[10px] text-white/25">{e.ts}</div>
         <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-xs font-medium">{e.agent}</span><span className="text-white/20">·</span><span className="mono text-[10px] text-white/45">{e.action}</span></div><div className="mt-1 truncate text-[10px] text-white/35">{e.reason}</div></div>
         <DecisionBadge decision={e.decision}/><div className="w-8 text-right"><RiskBadge risk={e.risk}/></div>
       </div>)}</div>
     </Section>
     <div className="space-y-6">
       <Section title="Security posture"><div className="p-5"><div className="flex items-end justify-between"><div><div className="text-xs text-white/40">Highest recent risk</div><div className="mt-1 text-4xl font-semibold tracking-[-.05em]">{Math.max(...state.events.map(e=>e.risk))}</div></div><SecurityChip tone="amber">Elevated</SecurityChip></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-[#edc66b]" style={{width:String(Math.max(...state.events.map(e=>e.risk)))+"%"}}/></div><div className="mt-4"><PanelRow left="Active agents" right={state.agents.filter(a=>a.status==="ACTIVE").length}/><PanelRow left="Revoked agents" right={state.agents.filter(a=>a.status==="REVOKED").length}/><PanelRow left="Pending approvals" right={state.approvals.filter(a=>a.status==="PENDING").length}/></div></div></Section>
       <Section title="Decision distribution"><div className="p-5 space-y-3">{(["ALLOW","STEP-UP","DENY"] as Decision[]).map(d=>{const count=state.events.filter(e=>e.decision===d).length;return <div key={d} className="flex items-center gap-3"><DecisionBadge decision={d}/><div className="h-2 flex-1 overflow-hidden rounded bg-white/[.05]"><div className="h-full rounded bg-white/25" style={{width:String(Math.min(100,count*24))+"%"}}/></div><span className="mono w-5 text-right text-[10px] text-white/40">{count}</span></div>})}</div></Section>
     </div>
   </div>
 </div>
}

function PageIntro({eyebrow,title,body,action}:{eyebrow:string;title:string;body:string;action?:React.ReactNode}){return <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="text-[10px] uppercase tracking-[.14em] text-white/30">{eyebrow}</div><h1 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{title}</h1><p className="mt-2 text-xs text-white/40">{body}</p></div>{action}</div>}

function Agents({state,revoke}:{state:AppState;revoke:()=>void}){
 const a=state.agents[0];
 return <div className="space-y-6">
   <PageIntro eyebrow="Agents" title="Security principals" body="Every agent has an independent identity and a bounded authority surface." action={<Button onClick={()=>window.alert("Create Agent: task, scopes, budget, expiry and risk policy.")}>Create agent</Button>}/>
   <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
     <Section title="Registered agents" subtitle="Identity, authority and current runtime state">
       <div className="p-5">
         <div className="flex items-start justify-between"><div className="flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"><Bot size={17}/></div><div><div className="text-sm font-medium">{a.name}</div><div className="mono mt-1 text-[10px] text-white/30">{a.id}</div></div></div><SecurityChip tone={a.status==="ACTIVE"?"green":"red"}>{a.status}</SecurityChip></div>
         <div className="mt-6 grid gap-4 md:grid-cols-4"><Mini label="Task" value={a.task}/><Mini label="Trust" value={String(a.trust)+"/100"}/><Mini label="Behavior" value={a.behavior}/><Mini label="Budget" value={"₹"+a.budget}/></div>
         <div className="mt-5 flex flex-wrap gap-2">{a.scopes.map(s=><SecurityChip key={s}>{s}</SecurityChip>)}</div>
         <div className="mt-5 grid gap-3 md:grid-cols-2"><PanelRow left="Key binding" right="Valid" /><PanelRow left="Pass expiry" right={new Date(a.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}/></div>
         <div className="mt-5 flex gap-2"><Button variant="danger" onClick={revoke} disabled={a.status==="REVOKED"}><CircleStop size={14}/>Revoke agent</Button><Button variant="ghost">View authority</Button></div>
       </div>
     </Section>
     <Section title="Authority boundary" subtitle="Authority can shrink, never expand"><div className="p-5 space-y-2"><AuthBox title="Human" body="root authority"/><AuthBox title="FinanceBot" body={a.task}/><AuthBox title="AgentPass" body={String(a.scopes.length)+" scopes · ₹"+a.budget+" budget"}/><AuthBox title="Protected tools" body="email.read · file.read"/></div></Section>
   </div>
 </div>
}
function Mini({label,value}:{label:string;value:string}){return <div><div className="text-[10px] uppercase tracking-[.1em] text-white/25">{label}</div><div className="mt-1 text-xs text-white/65">{value}</div></div>}
function AuthBox({title,body}:{title:string;body:string}){return <div className="rounded-xl border border-white/10 bg-white/[.025] px-4 py-3"><div className="text-xs font-medium">{title}</div><div className="mt-1 text-[10px] text-white/35">{body}</div></div>}

function Passes({state}:{state:AppState}){
 return <div className="space-y-6"><PageIntro eyebrow="Passes" title="Task-scoped credentials" body="Short-lived, key-bound and single-use authorization tickets."/><Section title="Active credentials"><div className="p-5"><div className="max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.08] via-white/[.025] to-transparent p-5"><div className="flex items-start justify-between"><div><div className="mono text-[9px] uppercase tracking-[.16em] text-white/30">AGENTPASS</div><div className="mt-2 text-lg font-semibold">FinanceBot</div></div><SecurityChip tone="green">Active</SecurityChip></div><div className="mt-8 grid grid-cols-2 gap-4"><Mini label="Pass ID" value="pass_fin_7C9A…"/><Mini label="Bound key" value={state.agents[0].keyId}/><Mini label="Budget" value={"₹"+state.agents[0].budget}/><Mini label="Chain" value="n → n+1"/></div><div className="mt-6 border-t border-white/10 pt-4"><div className="text-[10px] text-white/30">Security locks</div><div className="mt-2 flex gap-2"><SecurityChip tone="green">Vault</SecurityChip><SecurityChip tone="green">Bind</SecurityChip><SecurityChip tone="amber">Burn</SecurityChip></div></div></div></div></Section></div>
}

function AttackCenter(props:{state:AppState;run:(s:string)=>void;running:string|null;reset:()=>void;selected:SecurityEvent|null;setSelected:(e:SecurityEvent)=>void}){
 const {state,run,running,reset}=props;
 return <div className="space-y-6">
   <PageIntro eyebrow="Attack Center" title="Test what happens when an agent is manipulated" body="Deterministic simulations make the security boundary visible without relying on unpredictable model behavior." action={<Button variant="ghost" onClick={reset}><RefreshCw size={14}/>Reset demo</Button>}/>
   <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{ATTACKS.map(a=><div key={a.id} className="glass rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[.03]"><Skull size={15} className="text-white/50"/></div><DecisionBadge decision={a.expected}/></div><div className="mt-5 text-sm font-medium">{a.title}</div><p className="mt-2 min-h-[40px] text-xs leading-5 text-white/40">{a.desc}</p><div className="mt-4 text-[10px] text-white/30">Control · {a.control}</div><div className="mt-4"><Button onClick={()=>run(a.id)} disabled={!!running}>{running===a.id?<><RefreshCw size={13} className="animate-spin"/>Running</>:<><Play size={13}/>Run scenario</>}</Button></div></div>)}</div>
   <Section title="Gateway pipeline" subtitle={state.attackState?"Latest scenario · "+state.attackState.scenario:"Choose a scenario to see the full enforcement path"}><div className="p-5"><Pipeline steps={["Requested","Identity","Proof","Scope","Intent","Behavior","Risk","Decision"]} active={state.attackState?7:undefined}/>{state.attackState?<div className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4 flex items-center justify-between"><div><div className="text-xs font-medium">Gateway decision</div><div className="mt-1 text-[10px] text-white/35">Event {state.attackState.eventId}</div></div><DecisionBadge decision={state.attackState.result}/></div>:null}</div></Section>
 </div>
}

function Requests({state,setSelected}:{state:AppState;setSelected:(e:SecurityEvent)=>void}){
 return <div className="space-y-6"><PageIntro eyebrow="Requests" title="Request inspector" body="See the exact checks that surrounded each gateway decision."/><Section title="Gateway decisions"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b border-white/[.07] text-[10px] uppercase tracking-[.1em] text-white/25"><tr>{["Timestamp","Agent","Action","Tool","Risk","Decision","Reason"].map(x=><th key={x} className="px-5 py-3 font-medium">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/[.06]">{state.events.map(e=><tr key={e.id} onClick={()=>setSelected(e)} className="cursor-pointer hover:bg-white/[.02]"><td className="mono px-5 py-3 text-[10px] text-white/30">{e.ts}</td><td className="px-5 py-3 text-xs">{e.agent}</td><td className="mono px-5 py-3 text-[10px]">{e.action}</td><td className="px-5 py-3 text-xs text-white/50">{e.tool}</td><td className="px-5 py-3"><RiskBadge risk={e.risk}/></td><td className="px-5 py-3"><DecisionBadge decision={e.decision}/></td><td className="max-w-[340px] px-5 py-3 text-[11px] text-white/40">{e.reason}</td></tr>)}</tbody></table></div></Section></div>
}

function Approvals({state,refresh}:{state:AppState;refresh:()=>void}){
 const [busy,setBusy]=useState("");
 const pending=state.approvals.filter(a=>a.status==="PENDING");
 async function decide(id:string,decision:"APPROVED"|"DENIED"){
   try{setBusy(id);await api.decide(id,decision);await refresh();}finally{setBusy("");}
 }
 return <div className="space-y-6"><PageIntro eyebrow="Approvals" title="Human decision boundary" body="Sensitive actions remain blocked until an explicit decision is recorded."/>
 {pending.length===0?<Section title="Nothing waiting"><EmptyState title="No approvals" body="All sensitive actions are currently resolved."/></Section>:pending.map(a=><Section key={a.id} title="SECURITY APPROVAL REQUIRED" subtitle={a.agent+" is requesting a sensitive action"}><div className="p-5"><div className="grid gap-5 md:grid-cols-4"><Mini label="Action" value={a.action}/><Mini label="Amount" value={a.amount?"₹"+a.amount.toLocaleString("en-IN"):"—"}/><Mini label="Recipient" value={a.recipient||"—"}/><Mini label="Risk" value={String(a.risk)+"/100"}/></div><div className="mt-5 rounded-xl border border-[#edc66b]/15 bg-[#edc66b]/[.05] p-4 text-xs text-white/55">{a.reason}</div><div className="mt-5 grid gap-3 md:grid-cols-2"><Button variant="ghost" onClick={()=>decide(a.id,"DENIED")} disabled={busy===a.id}><X size={14}/>Deny</Button><Button variant="amber" onClick={()=>decide(a.id,"APPROVED")} disabled={busy===a.id}><Check size={14}/>Approve</Button></div><div className="mt-3 text-[10px] text-white/25">Prototype confirmation. No real passkey assertion is claimed unless WebAuthn is configured.</div></div></Section>)}</div>
}

function Causal({selected}:{selected:SecurityEvent|null}){
 return <div className="space-y-6"><PageIntro eyebrow="Causal Trace" title="Why the gateway made the decision" body="Trace the signals and controls that led to ALLOW, STEP-UP or DENY."/><div className="grid gap-6 xl:grid-cols-[1fr_320px]"><Section title="Causal path" subtitle="Evidence-first decision trace"><CausalGraph/></Section><Section title="Selected decision">{selected?<div className="p-5"><PanelRow left="Event" right={selected.id} mono/><PanelRow left="Decision" right={<DecisionBadge decision={selected.decision}/>}/><PanelRow left="Risk" right={<RiskBadge risk={selected.risk}/>} mono/><PanelRow left="Proof" right={selected.proof?"Verified":"Invalid"}/><PanelRow left="Scope" right={selected.scope?"Matched":"Mismatch"}/><PanelRow left="Intent" right={selected.intent?"Aligned":"Mismatch"}/><PanelRow left="Behavior" right={selected.behavior||"—"}/><PanelRow left="Reason" right={selected.reason}/></div>:<EmptyState title="Select a decision" body="Run a scenario, then inspect its causal evidence."/ >}</Section></div></div>
}

function Audit({state}:{state:AppState}){return <div className="space-y-6"><PageIntro eyebrow="Audit" title="Evidence and integrity" body="Identifiers, hashes and decisions are retained; secret material is not."/><Section title="Log integrity" subtitle="Hash-chain concept"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><SecurityChip tone="green">Verified</SecurityChip><span className="mono text-[10px] text-white/30">{state.events.length} events</span></div><div className="overflow-x-auto"><table className="w-full"><tbody className="divide-y divide-white/[.06]">{state.events.map(e=><tr key={e.id}><td className="mono px-5 py-3 text-[10px] text-white/30">{e.ts}</td><td className="mono px-5 py-3 text-[10px]">{e.id}</td><td className="px-5 py-3 text-xs">{e.agent}</td><td className="px-5 py-3"><DecisionBadge decision={e.decision}/></td><td className="mono px-5 py-3 text-[10px] text-white/35">{e.hash||"—"}</td></tr>)}</tbody></table></div></Section></div>}

function Vault(){return <div className="space-y-6"><PageIntro eyebrow="Vault" title="Credentials stay outside the agent runtime" body="Secret values are never rendered into the agent-facing workflow."/><div className="grid gap-4 md:grid-cols-2"><VaultCard name="Mail API" tool="email"/><VaultCard name="Payment API" tool="payment"/></div></div>}
function VaultCard({name,tool}:{name:string;tool:string}){return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">{name}</div><div className="mt-1 text-[10px] text-white/30">Tool · {tool}</div></div><SecurityChip tone="green">Stored</SecurityChip></div><div className="mono mt-6 text-sm tracking-[.2em] text-white/25">████████████</div><div className="mt-5 flex gap-2"><Button variant="ghost">Rotate</Button><Button variant="danger">Delete</Button></div></div>}

function Architecture(){return <div className="space-y-6"><PageIntro eyebrow="Architecture" title="Security boundary outside the model" body="Human → issuer → agent + signer → gateway → policy → broker → tool."/><Section title="System map"><div className="p-5"><ArchitectureFlow/></div></Section><Section title="The Three Locks" subtitle="The credential controls shown in the demo"><div className="grid gap-4 p-5 md:grid-cols-3"><ValueCard title="VAULT" body="Real API keys never enter the agent context." icon={<LockKeyhole/>}/><ValueCard title="BIND" body="Every request proves possession of the registered agent key." icon={<Fingerprint/>}/><ValueCard title="BURN" body="Every authorization ticket is consumed once." icon={<Archive/>}/></div></Section><Section title="Delegation graph" subtitle="Child permissions are a subset of parent permissions"><div className="p-5"><DelegationGraph/></div></Section></div>}
function ValueCard({title,body,icon}:{title:string;body:string;icon:React.ReactNode}){return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/45">{icon}</div><div className="mono mt-5 text-[10px] tracking-[.14em] text-white/35">{title}</div><p className="mt-2 text-xs leading-5 text-white/45">{body}</p></div>}

function DataFlow(){const rows=[["Human","Task + policy"],["Issuer","Pass + scope + expiry"],["Agent","Action request"],["Signer","Cryptographic proof"],["Gateway","Verification"],["Policy","Scope + budget + intent + behavior"],["Decision","Allow / Step-up / Deny"],["Broker","Temporary credential injection"],["Tool","Execution"],["Audit","Hash-chained event"],["Dashboard","Live telemetry"]];return <div className="space-y-6"><PageIntro eyebrow="Data Flow" title="What moves through the system" body="The UI exposes the lifecycle so a judge can follow the enforcement boundary."/><Section title="Request lifecycle"><div className="divide-y divide-white/[.06]">{rows.map((r,i)=><div key={r[0]} className="grid grid-cols-[120px_1fr_auto] items-center gap-4 px-5 py-4"><div className="text-xs font-medium">{r[0]}</div><div className="text-xs text-white/45">{r[1]}</div><div className="mono text-[10px] text-white/25">{String(i+1).padStart(2,"0")}</div></div>)}</div></Section></div>}

function SettingsScreen(){return <div className="space-y-6"><PageIntro eyebrow="Settings" title="Security configuration" body="Runtime posture and prototype boundaries."/><Section title="Runtime mode"><div className="p-5"><PanelRow left="Policy boundary" right="Gateway authoritative"/><PanelRow left="Demo tools" right="Deterministic mock tools"/><PanelRow left="WebAuthn" right="Prototype confirmation unless configured"/><PanelRow left="Real integrations" right="Not claimed"/></div></Section></div>}

function CommandPalette({close,run,setScreen,reset,revoke}:{close:()=>void;run:(s:string)=>void;setScreen:(s:Screen)=>void;reset:()=>void;revoke:()=>void}){
 const items:[string,()=>void][]=[
  ["Open Agents",()=>{setScreen("agents");close()}],
  ["Open Attack Center",()=>{setScreen("attacks");close()}],
  ["Open Audit",()=>{setScreen("audit");close()}],
  ["Run Prompt Injection",()=>{run("prompt-injection");close()}],
  ["Run Stolen Pass Replay",()=>{run("stolen-pass");close()}],
  ["Run Request Tampering",()=>{run("tampering");close()}],
  ["Run Payment Step-Up",()=>{run("payment");close()}],
  ["Revoke Agent",()=>{revoke();close()}],
  ["Reset Demo",()=>{reset();close()}]
 ];
 return <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[14vh] backdrop-blur-sm" onClick={close}><div className="glass w-full max-w-xl overflow-hidden rounded-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3"><Command size={15} className="text-white/30"/><input autoFocus placeholder="Search commands" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"/><Shortcut keys="Esc"/></div><div className="p-2">{items.map(([label,fn])=><button key={label} onClick={fn} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs text-white/70 hover:bg-white/[.05]"><span>{label}</span><ArrowRight size={13} className="text-white/20"/></button>)}</div></div></div>
}