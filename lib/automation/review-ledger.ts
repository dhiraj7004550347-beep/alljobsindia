import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PreviewJob } from "./types";

export type PersistedReviewDecision = {
  decision: "REJECTED" | "NEEDS_CORRECTION";
  reason: string;
  createdAt: Date;
};

function objectValue(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}

/**
 * Read the latest audit-only decision for each exact source snapshot. This is
 * deliberately a bounded read and never creates a run or rate-limit bucket.
 */
export async function readLatestReviewDecisions(sourceId: number) {
  const items = await prisma.automationRunItem.findMany({
    where: { sourceId, action: "SKIPPED" },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { details: true, createdAt: true },
  });
  const decisions = new Map<string, PersistedReviewDecision>();
  for (const item of items) {
    const details = objectValue(item.details);
    if (details?.kind !== "manual-review-decision") continue;
    const key = typeof details.candidateKey === "string" ? details.candidateKey : "";
    const snapshot = typeof details.snapshotHash === "string" ? details.snapshotHash : "";
    const decision = details.decision === "REJECTED" || details.decision === "NEEDS_CORRECTION"
      ? details.decision
      : null;
    if (!key || !snapshot || !decision) continue;
    const mapKey = `${key}|${snapshot}`;
    if (decisions.has(mapKey)) continue;
    decisions.set(mapKey, {
      decision,
      reason: typeof details.reason === "string" ? details.reason : "Persisted manual review decision.",
      createdAt: item.createdAt,
    });
  }
  return decisions;
}

export function reviewDecisionKey(preview: Pick<PreviewJob, "candidateKey" | "snapshotHash">) {
  return `${preview.candidateKey}|${preview.snapshotHash}`;
}
