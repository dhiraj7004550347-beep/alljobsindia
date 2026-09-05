import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isSameOrigin } from "@/lib/admin-auth";
import { automationConfig } from "@/lib/automation/config";
import {
  createManualDraft,
  isManualReviewDatabaseConflict,
  ManualReviewConflictError,
  ManualReviewLockedError,
  ManualReviewNotFoundError,
} from "@/lib/automation/manual-review";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  sourceId: z.number().int().positive(),
  candidateKey: z.string().regex(/^[a-f0-9]{64}$/),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmation: z.literal("CREATE_DRAFT"),
}).strict();

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  // Evaluate the feature lock before rate limiting so a blocked request cannot
  // write even a RateLimitBucket row.
  if (!automationConfig.allowManualDrafts) {
    return NextResponse.json(
      {
        success: false,
        error: "Manual draft creation is locked. No Job was written.",
      },
      { status: 423 }
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid or incomplete manual-review confirmation." },
      { status: 400 }
    );
  }

  const rate = await checkRateLimit({
    namespace: "manual-draft",
    identifier: `${session.username}:${requestIp(request)}`,
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Manual draft limit reached." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const result = await createManualDraft({
      ...parsed.data,
      actor: session.username,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const status = error instanceof ManualReviewLockedError
      ? 423
      : error instanceof ManualReviewNotFoundError
        ? 404
        : error instanceof ManualReviewConflictError || isManualReviewDatabaseConflict(error)
          ? 409
          : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Manual draft creation failed.",
      },
      { status }
    );
  }
}
