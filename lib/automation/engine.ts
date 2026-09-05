import "server-only";

import type { Job, JobSource, Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { automationConfig } from "./config";
import { collectSources } from "./collector";
import { extractWithOptionalAi } from "./ai-extractor";
import {
  addToDedupeIndex,
  changedFields,
  createDedupeIndex,
  findExistingJob,
} from "./dedupe";
import { expirePastJobs } from "./expiry";
import {
  createAutomationRun,
  finishAutomationRun,
  logRunItem,
} from "./logger";
import {
  canonicalizeUrl,
  nullableText,
  parseSupportedDate,
  sourceFingerprint,
} from "./normalizer";
import { enabledSources } from "./source-registry";
import { saveDiscoveredSources } from "./source-discovery";
import type {
  AutomationRunSummary,
  CollectedJob,
  PreviewJob,
  RunAutomationOptions,
  SourceTestSummary,
} from "./types";
import { validateCandidate } from "./validator";
import { notifyGoogleIndexing } from "@/lib/google-indexing";
import { classifyCandidateQuality } from "./quality";
import { sanitizeCollectedJobFields } from "./field-sanitizer";
import { applyPersistedReviewDecision, buildPreviewJob } from "./review";
import {
  readLatestReviewDecisions,
  reviewDecisionKey,
} from "./review-ledger";

export class AutomationOverlapError extends Error {
  constructor() {
    super("Another automation run is already active");
    this.name = "AutomationOverlapError";
  }
}

export class AutomationWriteLockedError extends Error {
  constructor() {
    super(
      "Automation write runs are locked. Keep AUTOMATION_DRY_RUN=true, or deliberately set AUTOMATION_DRY_RUN=false and AUTOMATION_ALLOW_WRITE_RUNS=true after review."
    );
    this.name = "AutomationWriteLockedError";
  }
}

const countsTemplate = () => ({
  sourcesChecked: 0,
  sourcesSucceeded: 0,
  sourcesFailed: 0,
  candidates: 0,
  rawLinks: 0,
  recruitmentLinks: 0,
  uniqueNotices: 0,
  parsedJobs: 0,
  rejected: 0,
  lowConfidence: 0,
  processed: 0,
  wouldAdd: 0,
  added: 0,
  updated: 0,
  duplicates: 0,
  expired: 0,
  skipped: 0,
  errors: 0,
  draftsCreated: 0,
});

function itemDetails(job: PreviewJob, extra: Record<string, unknown> = {}) {
  return { kind: "candidate", preview: job, proposedAction: job.action, ...extra } as Prisma.InputJsonValue;
}

export async function acquireAutomationLock(runId: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + automationConfig.runLockMinutes * 60_000);
  try {
    await prisma.automationLock.create({
      data: { key: "global", runId, acquiredAt: now, expiresAt },
    });
    return;
  } catch (error) {
    if (!(error instanceof PrismaRuntime.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const acquired = await prisma.automationLock.updateMany({
    where: { key: "global", expiresAt: { lt: now } },
    data: { runId, acquiredAt: now, expiresAt },
  });
  if (acquired.count === 0) throw new AutomationOverlapError();
}

export async function releaseAutomationLock(runId: number) {
  await prisma.automationLock.updateMany({
    where: { key: "global", runId },
    data: { runId: null, expiresAt: new Date(0) },
  });
}

export function buildAutomationJobData(
  candidate: CollectedJob,
  source: JobSource,
  runId: number,
  confidence: number,
  publish: boolean
): Prisma.JobUncheckedCreateInput {
  const lastDate = parseSupportedDate(candidate.lastDate);
  const startDate = parseSupportedDate(candidate.applicationStartDate);
  const postedDate = parseSupportedDate(candidate.postedDate);
  const sourceUpdatedAt = parseSupportedDate(candidate.updatedDate);
  const now = new Date();

  return {
    title: candidate.title.trim(),
    department: nullableText(candidate.department),
    qualification: nullableText(candidate.qualification),
    vacancy: nullableText(candidate.vacancy),
    salary: nullableText(candidate.salary),
    ageLimit: nullableText(candidate.ageLimit),
    location: nullableText(candidate.location),
    applicationFee: nullableText(candidate.applicationFee),
    selectionProcess: nullableText(candidate.selectionProcess),
    description: nullableText(candidate.description),
    howToApply: nullableText(candidate.howToApply),
    importantDates:
      candidate.importantDates && candidate.importantDates.length > 0
        ? (candidate.importantDates as unknown as Prisma.InputJsonValue)
        : PrismaRuntime.JsonNull,
    applicationStartDate: startDate,
    lastDate,
    applyLink: canonicalizeUrl(candidate.applyLink),
    notificationLink: canonicalizeUrl(candidate.notificationLink),
    officialWebsite: canonicalizeUrl(candidate.officialWebsite),
    category: source.category,
    status: publish ? "PUBLISHED" : "DRAFT",
    featured: false,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: canonicalizeUrl(candidate.sourceUrl) || source.startUrl,
    sourceJobId: nullableText(candidate.sourceJobId),
    sourceHash: sourceFingerprint(candidate),
    canonicalApplyUrl: canonicalizeUrl(candidate.applyLink),
    canonicalNoticeUrl: canonicalizeUrl(candidate.notificationLink),
    rawSourceReference: `${candidate.sourceUrl}#sha256=${candidate.contentHash}`.slice(0, 2_500),
    firstSeenAt: now,
    lastSeenAt: now,
    sourceUpdatedAt,
    automationConfidence: confidence,
    reviewStatus: publish ? "AUTO_VERIFIED" : "REVIEW_REQUIRED",
    automationRunId: runId,
    postedDate,
    expiresAt: lastDate,
    publishedAt: publish ? now : null,
  };
}

function updateData(
  existing: Job,
  candidate: CollectedJob,
  source: JobSource,
  runId: number,
  confidence: number,
  publish: boolean
): Prisma.JobUncheckedUpdateInput {
  const base = buildAutomationJobData(candidate, source, runId, confidence, publish);
  const update: Prisma.JobUncheckedUpdateInput = {
    lastSeenAt: new Date(),
    sourceUpdatedAt: base.sourceUpdatedAt,
    automationConfidence: confidence,
    automationRunId: runId,
    sourceHash: base.sourceHash,
    rawSourceReference: base.rawSourceReference,
    reviewStatus: publish ? "AUTO_VERIFIED" : "REVIEW_REQUIRED",
  };

  const assignIfPresent = (field: keyof CollectedJob, target = field) => {
    const value = candidate[field];
    if (value !== null && value !== undefined && value !== "") {
      Object.assign(update, { [target]: value });
    }
  };

  for (const field of [
    "title",
    "department",
    "qualification",
    "vacancy",
    "salary",
    "ageLimit",
    "location",
    "applicationFee",
    "selectionProcess",
    "description",
    "howToApply",
  ] as const) {
    assignIfPresent(field);
  }

  if (candidate.applicationStartDate) update.applicationStartDate = base.applicationStartDate;
  if (candidate.lastDate) {
    update.lastDate = base.lastDate;
    update.expiresAt = base.expiresAt;
  }
  if (candidate.applyLink) {
    update.applyLink = base.applyLink;
    update.canonicalApplyUrl = base.canonicalApplyUrl;
  }
  if (candidate.notificationLink) {
    update.notificationLink = base.notificationLink;
    update.canonicalNoticeUrl = base.canonicalNoticeUrl;
  }
  if (candidate.officialWebsite) update.officialWebsite = base.officialWebsite;
  if (candidate.sourceJobId) update.sourceJobId = base.sourceJobId;
  if (!existing.sourceId) {
    update.sourceId = source.id;
    update.sourceName = source.name;
    update.sourceUrl = base.sourceUrl;
  }

  // Applying an automated change to a public record is itself a publishing
  // action. If the current candidate does not pass every publication gate,
  // move the updated record back to review instead of silently changing live data.
  if (existing.status === "PUBLISHED" && !publish) {
    update.status = "DRAFT";
    update.featured = false;
  } else if (
    existing.status === "DRAFT" &&
    existing.reviewStatus !== "REJECTED" &&
    publish
  ) {
    update.status = "PUBLISHED";
    update.publishedAt = new Date();
  }

  const deadline = parseSupportedDate(candidate.lastDate);
  if (existing.status === "EXPIRED" && deadline && deadline > new Date()) {
    update.status = publish ? "PUBLISHED" : "DRAFT";
    update.expiredAt = null;
    if (publish) update.publishedAt = new Date();
  }
  return update;
}

function toExistingJob(data: Prisma.JobUncheckedCreateInput, id: number): Job {
  return {
    ...data,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Job;
}

export async function runAutomation(
  options: RunAutomationOptions | boolean = {}
): Promise<AutomationRunSummary> {
  const normalizedOptions: RunAutomationOptions =
    typeof options === "boolean" ? { dryRun: options } : options;
  const dryRun = normalizedOptions.dryRun ?? automationConfig.dryRun;
  if (!dryRun && !automationConfig.allowWriteRuns) {
    throw new AutomationWriteLockedError();
  }
  const startedAt = new Date();
  const counts = countsTemplate();
  const previewJobs: AutomationRunSummary["previewJobs"] = [];
  const run = await createAutomationRun(dryRun, normalizedOptions.requestedBy);
  let lockAcquired = false;
  let finalStatus: AutomationRunSummary["status"] = "RUNNING";

  try {
    await acquireAutomationLock(run.id);
    lockAcquired = true;

    const sources = (
      await enabledSources(normalizedOptions.sourceIds)
    ).slice(0, automationConfig.maxSourcesPerRun);
    const collection = await collectSources(sources);
    counts.sourcesChecked = collection.length;
    for (const result of collection) {
      counts.rawLinks += result.metrics.rawLinks;
      counts.recruitmentLinks += result.metrics.recruitmentLinks;
      counts.uniqueNotices += result.metrics.uniqueNotices;
      counts.rejected += result.metrics.rejectedNoise;
    }
    // Legacy field retained for persisted runs: it now means raw page links.
    counts.candidates = counts.rawLinks;

    // Query only records that could match this bounded run. Loading the whole jobs
    // table made each cron run slower as historical records accumulated.
    const candidateRefs = collection
      .flatMap((result) => result.jobs.map((job) => ({
        source: result.source,
        job: sanitizeCollectedJobFields(job),
      })))
      .slice(0, automationConfig.maxJobsPerRun);
    const matchFilters: Prisma.JobWhereInput[] = [];
    for (const { source, job } of candidateRefs) {
      const sourceJobId = nullableText(job.sourceJobId);
      const applyUrl = canonicalizeUrl(job.applyLink);
      const noticeUrl = canonicalizeUrl(job.notificationLink);
      if (sourceJobId) matchFilters.push({ sourceId: source.id, sourceJobId });
      if (job.isCorrigendum) matchFilters.push({ sourceId: source.id });
      if (applyUrl) {
        matchFilters.push({ canonicalApplyUrl: applyUrl }, { applyLink: applyUrl });
      }
      if (noticeUrl) {
        matchFilters.push({ canonicalNoticeUrl: noticeUrl }, { notificationLink: noticeUrl });
      }
      matchFilters.push({ sourceHash: sourceFingerprint(job) });
      matchFilters.push({ title: job.title.trim() });
    }
    const existingJobs = matchFilters.length
      ? await prisma.job.findMany({
          where: { OR: matchFilters },
          take: Math.max(100, automationConfig.maxJobsPerRun * 8),
        })
      : [];
    const dedupeIndex = createDedupeIndex(existingJobs);

    for (const sourceResult of collection) {
      const { source } = sourceResult;
      if (!sourceResult.succeeded) {
        counts.sourcesFailed++;
        counts.errors++;
        await prisma.jobSource.update({
          where: { id: source.id },
          data: {
            lastCheckedAt: new Date(),
            consecutiveFailures: { increment: 1 },
          },
        });
        await logRunItem({
          runId: run.id,
          sourceId: source.id,
          sourceName: source.name,
          action: "ERROR",
          error: sourceResult.error,
          reason: "Source collection failed; remaining sources continued",
        });
        continue;
      }

      counts.sourcesSucceeded++;
      const persistedDecisions = await readLatestReviewDecisions(source.id);
      await prisma.jobSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
        },
      });

      if (
        !dryRun &&
        sourceResult.contentHash &&
        source.lastContentHash === sourceResult.contentHash
      ) {
        counts.skipped += sourceResult.jobs.length;
        await logRunItem({
          runId: run.id,
          sourceId: source.id,
          sourceName: source.name,
          action: "SKIPPED",
          reason: "Source and linked notification content is unchanged since the last successful write run",
        });
        continue;
      }

      if (sourceResult.discoveredSources.length > 0) {
        const discoveredCount = dryRun
          ? sourceResult.discoveredSources.length
          : await saveDiscoveredSources(sourceResult.discoveredSources);
        await logRunItem({
          runId: run.id,
          sourceId: source.id,
          sourceName: source.name,
          action: "DISCOVERED_SOURCE",
          reason: dryRun
            ? `${discoveredCount} candidate source(s) found; dry run did not save them`
            : `${discoveredCount} untrusted disabled source(s) added for admin review`,
        });
      }

      const sourceErrorsBefore = counts.errors;
      let sourceCandidatesHandled = 0;
      for (const rawCandidate of sourceResult.jobs) {
        if (counts.parsedJobs >= automationConfig.maxJobsPerRun) break;

        try {
          const candidate = sanitizeCollectedJobFields(
            await extractWithOptionalAi(sanitizeCollectedJobFields(rawCandidate))
          );
          const validation = validateCandidate(candidate, source);
          counts.processed++;
          counts.parsedJobs++;
          const match = findExistingJob(dedupeIndex, candidate, source);
          if (candidate.isCorrigendum && !match) {
            counts.rejected++;
            const reason = "Amendment-only notice has no matching persistent Job; it cannot become a new Job.";
            const candidatePreview = buildPreviewJob(candidate, source, validation.confidence, "REJECTED", reason);
            previewJobs.push(candidatePreview);
            await logRunItem({
              runId: run.id, sourceId: source.id, sourceName: source.name,
              candidateTitle: candidate.title, action: "SKIPPED", reason,
              details: itemDetails(candidatePreview),
            });
            continue;
          }
          const quality = classifyCandidateQuality(
            candidate,
            validation.confidence,
            automationConfig.minimumDraftConfidence
          );

          if (quality.action !== "WOULD_ADD") {
            if (quality.action === "EXPIRED") counts.expired++;
            else if (quality.action === "LOW_CONFIDENCE") counts.lowConfidence++;
            else counts.rejected++;
            const candidatePreview = buildPreviewJob(candidate, source, validation.confidence, quality.action, quality.reason);
            previewJobs.push(candidatePreview);
            await logRunItem({
              runId: run.id, sourceId: source.id, sourceName: source.name,
              candidateTitle: candidate.title, action: "SKIPPED", reason: quality.reason,
              details: itemDetails(candidatePreview),
            });
            continue;
          }
          const unreviewedPreview = buildPreviewJob(
            candidate,
            source,
            validation.confidence,
            "WOULD_ADD",
            quality.reason,
          );
          const persistedDecision = persistedDecisions.get(reviewDecisionKey(unreviewedPreview));
          if (persistedDecision) {
            const decided = applyPersistedReviewDecision(unreviewedPreview, persistedDecision);
            if (decided.action === "REJECTED") counts.rejected++;
            else counts.lowConfidence++;
            await logRunItem({
              runId: run.id,
              sourceId: source.id,
              sourceName: source.name,
              candidateTitle: candidate.title,
              action: "SKIPPED",
              reason: decided.reason,
              details: itemDetails(decided),
            });
            previewJobs.push(decided);
            continue;
          }
          if (match) {
            const changes = changedFields(match.job, candidate);
            if (changes.length === 0) {
              counts.duplicates++;
              if (!dryRun) {
                await prisma.job.update({
                  where: { id: match.job.id },
                  data: { lastSeenAt: new Date(), automationRunId: run.id },
                });
              }
              await logRunItem({
                runId: run.id,
                sourceId: source.id,
                sourceName: source.name,
                candidateTitle: candidate.title,
                action: "DUPLICATE",
                // Dry runs use negative in-memory IDs to dedupe candidates
                // within the preview. They are not persisted Job rows and
                // therefore must never be written through the jobId FK.
                jobId: match.job.id > 0 ? match.job.id : null,
                reason: `Matched by ${match.matchedBy}; no supported field changed`,
                details: itemDetails(buildPreviewJob(candidate, source, validation.confidence, "DUPLICATE", `Matched a persistent Job by ${match.matchedBy}; no supported field changed.`), { matchedBy: match.matchedBy }),
              });
              previewJobs.push(buildPreviewJob(candidate, source, validation.confidence, "DUPLICATE", `Matched a persistent Job by ${match.matchedBy}; no supported field changed.`));
              continue;
            }

            counts.updated++;
            if (!dryRun) {
              const updated = await prisma.job.update({
                where: { id: match.job.id },
                data: updateData(
                  match.job as Job,
                  candidate,
                  source,
                  run.id,
                  validation.confidence,
                  validation.eligibleForAutoPublish
                ),
              });
              if (updated.status === "PUBLISHED") {
                await notifyGoogleIndexing(`/jobs/${updated.id}`, "URL_UPDATED");
              } else if (match.job.status === "PUBLISHED") {
                counts.draftsCreated++;
                await notifyGoogleIndexing(`/jobs/${updated.id}`, "URL_DELETED");
              }
            }
            const candidatePreview = buildPreviewJob(candidate, source, validation.confidence, dryRun ? "WOULD_UPDATE" : "UPDATED", `${dryRun ? "Would update" : "Updated"} persistent Job: ${changes.join(", ")}`);
            await logRunItem({
              runId: run.id,
              sourceId: source.id,
              sourceName: source.name,
              candidateTitle: candidate.title,
              action: "UPDATED",
              jobId: match.job.id > 0 ? match.job.id : null,
              reason: `${dryRun ? "Would update" : "Updated"}: ${changes.join(", ")}`,
              details: itemDetails(candidatePreview, { matchedBy: match.matchedBy, changedFields: changes }),
            });
            previewJobs.push(candidatePreview);
            continue;
          }

          const data = buildAutomationJobData(
            candidate,
            source,
            run.id,
            validation.confidence,
            validation.eligibleForAutoPublish
          );

          let newJobId = -(counts.processed + 1);
          if (dryRun) {
            counts.wouldAdd++;
          } else {
            const created = await prisma.job.create({ data });
            newJobId = created.id;
            counts.added++;
            if (created.status === "DRAFT") counts.draftsCreated++;
            if (created.status === "PUBLISHED") {
              await notifyGoogleIndexing(`/jobs/${created.id}`, "URL_UPDATED");
            }
          }

          // Preview rows are never inserted into the persistent-match index.
          // Otherwise a second raw link could be incorrectly reported as a DB update.
          if (!dryRun) addToDedupeIndex(dedupeIndex, toExistingJob(data, newJobId), String(data.sourceHash || ""));
          const candidatePreview = buildPreviewJob(candidate, source, validation.confidence, dryRun ? "WOULD_ADD" : data.status === "DRAFT" ? "ADDED" : "ADDED", validation.reasons.join("; "));
          await logRunItem({
            runId: run.id,
            sourceId: source.id,
            sourceName: source.name,
            candidateTitle: candidate.title,
            action: dryRun ? "WOULD_ADD" : "ADDED",
            jobId: dryRun ? null : newJobId,
            reason: validation.eligibleForAutoPublish
              ? "Trusted high-confidence source was eligible for publishing"
              : validation.reasons.join("; "),
            details: itemDetails(candidatePreview),
          });
          previewJobs.push(candidatePreview);
        } catch (error) {
          counts.skipped++;
          counts.errors++;
          await logRunItem({
            runId: run.id,
            sourceId: source.id,
            sourceName: source.name,
            candidateTitle: rawCandidate.title,
            action: "ERROR",
            error: error instanceof Error ? error.message : "Candidate processing failed",
            reason: "Candidate was isolated and skipped",
          });
        } finally {
          sourceCandidatesHandled++;
        }
      }

      if (
        !dryRun &&
        sourceResult.contentHash &&
        sourceCandidatesHandled === sourceResult.jobs.length &&
        counts.errors === sourceErrorsBefore
      ) {
        await prisma.jobSource.update({
          where: { id: source.id },
          data: { lastContentHash: sourceResult.contentHash },
        });
      }
    }

    // Existing job expiry is a write-run concern. Preview expiry is counted per notice above.
    if (!dryRun) counts.expired += await expirePastJobs(run.id, dryRun);
    await logRunItem({
      runId: run.id,
      action: "SKIPPED",
      sourceName: "Run metrics",
      reason: "V5 collection metrics",
      details: { kind: "metrics", ...counts, parserWarnings: collection.flatMap((result) => result.warnings) } as Prisma.InputJsonValue,
    });
    finalStatus = counts.errors > 0 ? "PARTIAL" : "COMPLETED";
    const completed = await finishAutomationRun(
      run.id,
      finalStatus,
      counts,
      startedAt
    );

      return {
      id: run.id,
      startedAt: startedAt.toISOString(),
      completedAt: completed.completedAt?.toISOString(),
      status: finalStatus,
      dryRun,
      durationMs: completed.durationMs || undefined,
        ...counts,
      wouldUpdate: counts.updated,
      previewJobs: previewJobs.slice(0, 20),
    };
  } catch (error) {
    finalStatus = "FAILED";
    counts.errors++;
    const message = error instanceof Error ? error.message : "Automation run failed";
    await finishAutomationRun(run.id, "FAILED", counts, startedAt, message);
    throw error;
  } finally {
    if (lockAcquired) await releaseAutomationLock(run.id);
  }
}

/** A read-only parser inspection for the Source Manager and PowerShell retest. */
export async function testSource(sourceId: number): Promise<SourceTestSummary> {
  const source = await prisma.jobSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found");
  const result = await collectSources([source]).then((items) => items[0]);
  const counts = countsTemplate();
  counts.sourcesChecked = 1;
  counts.rawLinks = result.metrics.rawLinks;
  counts.recruitmentLinks = result.metrics.recruitmentLinks;
  counts.uniqueNotices = result.metrics.uniqueNotices;
  counts.candidates = counts.rawLinks;
  counts.rejected = result.metrics.rejectedNoise;
  if (!result.succeeded) {
    counts.sourcesFailed = 1;
    counts.errors = 1;
    return {
      ...counts,
      wouldUpdate: 0,
      access: "BLOCKED_OR_FAILED",
      previewJobs: [],
      warnings: [...result.warnings, result.error || "Source collection failed"],
    } as SourceTestSummary;
  }

  counts.sourcesSucceeded = 1;
  const sanitizedJobs = result.jobs.map(sanitizeCollectedJobFields);
  const filters: Prisma.JobWhereInput[] = sanitizedJobs.flatMap((job) => {
    const values: Prisma.JobWhereInput[] = [{ sourceHash: sourceFingerprint(job) }, { title: job.title.trim() }];
    if (job.sourceJobId) values.push({ sourceId: source.id, sourceJobId: job.sourceJobId });
    if (job.isCorrigendum) values.push({ sourceId: source.id });
    const notice = canonicalizeUrl(job.notificationLink);
    if (notice) values.push({ canonicalNoticeUrl: notice }, { notificationLink: notice });
    return values;
  });
  const existing = filters.length ? await prisma.job.findMany({ where: { OR: filters }, take: 200 }) : [];
  const index = createDedupeIndex(existing);
  const previewJobs: PreviewJob[] = [];
  const persistedDecisions = await readLatestReviewDecisions(source.id);
  for (const rawCandidate of sanitizedJobs) {
    try {
      const candidate = sanitizeCollectedJobFields(
        await extractWithOptionalAi(rawCandidate)
      );
      const validation = validateCandidate(candidate, source);
      counts.processed++;
      counts.parsedJobs++;
      const match = findExistingJob(index, candidate, source);
      if (candidate.isCorrigendum && !match) {
        counts.rejected++;
        previewJobs.push(buildPreviewJob(candidate, source, validation.confidence, "REJECTED", "Amendment-only notice has no matching persistent Job; it cannot become a new Job."));
        continue;
      }
      const quality = classifyCandidateQuality(
        candidate,
        validation.confidence,
        automationConfig.minimumDraftConfidence
      );
      if (quality.action !== "WOULD_ADD") {
        if (quality.action === "EXPIRED") counts.expired++;
        else if (quality.action === "LOW_CONFIDENCE") counts.lowConfidence++;
        else counts.rejected++;
        previewJobs.push(buildPreviewJob(candidate, source, validation.confidence, quality.action, quality.reason));
        continue;
      }
      const proposed = buildPreviewJob(candidate, source, validation.confidence, "WOULD_ADD", quality.reason);
      const persistedDecision = persistedDecisions.get(reviewDecisionKey(proposed));
      if (persistedDecision) {
        const decided = applyPersistedReviewDecision(proposed, persistedDecision);
        if (decided.action === "REJECTED") counts.rejected++;
        else counts.lowConfidence++;
        previewJobs.push(decided);
        continue;
      }
      if (!match) {
        counts.wouldAdd++;
        previewJobs.push(proposed);
      } else {
        const changes = changedFields(match.job, candidate);
        if (changes.length) {
          counts.updated++;
          previewJobs.push(buildPreviewJob(candidate, source, validation.confidence, "WOULD_UPDATE", `Would update persistent Job: ${changes.join(", ")}`));
        } else {
          counts.duplicates++;
          previewJobs.push(buildPreviewJob(candidate, source, validation.confidence, "DUPLICATE", `Matches persistent Job by ${match.matchedBy}.`));
        }
      }
    } catch (error) {
      counts.errors++;
      previewJobs.push(buildPreviewJob(rawCandidate, source, 0, "LOW_CONFIDENCE", error instanceof Error ? error.message : "Candidate could not be parsed."));
    }
  }
  return {
    ...counts,
    wouldUpdate: counts.updated,
    access: "ACCESSIBLE",
    previewJobs,
    warnings: result.warnings,
  } as SourceTestSummary;
}
