import { NextRequest, NextResponse } from "next/server";
import { isAutomationAuthorized } from "@/lib/automation/auth";
import { readAutomationRuns } from "@/lib/automation/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest
) {
  if (
    !(await isAutomationAuthorized(request))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const runId = Number(request.nextUrl.searchParams.get("runId") || 0);
  const logs = await readAutomationRuns(20, Number.isInteger(runId) && runId > 0 ? runId : undefined);

  return NextResponse.json({
    success: true,
    logs,
  });
}
