import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { listSources, parseSourceInput } from "@/lib/automation/source-registry";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sources: await listSources() });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const rate = await checkRateLimit({
    namespace: "source-write",
    identifier: requestIp(request),
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Source change limit reached" }, { status: 429 });
  }

  const parsed = await parseSourceInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const source = await prisma.jobSource.create({ data: parsed.data });
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create source. The URL may already be registered." },
      { status: 409 }
    );
  }
}
