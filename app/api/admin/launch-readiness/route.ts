import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getLaunchReadiness } from "@/lib/automation/launch-readiness";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const readiness = await getLaunchReadiness();
    return NextResponse.json({ success: true, readiness }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to calculate launch readiness",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
