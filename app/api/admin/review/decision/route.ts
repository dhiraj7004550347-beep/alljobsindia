import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isSameOrigin } from "@/lib/admin-auth";
import { automationConfig } from "@/lib/automation/config";
import {
  ManualReviewConflictError,
  ManualReviewLockedError,
  ManualReviewNotFoundError,
  recordManualReviewDecision,
} from "@/lib/automation/manual-review";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  sourceId: z.number().int().positive(),
  candidateKey: z.string().regex(/^[a-f0-9]{64}$/),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["REJECTED", "NEEDS_CORRECTION"]),
  reason: z.string().trim().min(10).max(1_000),
}).strict();

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }
  if (!automationConfig.allowReviewDecisions) {
    return NextResponse.json(
      { success: false, error: "Persistent review decisions are locked. No database row was written." },
      { status: 423 }
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "A decision and a specific review reason are required." },
      { status: 400 }
    );
  }
  const rate = await checkRateLimit({
    namespace: "manual-review-decision",
    identifier: `${session.username}:${requestIp(request)}`,
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Manual review decision limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const result = await recordManualReviewDecision({
      ...parsed.data,
      actor: session.username,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const status = error instanceof ManualReviewLockedError
      ? 423
      : error instanceof ManualReviewNotFoundError
        ? 404
        : error instanceof ManualReviewConflictError
          ? 409
          : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Review decision failed.",
      },
      { status }
    );
  }
}
