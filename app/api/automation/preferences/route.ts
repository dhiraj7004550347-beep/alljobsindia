import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const preferences = await prisma.jobAlertSubscription.findMany({
    select: {
      id: true,
      email: true,
      keywords: true,
      categories: true,
      locations: true,
      qualification: true,
      active: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ success: true, preferences });
}

const updateSchema = z.object({ id: z.string().min(1), active: z.boolean() }).strict();

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preference update." }, { status: 400 });
  }
  const preference = await prisma.jobAlertSubscription.update({
    where: { id: parsed.data.id },
    data: { active: parsed.data.active },
    select: { id: true, active: true, updatedAt: true },
  });
  return NextResponse.json({ success: true, preference });
}
