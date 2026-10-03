import { NextResponse } from "next/server"; import { runScenario } from "@/lib/store";
export async function POST(){ return NextResponse.json(runScenario("revoke")); }