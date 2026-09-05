import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";
import {
  AutomationOverlapError,
  AutomationWriteLockedError,
  runAutomation,
} from "@/lib/automation/engine";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const rate = await checkRateLimit({ namespace: "automation-run", identifier: requestIp(request), limit: 10, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: "Automation run limit reached" }, { status: 429 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await runAutomation({
      dryRun: body.dryRun !== false,
      sourceIds: [id],
      requestedBy: "admin-source-run",
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Source run failed",
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
