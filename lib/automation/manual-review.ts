import "server-only";

import type { JobSource, Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { automationConfig } from "./config";
import { collectSources } from "./collector";
import { extractWithOptionalAi } from "./ai-extractor";
import {
  changedFields,
  createDedupeIndex,
  findExistingJob,
} from "./dedupe";
import {
  acquireAutomationLock,
  buildAutomationJobData,
  releaseAutomationLock,
} from "./engine";
import { sanitizeCollectedJobFields } from "./field-sanitizer";
import {
  createAutomationRun,
  finishAutomationRun,
  logRunItem,
} from "./logger";
import {
  canonicalizeUrl,
  nullableText,
  sourceFingerprint,
} from "./normalizer";
import { classifyCandidateQuality } from "./quality";
import {
  buildPreviewJob,
  manualDraftEligibility,
  reviewCandidateKey,
  reviewSnapshotHash,
} from "./review";
import type { CollectedJob, PreviewJob } from "./types";
import { validateCandidate } from "./validator";

export class ManualReviewLockedError extends Error {
  constructor(capability: "draft" | "decision") {
    super(
      capability === "draft"
        ? "Manual draft creation is locked by AUTOMATION_ALLOW_MANUAL_DRAFTS."
        : "Persistent review decisions are locked by AUTOMATION_ALLOW_REVIEW_DECISIONS."
    );
    this.name = "ManualReviewLockedError";
  }
}

export class ManualReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualReviewConflictError";
  }
}

export class ManualReviewNotFoundError extends Error {
  constructor(message = "The reviewed candidate is no longer present at the official source.") {
    super(message);
    this.name = "ManualReviewNotFoundError";
  }
}

type ResolvedReviewCandidate = {
  source: JobSource;
  candidate: CollectedJob;
  preview: PreviewJob;
  existing: { id: number } | null;
  matchedBy: string | null;
};

function runCounts(overrides: Partial<{
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
}> = {}) {
  return {
    sourcesChecked: 1,
    sourcesSucceeded: 1,
    sourcesFailed: 0,
    candidates: 1,
    processed: 1,
    wouldAdd: 0,
    added: 0,
    updated: 0,
    duplicates: 0,
    expired: 0,
    skipped: 0,
    errors: 0,
    draftsCreated: 0,
    ...overrides,
  };
}

