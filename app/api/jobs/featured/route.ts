import { activePublishedJobsWhere } from "@/lib/public-jobs-query";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicJobSelect } from "@/lib/public-job";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        ...activePublishedJobsWhere(),
        featured: true,
      },
      orderBy: { createdAt: "desc" },
      select: publicJobSelect,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Featured jobs API error:", error);
    return NextResponse.json({ error: "Failed to load featured jobs" }, { status: 500 });
  }
}
