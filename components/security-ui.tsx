"use client";
import { ReactNode } from "react";
import { ArrowUpRight, ChevronRight, ShieldCheck, Zap } from "lucide-react";
import { Decision } from "@/lib/types";

export function DecisionBadge({decision}:{decision:Decision}) {
  const c=decision==="ALLOW" ? "text-[#59e38a] border-[#59e38a]/20 bg-[#59e38a]/[.07]" : decision==="STEP-UP" ? "text-[#edc66b] border-[#edc66b]/20 bg-[#edc66b]/[.07]" : "text-[#ff717d] border-[#ff717d]/20 bg-[#ff717d]/[.07]";
  return <span className={"inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-[.08em] "+c}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{decision}</span>
}
export function RiskBadge({risk}:{risk:number}) {
  const c=risk>=85?"text-[#ff717d]":risk>=60?"text-[#edc66b]":"text-[#59e38a]";
  return <span className={"mono text-xs "+c}>{risk}</span>
}
export function Metric({label,value,detail,icon}:{label:string;value:string|number;detail?:string;icon?:ReactNode}) {
  return <div className="glass rounded-xl p-4 min-h-[112px] flex flex-col justify-between"><div className="flex items-center justify-between text-[11px] uppercase tracking-[.12em] text-white/45"><span>{label}</span>{icon && <span className="text-white/35">{icon}</span>}</div><div><div className="mt-2 text-3xl font-semibold tracking-[-.04em]">{value}</div>{detail&&<div className="mt-1 text-xs text-white/40">{detail}</div>}</div></div>
}
export function Section({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}) {
  return <section className="glass rounded-2xl overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-white/[.07] px-5 py-4"><div><h2 className="text-sm font-semibold">{title}</h2>{subtitle&&<p className="mt-1 text-xs text-white/40">{subtitle}</p>}</div>{action}</div>{children}</section>
}
export function EmptyState({title,body,button}:{title:string;body:string;button?:ReactNode}) {
  return <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"><ShieldCheck size={19} className="text-white/45"/></div><div className="text-sm font-medium">{title}</div><div className="mt-1 max-w-sm text-xs leading-5 text-white/40">{body}</div>{button&&<div className="mt-5">{button}</div>}</div>
}
export function PanelRow({left,right,mono=false}:{left:string;right:ReactNode;mono?:boolean}) {
  return <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[.06] last:border-0"><span className="text-xs text-white/45">{left}</span><span className={"text-xs "+(mono?"mono":"")}>{right}</span></div>
}
export function Button({children,onClick,variant="primary",disabled=false,className=""}:{children:ReactNode;onClick?:()=>void;variant?:"primary"|"ghost"|"danger"|"amber";disabled?:boolean;className?:string}) {
 const base="inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45";
 const v=variant==="primary"?"bg-white text-black hover:bg-white/90":variant==="danger"?"border border-[#ff717d]/25 bg-[#ff717d]/10 text-[#ff8590] hover:bg-[#ff717d]/15":variant==="amber"?"border border-[#edc66b]/25 bg-[#edc66b]/10 text-[#f0ce78] hover:bg-[#edc66b]/15":"border border-white/10 bg-white/[.03] text-white/80 hover:bg-white/[.06]";
 return <button className={base+" "+v+" "+className} onClick={onClick} disabled={disabled}>{children}</button>
}
export function SecurityChip({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"green"|"amber"|"red"}) {
 const cls=tone==="green"?"text-[#59e38a] bg-[#59e38a]/10 border-[#59e38a]/20":tone==="amber"?"text-[#edc66b] bg-[#edc66b]/10 border-[#edc66b]/20":tone==="red"?"text-[#ff717d] bg-[#ff717d]/10 border-[#ff717d]/20":"text-white/55 bg-white/[.03] border-white/10";
 return <span className={"inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[.1em] "+cls}>{children}</span>
}
export function Pipeline({steps,active}:{steps:string[];active?:number}) {
 return <div className="flex flex-wrap items-center gap-2">{steps.map((s,i)=><div key={s} className="flex items-center gap-2"><div className={"rounded-lg border px-2.5 py-2 text-[10px] uppercase tracking-[.08em] "+(active===i?"border-[#7aa2ff]/30 bg-[#7aa2ff]/10 text-[#9cb9ff]":"border-white/10 bg-white/[.025] text-white/45")}>{s}</div>{i<steps.length-1&&<ChevronRight size={12} className="text-white/20"/>}</div>)}</div>
}
export function LiveDot({children}:{children:string}) {
 return <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[.11em] text-white/45"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#59e38a]/40"/><span className="relative inline-flex h-2 w-2 rounded-full bg-[#59e38a]"/></span>{children}</span>
}
export function Shortcut({keys}:{keys:string}){return <span className="mono rounded border border-white/10 bg-white/[.03] px-1.5 py-0.5 text-[10px] text-white/40">{keys}</span>}
export function HeroLabel(){return <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[10px] uppercase tracking-[.15em] text-white/55"><Zap size={12}/><span>Continuous runtime enforcement</span><ArrowUpRight size={12}/></div>}
