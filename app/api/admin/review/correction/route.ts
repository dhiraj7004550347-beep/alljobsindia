import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isSameOrigin } from "@/lib/admin-auth";
import { automationConfig } from "@/lib/automation/config";
import {
  recordManualReviewCorrection, readManualReviewCorrections,
  ManualReviewLockedError, ManualReviewConflictError, ManualReviewNotFoundError,
} from "@/lib/automation/manual-review";
import { sanitizeReviewCorrections, ReviewCorrectionValidationError } from "@/lib/automation/review-corrections";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const inputSchema = z.object({
  sourceId: z.number().int().positive(),
  candidateKey: z.string().regex(/^[a-f0-9]{64}$/),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  corrections: z.record(z.string(), z.union([z.string().max(2000), z.null()])),
}).strict();

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const id = Number(request.nextUrl.searchParams.get("sourceId"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid source ID" }, { status: 400, headers });
  try {
    return NextResponse.json({ saved: await readManualReviewCorrections(id) }, { headers });
  } catch {
    return NextResponse.json({ error: "Saved corrections could not be loaded." }, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers });
  if (!isSameOrigin(request)) return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403, headers });
  if (!automationConfig.allowReviewDecisions) {
    return NextResponse.json({ success: false, error: "Review corrections are locked." }, { status: 423, headers });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid correction request." }, { status: 400, headers });
  let corrections;
  try { corrections = sanitizeReviewCorrections(parsed.data.corrections); }
  catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid corrections." }, { status: 400, headers });
  }
  if (!Object.keys(corrections).length) return NextResponse.json({ success: false, error: "At least one changed field is required." }, { status: 400, headers });
  const rate = await checkRateLimit({
    namespace: "manual-review-correction", identifier: `${session.username}:${requestIp(request)}`,
    limit: 60, windowMs: 60 * 60_000,
  });
  if (!rate.allowed) return NextResponse.json({ success: false, error: "Correction limit reached." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const result = await recordManualReviewCorrection({ ...parsed.data, corrections, actor: session.username });
    return NextResponse.json({ success: true, result }, { headers });
  } catch (error) {
    const status = error instanceof ReviewCorrectionValidationError ? 400
      : error instanceof ManualReviewLockedError ? 423
        : error instanceof ManualReviewNotFoundError ? 404
          : error instanceof ManualReviewConflictError ? 409 : 500;
    return NextResponse.json({ success: false, error: status === 500 ? "Correction could not be saved." : (error as Error).message }, { status, headers });
  }
}
