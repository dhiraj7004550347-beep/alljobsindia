import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { isSameOrigin } from "../../../../lib/admin-auth";
import { parseJobWriteData } from "../../../../lib/job-input";
import { revalidatePath } from "next/cache";
import { notifyGoogleIndexing } from "../../../../lib/google-indexing";
import { publicJobSelect } from "../../../../lib/public-job";
import { checkRateLimit, requestIp } from "../../../../lib/rate-limit";

type Context = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const { id } = await context.params;
    const jobId = parseId(id);

    if (!jobId) {
      return NextResponse.json(
        { error: "Invalid job ID." },
        { status: 400 }
      );
    }

    const admin = await isAdminRequest(request);

    const job = admin
      ? await prisma.job.findUnique({ where: { id: jobId } })
      : await prisma.job.findFirst({
          where: {
            id: jobId,
            status: "PUBLISHED",
            OR: [
              { lastDate: null, expiresAt: null },
              { lastDate: { gte: new Date() } },
              { expiresAt: { gte: new Date() } },
            ],
          },
          select: publicJobSelect,
        });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("GET JOB ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch job." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: Context
) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const rate = await checkRateLimit({ namespace: "job-write", identifier: requestIp(request), limit: 120, windowMs: 60 * 60_000 });
    if (!rate.allowed) return NextResponse.json({ error: "Job change limit reached." }, { status: 429 });
    const { id } = await context.params;
    const jobId = parseId(id);

    if (!jobId) {
      return NextResponse.json(
        { error: "Invalid job ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = parseJobWriteData(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, publishedAt: true },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 }
      );
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...parsed.data,
        expiresAt: parsed.data.lastDate,
        expiredAt: parsed.data.status === "EXPIRED" ? new Date() : null,
        publishedAt:
          parsed.data.status === "PUBLISHED" && !existingJob.publishedAt
            ? new Date()
            : undefined,
        reviewStatus: "MANUAL_VERIFIED",
      },
    });

    revalidateJobPaths(jobId);
    await notifyGoogleIndexing(
      `/jobs/${jobId}`,
      job.status === "PUBLISHED" ? "URL_UPDATED" : "URL_DELETED"
    );

    return NextResponse.json(job);
  } catch (error) {
    console.error("UPDATE JOB ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update job." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const rate = await checkRateLimit({ namespace: "job-delete", identifier: requestIp(request), limit: 30, windowMs: 60 * 60_000 });
    if (!rate.allowed) return NextResponse.json({ error: "Job deletion limit reached." }, { status: 429 });
    const { id } = await context.params;
    const jobId = parseId(id);

    if (!jobId) {
      return NextResponse.json(
        { error: "Invalid job ID." },
        { status: 400 }
      );
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 }
      );
    }

    await prisma.job.delete({
      where: { id: jobId },
    });

    revalidateJobPaths(jobId);
    await notifyGoogleIndexing(`/jobs/${jobId}`, "URL_DELETED");

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE JOB ERROR:", error);

    return NextResponse.json(
      { error: "Failed to delete job." },
      { status: 500 }
    );
  }
}

function revalidateJobPaths(id: number) {
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/government-jobs");
  revalidatePath("/private-jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/admin/jobs");
}
