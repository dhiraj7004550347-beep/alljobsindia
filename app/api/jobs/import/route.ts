import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { isSameOrigin } from "../../../../lib/admin-auth";
import { parseJobWriteData } from "../../../../lib/job-input";
import { checkRateLimit, requestIp } from "../../../../lib/rate-limit";
import { revalidatePath } from "next/cache";

const MAX_IMPORT_RECORDS = 1_000;
const MAX_IMPORT_BYTES = 5_000_000;

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const size = Number(request.headers.get("content-length") || 0);
    if (size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Import file is too large." }, { status: 413 });
    }
    const rate = await checkRateLimit({
      namespace: "job-import",
      identifier: requestIp(request),
      limit: 5,
      windowMs: 60 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many import attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }
    const body = await request.json();

    if (!Array.isArray(body) || body.length > MAX_IMPORT_RECORDS) {
      return NextResponse.json(
        {
          error: `Invalid backup file. A jobs array with at most ${MAX_IMPORT_RECORDS} records is required.`,
        },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const item of body) {
      if (!item || typeof item !== "object") {
        skipped++;
        continue;
      }

      const parsed = parseJobWriteData(
        item as Record<string, unknown>
      );

      if (!parsed.ok) {
        skipped++;
        continue;
      }

      const jobId = Number(
        (item as Record<string, unknown>).id
      );

      if (Number.isInteger(jobId) && jobId > 0) {
        await prisma.job.upsert({
          where: {
            id: jobId,
          },
          update: {
            ...parsed.data,
            expiresAt: parsed.data.lastDate,
            reviewStatus: "MANUAL_VERIFIED",
            publishedAt: undefined,
          },
          create: {
            id: jobId,
            ...parsed.data,
            expiresAt: parsed.data.lastDate,
            reviewStatus: "MANUAL_VERIFIED",
            publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
          },
        });
      } else {
        await prisma.job.create({
          data: {
            ...parsed.data,
            expiresAt: parsed.data.lastDate,
            reviewStatus: "MANUAL_VERIFIED",
            publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
          },
        });
      }

      imported++;
    }

    revalidatePath("/");
    revalidatePath("/jobs");
    revalidatePath("/admin/jobs");

    return NextResponse.json({
      success: true,
      imported,
      skipped,
    });
  } catch (error) {
    console.error("Import jobs error:", error);

    return NextResponse.json(
      { error: "Failed to import jobs" },
      { status: 500 }
    );
  }
}
