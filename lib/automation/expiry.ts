import "server-only";

import { prisma } from "@/lib/prisma";
import { logRunItem } from "./logger";
import { notifyGoogleIndexing } from "@/lib/google-indexing";

export async function expirePastJobs(runId: number, dryRun: boolean) {
  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ lastDate: { lt: now } }, { expiresAt: { lt: now } }],
    },
    select: { id: true, title: true, sourceId: true, sourceName: true },
    take: 1_000,
  });

  if (!dryRun && jobs.length > 0) {
    await prisma.job.updateMany({
      where: { id: { in: jobs.map((job) => job.id) }, status: "PUBLISHED" },
      data: { status: "EXPIRED", expiredAt: now, featured: false },
    });
    // Keep a single run within the default Indexing API onboarding quota.
    const indexingJobs = jobs.slice(0, 200);
    for (let index = 0; index < indexingJobs.length; index += 3) {
      await Promise.all(
        indexingJobs.slice(index, index + 3).map((job) =>
          notifyGoogleIndexing(`/jobs/${job.id}`, "URL_DELETED")
        )
      );
    }
  }

  for (const job of jobs.slice(0, 200)) {
    await logRunItem({
      runId,
      sourceId: job.sourceId,
      sourceName: job.sourceName,
      candidateTitle: job.title,
      action: "EXPIRED",
      jobId: job.id,
      reason: dryRun ? "Would mark expired; dry run made no job change" : "Application deadline passed",
    });
  }
  return jobs.length;
}
