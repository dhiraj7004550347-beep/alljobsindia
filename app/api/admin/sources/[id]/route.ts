import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseSourceInput } from "@/lib/automation/source-registry";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };

function sourceId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest, context: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = sourceId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  const source = await prisma.jobSource.findUnique({ where: { id } });
  return source
    ? NextResponse.json({ source })
    : NextResponse.json({ error: "Source not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const rate = await checkRateLimit({ namespace: "source-write", identifier: requestIp(request), limit: 60, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: "Source change limit reached" }, { status: 429 });
  const id = sourceId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  const parsed = await parseSourceInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const source = await prisma.jobSource.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ source });
  } catch {
    return NextResponse.json({ error: "Source not found or URL already exists" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const rate = await checkRateLimit({ namespace: "source-delete", identifier: requestIp(request), limit: 20, windowMs: 60 * 60_000 });
  if (!rate.allowed) return NextResponse.json({ error: "Source deletion limit reached" }, { status: 429 });
  const id = sourceId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  const jobs = await prisma.job.count({ where: { sourceId: id } });
  if (jobs > 0) {
    return NextResponse.json(
      { error: "This source has job history. Disable it instead of deleting it." },
      { status: 409 }
    );
  }
  await prisma.jobSource.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
