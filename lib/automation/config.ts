function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

const model = (process.env.OPENAI_MODEL || "").trim();
const apiKey = (process.env.OPENAI_API_KEY || "").trim();
const dryRun = process.env.AUTOMATION_DRY_RUN !== "false";

export const automationConfig = {
  dryRun,
  // A caller cannot turn a dry-run deployment into a write deployment merely
  // by posting { dryRun: false }. Both independent gates must be opened.
  allowWriteRuns:
    !dryRun && process.env.AUTOMATION_ALLOW_WRITE_RUNS === "true",
  // Manual review actions are separate from scheduled/bulk write runs. They
  // remain locked until an operator deliberately enables each capability.
  allowManualDrafts:
    process.env.AUTOMATION_ALLOW_MANUAL_DRAFTS === "true",
  allowReviewDecisions:
    process.env.AUTOMATION_ALLOW_REVIEW_DECISIONS === "true",
  allowAutoPublish:
    !dryRun &&
    process.env.AUTOMATION_ALLOW_WRITE_RUNS === "true" &&
    process.env.AUTOMATION_ALLOW_AUTO_PUBLISH === "true",
  maxSourcesPerRun: positiveInteger(
    process.env.AUTOMATION_MAX_SOURCES,
    10
  ),
  maxJobsPerRun: positiveInteger(process.env.AUTOMATION_MAX_JOBS, 50),
  maxPdfsPerSource: positiveInteger(
    process.env.AUTOMATION_MAX_PDFS_PER_SOURCE,
    3
  ),
  maxNoticeEnrichmentsPerSource: positiveInteger(
    process.env.AUTOMATION_MAX_NOTICE_ENRICHMENTS,
    12
  ),
  maxSscApiPages: positiveInteger(
    process.env.AUTOMATION_MAX_SSC_API_PAGES,
    3
  ),
  maxPdfPages: positiveInteger(process.env.AUTOMATION_MAX_PDF_PAGES, 40),
  concurrency: positiveInteger(process.env.AUTOMATION_CONCURRENCY, 3),
  requestTimeoutMs: positiveInteger(
    process.env.AUTOMATION_TIMEOUT_MS,
    30_000
  ),
  maxHtmlBytes: positiveInteger(
    process.env.AUTOMATION_MAX_HTML_BYTES,
    5_000_000
  ),
  maxPdfBytes: positiveInteger(
    process.env.AUTOMATION_MAX_PDF_BYTES,
    15_000_000
  ),
  highConfidenceThreshold: boundedNumber(
    process.env.AUTOMATION_HIGH_CONFIDENCE,
    0.82,
    0.5,
    1
  ),
  minimumDraftConfidence: boundedNumber(
    process.env.AUTOMATION_MIN_DRAFT_CONFIDENCE,
    0.6,
    0.4,
    0.9
  ),
  runLockMinutes: positiveInteger(
    process.env.AUTOMATION_LOCK_MINUTES,
    30
  ),
  aiEnabled: Boolean(apiKey && model),
  model,
} as const;
