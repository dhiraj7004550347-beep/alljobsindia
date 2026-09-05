import { NextRequest, NextResponse } from "next/server";
import {
  AutomationOverlapError,
  AutomationWriteLockedError,
  runAutomation,
} from "@/lib/automation/engine";
import { isAutomationAuthorized } from "@/lib/automation/auth";
import { isSameOrigin } from "@/lib/admin-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest
) {
  const authorization = await isAutomationAuthorized(request);
  if (!authorization) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  if (authorization === "admin" && !isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  const rate = await checkRateLimit({
    namespace: "automation-run",
    identifier: requestIp(request),
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Automation run limit reached" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const dryRun = body.dryRun !== false;
    const sourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0).slice(0, 50)
      : undefined;

    const result = await runAutomation({
      dryRun,
      sourceIds,
      requestedBy: authorization === "admin" ? "admin" : "automation-secret",
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Automation failed",
      },
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
