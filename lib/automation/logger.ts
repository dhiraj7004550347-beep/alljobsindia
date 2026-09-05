import "server-only";

import type { AutomationAction, AutomationRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createAutomationRun(dryRun: boolean, requestedBy?: string) {
  return prisma.automationRun.create({
    data: { dryRun, requestedBy: requestedBy?.slice(0, 120) || null },
  });
}

export async function logRunItem(input: {
  runId: number;
  sourceId?: number | null;
  sourceName?: string | null;
  candidateTitle?: string | null;
  action: AutomationAction;
  reason?: string | null;
  jobId?: number | null;
  error?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.automationRunItem.create({
    data: {
      ...input,
      sourceName: input.sourceName?.slice(0, 200) || null,
      candidateTitle: input.candidateTitle?.slice(0, 300) || null,
      reason: input.reason?.slice(0, 2_000) || null,
      error: input.error?.slice(0, 4_000) || null,
    },
  });
}

export async function finishAutomationRun(
  runId: number,
  status: AutomationRunStatus,
  counts: {
    sourcesChecked: number;
    sourcesSucceeded: number;
    sourcesFailed: number;
    candidates: number;
    processed: number;
    wouldAdd: number;
    added: number;
    updated: number;
    duplicates: number;
    expired: number;
    skipped: number;
    errors: number;
    draftsCreated: number;
  },
  startedAt: Date,
  errorMessage?: string
) {
  const completedAt = new Date();
  return prisma.automationRun.update({
    where: { id: runId },
    data: {
      ...counts,
      status,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      errorMessage: errorMessage?.slice(0, 4_000) || null,
    },
  });
}

export async function readAutomationRuns(limit = 20, runId?: number) {
  return prisma.automationRun.findMany({
    where: runId ? { id: runId } : undefined,
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
}
