import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";
import { testSource } from "@/lib/automation/engine";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const SOURCE_TEST_API_VERSION = "V11-LAUNCH-1";

// Source tests are intentionally write-free, so their abuse guard must not
// use the database-backed RateLimitBucket table. Keep a small process-local
// guard for overlapping requests and runaway refresh loops.
const activeTests = new Set<number>();
const recentTests = new Map<number, number[]>();
const MAX_TESTS_PER_MINUTE = 8;

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      service: "AllJobsIndia source test",
      version: SOURCE_TEST_API_VERSION,
      writeMode: "none",
      candidateIdentity: "canonical-review-key-v1",
      snapshotIdentity: "source-snapshot-v1",
      persistedDecisionOverlay: "review-ledger-v1",
      rateLimit: "process-local-8-per-minute-per-source",
    },
    { headers: responseHeaders }
  );
}

export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }
  // This endpoint intentionally does not create a run, update a source, or write a Job.
  const now = Date.now();
  const recent = (recentTests.get(id) || []).filter((timestamp) => now - timestamp < 60_000);
  if (activeTests.has(id)) {
    return NextResponse.json(
      { success: false, error: "A read-only source test is already running for this source." },
      { status: 409, headers: responseHeaders },
    );
  }
  if (recent.length >= MAX_TESTS_PER_MINUTE) {
    return NextResponse.json(
      { success: false, error: "Read-only source-test limit reached. Try again shortly." },
      { status: 429, headers: { ...responseHeaders, "Retry-After": "60" } },
    );
  }
  recent.push(now);
  recentTests.set(id, recent);
  activeTests.add(id);
  try {
    const result = await testSource(id);
    return NextResponse.json(
      { success: true, result },
      { headers: responseHeaders }
    );
  } catch (error) {
    // Keep parser/network failures inspectable by clients without leaking a
    // stack trace. Database failures still use a non-2xx response because no
    // meaningful source result can be produced without the registry.
    const message = error instanceof Error ? error.message : "Source test failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 503, headers: responseHeaders },
    );
  } finally {
    activeTests.delete(id);
  }
}