function jsonDetails(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function existingMatch(candidate: CollectedJob, source: JobSource) {
  const filters: Prisma.JobWhereInput[] = [
    { sourceHash: sourceFingerprint(candidate) },
    { title: candidate.title.trim() },
  ];
  const sourceJobId = nullableText(candidate.sourceJobId);
  const notice = canonicalizeUrl(candidate.notificationLink);
  const apply = canonicalizeUrl(candidate.applyLink);
  if (sourceJobId) filters.push({ sourceId: source.id, sourceJobId });
  if (candidate.isCorrigendum) filters.push({ sourceId: source.id });
  if (notice) {
    filters.push(
      { canonicalNoticeUrl: notice },
      { notificationLink: notice }
    );
  }
  if (apply) {
    filters.push({ canonicalApplyUrl: apply }, { applyLink: apply });
  }

  const jobs = await prisma.job.findMany({
    where: { OR: filters },
    take: 200,
  });
  return findExistingJob(createDedupeIndex(jobs), candidate, source);
}

async function resolveReviewCandidate(input: {
  sourceId: number;
  candidateKey: string;
  snapshotHash: string;
}): Promise<ResolvedReviewCandidate> {
  const source = await prisma.jobSource.findUnique({
    where: { id: input.sourceId },
  });
  if (!source) throw new ManualReviewNotFoundError("Source not found.");

  const result = await collectSources([source]).then((items) => items[0]);
  if (!result?.succeeded) {
    throw new ManualReviewConflictError(
      result?.error || "The official source could not be inspected safely."
    );
  }

  let staleCandidateFound = false;
  for (const rawCandidate of result.jobs.slice(0, automationConfig.maxJobsPerRun)) {
    const candidate = sanitizeCollectedJobFields(
      await extractWithOptionalAi(sanitizeCollectedJobFields(rawCandidate))
    );
    if (reviewCandidateKey(source.id, candidate) !== input.candidateKey) {
      continue;
    }
    if (reviewSnapshotHash(candidate) !== input.snapshotHash) {
      staleCandidateFound = true;
      continue;
    }

    const validation = validateCandidate(candidate, source);
    const match = await existingMatch(candidate, source);
    let action: PreviewJob["action"];
    let reason: string;

    if (candidate.isCorrigendum && !match) {
      action = "REJECTED";
      reason = "Amendment-only notice has no matching persistent Job; it cannot become a new Job.";
    } else {
      const quality = classifyCandidateQuality(
        candidate,
        validation.confidence,
        automationConfig.minimumDraftConfidence
      );
      action = quality.action;
      reason = quality.reason;
      if (quality.action === "WOULD_ADD" && match) {
        const changes = changedFields(match.job, candidate);
        action = changes.length ? "WOULD_UPDATE" : "DUPLICATE";
        reason = changes.length
          ? `Would update persistent Job: ${changes.join(", ")}`
          : `Matches persistent Job by ${match.matchedBy}.`;
      }
    }

    return {
      source,
      candidate,
      preview: buildPreviewJob(
        candidate,
        source,
        validation.confidence,
        action,
        reason
      ),
      existing: match?.job || null,
      matchedBy: match?.matchedBy || null,
    };
  }

  if (staleCandidateFound) {
    throw new ManualReviewConflictError(
      "The official notice changed after preview. Reload it and review the new snapshot."
    );
  }
  throw new ManualReviewNotFoundError();
}

export async function createManualDraft(input: {
  sourceId: number;
  candidateKey: string;
  snapshotHash: string;
  actor: string;
}) {
  if (!automationConfig.allowManualDrafts) {
    throw new ManualReviewLockedError("draft");
  }

  const resolved = await resolveReviewCandidate(input);
  const eligibility = manualDraftEligibility(resolved.preview, true);
  if (!eligibility.allowed) {
    throw new ManualReviewConflictError(eligibility.reason);
  }

  const startedAt = new Date();
  const run = await createAutomationRun(
    false,
    `manual-review:${input.actor}`.slice(0, 120)
  );
  let lockAcquired = false;

  try {
    await acquireAutomationLock(run.id);
    lockAcquired = true;

    // Recheck persistence after acquiring the global lock. This makes repeated
    // clicks and concurrent approvals idempotent and never turns them into updates.
    const currentMatch = await existingMatch(
      resolved.candidate,
      resolved.source
    );
    if (currentMatch) {
      const changes = changedFields(currentMatch.job, resolved.candidate);
      const action = changes.length ? "WOULD_UPDATE" : "DUPLICATE";
      const reason = changes.length
        ? `Draft creation blocked: persistent Job ${currentMatch.job.id} would need a reviewed update (${changes.join(", ")}).`
        : `Draft already exists as persistent Job ${currentMatch.job.id}; matched by ${currentMatch.matchedBy}.`;
      const preview = buildPreviewJob(
        resolved.candidate,
        resolved.source,
        resolved.preview.confidence,
        action,
        reason
      );
      await logRunItem({
        runId: run.id,
        sourceId: resolved.source.id,
        sourceName: resolved.source.name,
        candidateTitle: resolved.candidate.title,
        action: changes.length ? "SKIPPED" : "DUPLICATE",
        jobId: currentMatch.job.id,
        reason,
        details: jsonDetails({
          kind: "manual-review-draft",
          actor: input.actor,
          candidateKey: input.candidateKey,
          snapshotHash: input.snapshotHash,
          preview,
          outcome: action,
        }),
      });
      await finishAutomationRun(
        run.id,
        "COMPLETED",
        runCounts({ duplicates: changes.length ? 0 : 1 }),
        startedAt
      );
      return {
        created: false,
        action,
        jobId: currentMatch.job.id,
        reason,
      } as const;
    }

    const data = buildAutomationJobData(
      resolved.candidate,
      resolved.source,
      run.id,
      resolved.preview.confidence,
      false
    );
    const job = await prisma.job.create({
      data: {
        ...data,
        status: "DRAFT",
        reviewStatus: "MANUAL_VERIFIED",
        featured: false,
        publishedAt: null,
      },
    });
    const reason = "Admin approved the current official-source snapshot as DRAFT. Nothing was published.";
    const preview = buildPreviewJob(
      resolved.candidate,
      resolved.source,
      resolved.preview.confidence,
      "ADDED",
      reason
    );
    await logRunItem({
      runId: run.id,
      sourceId: resolved.source.id,
      sourceName: resolved.source.name,
      candidateTitle: resolved.candidate.title,
      action: "ADDED",
      jobId: job.id,
      reason,
      details: jsonDetails({
        kind: "manual-review-draft",
        actor: input.actor,
        candidateKey: input.candidateKey,
        snapshotHash: input.snapshotHash,
        preview,
        outcome: "DRAFT_CREATED",
      }),
    });
    await finishAutomationRun(
      run.id,
      "COMPLETED",
      runCounts({ added: 1, draftsCreated: 1 }),
      startedAt
    );
    return {
      created: true,
      action: "DRAFT_CREATED",
      jobId: job.id,
      reason,
    } as const;
  } catch (error) {
    await finishAutomationRun(
      run.id,
      "FAILED",
      runCounts({ errors: 1 }),
      startedAt,
      error instanceof Error ? error.message : "Manual draft creation failed"
    ).catch(() => undefined);
    throw error;
  } finally {
    if (lockAcquired) await releaseAutomationLock(run.id);
  }
}

export async function recordManualReviewDecision(input: {
  sourceId: number;
  candidateKey: string;
  snapshotHash: string;
  actor: string;
  decision: "REJECTED" | "NEEDS_CORRECTION";
  reason: string;
}) {
  if (!automationConfig.allowReviewDecisions) {
    throw new ManualReviewLockedError("decision");
  }

  const resolved = await resolveReviewCandidate(input);
  const startedAt = new Date();
  const run = await createAutomationRun(
    true,
    `manual-review:${input.actor}`.slice(0, 120)
  );
  const reason = `${input.decision}: ${input.reason}`;
  await logRunItem({
    runId: run.id,
    sourceId: resolved.source.id,
    sourceName: resolved.source.name,
    candidateTitle: resolved.candidate.title,
    action: "SKIPPED",
    reason,
    jobId: resolved.existing?.id || null,
    details: jsonDetails({
      kind: "manual-review-decision",
      actor: input.actor,
      candidateKey: input.candidateKey,
      snapshotHash: input.snapshotHash,
      decision: input.decision,
      reason: input.reason,
      preview: resolved.preview,
    }),
  });
  await finishAutomationRun(
    run.id,
    "COMPLETED",
    runCounts({ skipped: 1 }),
    startedAt
  );
  return { saved: true, decision: input.decision, reason } as const;
}

export function isManualReviewDatabaseConflict(error: unknown) {
  return (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
