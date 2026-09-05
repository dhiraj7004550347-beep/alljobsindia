import { NextRequest, NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation/engine";
import { isAutomationAuthorized } from "@/lib/automation/auth";
import { isSameOrigin } from "@/lib/admin-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest
) {
  const auth = await isAutomationAuthorized(request);
  if (!auth || (auth === "admin" && !isSameOrigin(request))) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const rate = await checkRateLimit({ namespace: "automation-run", identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: "Automation run limit reached" }, { status: 429 });
  }

  try {
    const result = await runAutomation({
      dryRun: true,
      requestedBy: "admin-preview",
    });

    return NextResponse.json({
      success: true,
      dryRun: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Preview failed",
      },
      { status: 500 }
    );
  }
}
