import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    // This verifies both database reachability and the primary migrated Job table.
    await prisma.job.findFirst({ select: { id: true } });
    return NextResponse.json(
      {
        ok: true,
        service: "All Jobs India",
        status: "healthy",
        database: "reachable",
        timestamp,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health database check failed:", error instanceof Error ? error.message : "Unknown database error");
    return NextResponse.json(
      {
        ok: false,
        service: "All Jobs India",
        status: "unhealthy",
        database: "unreachable",
        timestamp,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
