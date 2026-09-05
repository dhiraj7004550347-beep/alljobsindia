import { NextRequest, NextResponse } from "next/server";
import { automationConfig } from "@/lib/automation/config";
import { isAutomationAuthorized } from "@/lib/automation/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest
) {
  if (
    !(await isAutomationAuthorized(request))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const [sourceCount, enabledSourceCount, pendingSourceCount, lastRun] = await Promise.all([
    prisma.jobSource.count(),
    prisma.jobSource.count({ where: { enabled: true } }),
    prisma.jobSource.count({ where: { reviewStatus: "PENDING" } }),
    prisma.automationRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return NextResponse.json({
    success: true,
    dryRun: automationConfig.dryRun,
    autoPublish: automationConfig.allowAutoPublish,
    writeRunsEnabled: automationConfig.allowWriteRuns,
    manualDraftsEnabled: automationConfig.allowManualDrafts,
    reviewDecisionsEnabled: automationConfig.allowReviewDecisions,
    liveRunsCreateDrafts: automationConfig.allowWriteRuns,
    sourceCount,
    enabledSourceCount,
    pendingSourceCount,
    maxSources: automationConfig.maxSourcesPerRun,
    maxJobsPerRun: automationConfig.maxJobsPerRun,
    requestTimeout: automationConfig.requestTimeoutMs,
    aiEnabled: automationConfig.aiEnabled,
    modelConfigured: Boolean(automationConfig.model),
    lastRun,
  });
}
