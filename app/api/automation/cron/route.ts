import { NextRequest, NextResponse } from "next/server";
import {
  AutomationOverlapError,
  AutomationWriteLockedError,
  runAutomation,
} from "@/lib/automation/engine";
import { automationConfig } from "@/lib/automation/config";
import { isCronAuthorized } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

async function handle(
  request: NextRequest
) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const result = await runAutomation({
      dryRun: automationConfig.dryRun,
      requestedBy: "cron",
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof AutomationOverlapError ? error.message : "Automation run failed" },
      {
        status: error instanceof AutomationOverlapError
          ? 409
          : error instanceof AutomationWriteLockedError
            ? 423
            : 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  return handle(request);
}

// Vercel schedules invoke GET. Both entry points use the same authentication
// and server-controlled write gates.
export async function GET(request: NextRequest) {
  return handle(request);
}
