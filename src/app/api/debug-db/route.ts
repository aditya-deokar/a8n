import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = await prisma.mcpOAuthAuthorizationCode.findFirst({
    orderBy: { createdAt: "desc" }
  });
  return new NextResponse(JSON.stringify(latest, (k, v) => typeof v === 'bigint' ? v.toString() : v), {
    headers: { 'Content-Type': 'application/json' }
  });
}
