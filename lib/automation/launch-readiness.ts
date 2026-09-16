import "server-only";

import { prisma } from "@/lib/prisma";
import { activePublishedJobsWhere } from "../public-jobs-query";
import { automationConfig } from "./config";

export type LaunchReadinessCheck = {
  key: string;
  label: string;
  passed: boolean;
  severity: "BLOCKER" | "WARNING";
  detail: string;
};

export type LaunchReadiness = {
  ready: boolean;
  generatedAt: string;
  checks: LaunchReadinessCheck[];
  counts: {
    sources: number;
    unsafeSources: number;
    publishedJobs: number;
    draftJobs: number;
    latestRunId: number | null;
  };
};

function check(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: LaunchReadinessCheck["severity"] = "BLOCKER",
): LaunchReadinessCheck {
  return { key, label, passed, detail, severity };
}

function validPublicSiteUrl() {
  const value = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return process.env.NODE_ENV !== "production" || url.hostname !== "localhost";
  } catch {
    return false;
  }
}

/**
 * Read-only operator checklist. It intentionally does not run source fetches,
 * mutate health timestamps, or create an automation run. Source fetches remain
 * an explicit action in Manual Review / Sources.
 */
export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const checks: LaunchReadinessCheck[] = [];
  let databaseOk = true;
  const now = new Date();
  let enabledSources = 0;
  let latestRunStartedAt: Date | null = null;
  let sources = 0;
  let unsafeSources = 0;
  let publishedJobs = 0;
  let draftJobs = 0;
  let latestRunId: number | null = null;
  let latestRunStatus: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    const [sourceRows, published, drafts, latestRun] = await Promise.all([
      prisma.jobSource.findMany({
        select: { enabled: true, trusted: true, autoPublish: true, reviewStatus: true },
      }),
      prisma.job.count({ where: activePublishedJobsWhere(now) }),
      prisma.job.count({ where: { status: "DRAFT" } }),
      prisma.automationRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, startedAt: true },
      }),
    ]);
    sources = sourceRows.length;
    enabledSources = sourceRows.filter(source => source.enabled && source.trusted && source.reviewStatus === "APPROVED").length;
    // A source may be deliberately approved/trusted for controlled collection
    // later. It is unsafe only when trust/approval is inconsistent or the
    // per-source auto-publish flag is on; the global publish gate is checked
    // separately below.
    unsafeSources = sourceRows.filter((source) =>
      source.autoPublish ||
      (source.trusted && source.reviewStatus !== "APPROVED") ||
      (source.enabled && (!source.trusted || source.reviewStatus !== "APPROVED"))
    ).length;
    publishedJobs = published;
    draftJobs = drafts;
    latestRunId = latestRun?.id ?? null;
    latestRunStatus = latestRun?.status ?? null;
    latestRunStartedAt = latestRun?.startedAt ?? null;
  } catch {
    databaseOk = false;
  }

  checks.push(check(
    "database",
    "Database is reachable",
    databaseOk,
    databaseOk ? "PostgreSQL read check passed." : "Database is unreachable; do not launch or run automation.",
  ));
  checks.push(check(
    "site-url",
    "Public site URL is configured",
    validPublicSiteUrl(),
    validPublicSiteUrl()
      ? "NEXT_PUBLIC_SITE_URL is an absolute HTTP(S) URL."
      : "Set NEXT_PUBLIC_SITE_URL to the final public URL before launch.",
  ));
  checks.push(check(
    "admin-secret",
    "Admin secret is strong",
    (process.env.ADMIN_SECRET || "").length >= 32,
    (process.env.ADMIN_SECRET || "").length >= 32
      ? "ADMIN_SECRET meets the minimum length."
      : "ADMIN_SECRET must be a unique random value of at least 32 characters.",
  ));
  checks.push(check(
    "dry-run",
    "Automation default is dry-run",
    automationConfig.dryRun,
    automationConfig.dryRun ? "AUTOMATION_DRY_RUN=true." : "Dry-run is disabled.",
  ));
  checks.push(check(
    "bulk-writes",
    "Bulk automation writes are locked",
    !automationConfig.allowWriteRuns,
    !automationConfig.allowWriteRuns ? "Bulk write gate is locked." : "Bulk write gate is open.",
  ));
  checks.push(check(
    "manual-drafts",
    "Manual draft creation is available",
    automationConfig.allowManualDrafts,
    automationConfig.allowManualDrafts ? "Reviewed drafts can be created; they remain unpublished." : "Manual draft creation is locked. Enable it only when ready to save reviewed notices.",
    "WARNING",
  ));
  checks.push(check(
    "review-decisions",
    "Correction saving is available",
    automationConfig.allowReviewDecisions,
    automationConfig.allowReviewDecisions ? "Corrections and review decisions can be saved." : "Correction saving is locked; edits cannot be persisted yet.",
    "WARNING",
  ));
  checks.push(check(
    "auto-publish",
    "Auto-publish is disabled",
    !automationConfig.allowAutoPublish,
    !automationConfig.allowAutoPublish ? "Global auto-publish gate is off." : "Global auto-publish gate is on.",
  ));
  checks.push(check(
    "source-safety",
    "Registered sources have a safe reviewed state",
    databaseOk && unsafeSources === 0,
    !databaseOk
      ? "Source state could not be checked without the database."
      : unsafeSources === 0
        ? `${sources} source(s) have consistent review/trust/enablement state and per-source auto-publish is off.`
        : `${unsafeSources} source(s) have inconsistent trust/approval/enablement or per-source auto-publish enabled. Review them before launch.`,
  ));
  checks.push(check(
    "content",
    "At least one active public job is available",
    databaseOk && publishedJobs > 0,
    !databaseOk
      ? "Published content could not be checked."
      : publishedJobs > 0
        ? `${publishedJobs} active public job(s) are available.`
        : "No active public job exists; expired published records do not count.",
  ));
  checks.push(check(
    "enabled-sources", "Scheduled collection has approved sources",
    databaseOk && enabledSources > 0,
    `${enabledSources} approved, trusted source(s) are enabled. Disabled sources remain available for read-only review.`,
    "WARNING",
  ));
  const recentSuccessfulRun = Boolean(latestRunStartedAt && latestRunStatus === "COMPLETED" &&
    latestRunStartedAt.getTime() <= now.getTime() && now.getTime() - latestRunStartedAt.getTime() <= 48 * 60 * 60 * 1000);
  checks.push(check(
    "recent-run", "Latest automation run completed within 48 hours",
    databaseOk && recentSuccessfulRun,
    latestRunStartedAt
      ? `Latest run #${latestRunId}: ${latestRunStatus}, started ${latestRunStartedAt.toISOString()}. A completed dry-run does not verify publishing or alert delivery.`
      : "No automation run is available. Verify the schedule and source configuration.",
    "WARNING",
  ));

  return {
    ready: checks.every((item) => item.passed || item.severity === "WARNING"),
    generatedAt: new Date().toISOString(),
    checks,
    counts: { sources, unsafeSources, publishedJobs, draftJobs, latestRunId },
  };
}
