import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const jobs = await prisma.job.findMany({
      orderBy: {
        id: "asc",
      },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Export jobs error:", error);

    return NextResponse.json(
      { error: "Failed to export jobs" },
      { status: 500 }
    );
  }
}
