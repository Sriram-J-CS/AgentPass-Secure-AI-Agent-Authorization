import { NextResponse } from "next/server"; import { reset } from "@/lib/store";
export async function POST(){ return NextResponse.json(reset()); }