import { activePublishedJobsWhere } from "@/lib/public-jobs-query";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { isSameOrigin } from "../../../lib/admin-auth";
import { parseJobWriteData } from "../../../lib/job-input";
import { revalidatePath } from "next/cache";
import { notifyGoogleIndexing } from "../../../lib/google-indexing";
import { publicJobSelect } from "../../../lib/public-job";
import { checkRateLimit, requestIp } from "../../../lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminRequest(request);
    const now = new Date();
    const jobs = admin
      ? await prisma.job.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.job.findMany({
          where: {
            ...activePublishedJobsWhere(now),
          },
          orderBy: { createdAt: "desc" },
          select: publicJobSelect,
        });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("GET JOBS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch jobs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const rate = await checkRateLimit({ namespace: "job-write", identifier: requestIp(request), limit: 120, windowMs: 60 * 60_000 });
    if (!rate.allowed) return NextResponse.json({ error: "Job change limit reached." }, { status: 429 });
    const body = await request.json();
    const parsed = parseJobWriteData(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const job = await prisma.job.create({
      data: {
        ...parsed.data,
        publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
        expiresAt: parsed.data.lastDate,
        reviewStatus: "MANUAL_VERIFIED",
      },
    });

    revalidatePath("/");
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${job.id}`);
    if (job.status === "PUBLISHED") {
      await notifyGoogleIndexing(`/jobs/${job.id}`, "URL_UPDATED");
    }

    return NextResponse.json(job, {
      status: 201,
    });
  } catch (error) {
    console.error("CREATE JOB ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create job." },
      { status: 500 }
    );
  }
}
