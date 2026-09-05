import type { JobSource } from "@prisma/client";
import {
  canonicalizeUrl,
  normalizeText,
  parseSupportedDate,
  sha256,
} from "./normalizer";
import { sanitizeCollectedJobFields } from "./field-sanitizer";
import type {
  CollectedJob,
  ManualReviewEligibility,
  PreviewJob,
} from "./types";

function normalizedDate(value: unknown) {
  return parseSupportedDate(value)?.toISOString().slice(0, 10) || "";
}

/**
 * Stable identity of one recruitment notice inside a registered source.
 * Related detail/apply/download links do not become separate review items.
 */
export function reviewCandidateKey(
  sourceId: number,
  candidate: Pick<
    CollectedJob,
    "sourceJobId" | "notificationLink" | "sourceUrl" | "title" | "lastDate"
  >
) {
  const sourceJobId = normalizeText(candidate.sourceJobId);
  const notificationUrl = canonicalizeUrl(candidate.notificationLink);
  const sourceUrl = canonicalizeUrl(candidate.sourceUrl);
  const identity = sourceJobId
    ? `source-job:${sourceJobId}`
    : notificationUrl
      ? `notification:${notificationUrl}`
      : `detail-title-date:${sourceUrl || ""}|${normalizeText(candidate.title)}|${normalizedDate(candidate.lastDate)}`;

  return sha256(`source:${sourceId}|${identity}`);
}

/** A changed official notice must be reviewed again before it can be acted on. */
export function reviewSnapshotHash(candidate: CollectedJob) {
  const values = [
    candidate.contentHash,
    candidate.title,
    candidate.department,
    candidate.qualification,
    candidate.vacancy,
    candidate.salary,
    candidate.ageLimit,
    candidate.location,
    candidate.applicationFee,
    candidate.selectionProcess,
    normalizedDate(candidate.applicationStartDate),
    normalizedDate(candidate.lastDate),
    canonicalizeUrl(candidate.applyLink),
    canonicalizeUrl(candidate.notificationLink),
    canonicalizeUrl(candidate.sourceUrl),
    candidate.sourceJobId,
  ].map((value) => String(value ?? "").trim());
  return sha256(JSON.stringify(values));
}

export function buildPreviewJob(
  candidate: CollectedJob,
  source: Pick<JobSource, "id" | "name">,
  confidence: number,
  action: PreviewJob["action"],
  reason: string
): PreviewJob {
  // The preview is a trust boundary. Sanitize here even when an adapter or AI
  // extractor already sanitized the candidate.
  const safe = sanitizeCollectedJobFields(candidate);
  return {
    title: safe.title,
    department: safe.department,
    qualification: safe.qualification,
    vacancy: safe.vacancy,
    salary: safe.salary,
    ageLimit: safe.ageLimit,
    location: safe.location,
    applicationFee: safe.applicationFee,
    selectionProcess: safe.selectionProcess,
    applicationStartDate: safe.applicationStartDate,
    lastDate: safe.lastDate,
    applyLink: canonicalizeUrl(safe.applyLink),
    notificationLink: canonicalizeUrl(safe.notificationLink),
    officialWebsite: canonicalizeUrl(safe.officialWebsite),
    sourceUrl: safe.sourceUrl,
    sourceId: source.id,
    sourceName: source.name,
    candidateKey: reviewCandidateKey(source.id, safe),
    snapshotHash: reviewSnapshotHash(safe),
    confidence,
    action,
    reason,
  };
}

export function manualDraftEligibility(
  preview: Pick<
    PreviewJob,
    "action" | "sourceId" | "candidateKey" | "snapshotHash"
  >,
  manualDraftsEnabled: boolean
): ManualReviewEligibility {
  if (!manualDraftsEnabled) {
    return {
      allowed: false,
      reason: "Manual draft creation is locked by the server environment.",
    };
  }
  if (preview.action !== "WOULD_ADD") {
    return {
      allowed: false,
      reason: `Only WOULD_ADD notices can become new drafts; this item is ${preview.action}.`,
    };
  }
  if (
    !Number.isInteger(preview.sourceId) ||
    preview.sourceId <= 0 ||
    !/^[a-f0-9]{64}$/.test(preview.candidateKey) ||
    !/^[a-f0-9]{64}$/.test(preview.snapshotHash)
  ) {
    return {
      allowed: false,
      reason: "The review identity is incomplete or invalid.",
    };
  }
  return {
    allowed: true,
    reason: "Eligible for an explicit admin-approved DRAFT only.",
  };
}

export function applyPersistedReviewDecision(
  preview: PreviewJob,
  decision: { decision: "REJECTED" | "NEEDS_CORRECTION"; reason: string },
) {
  const reason = decision.decision === "REJECTED"
    ? `Previously rejected exact source snapshot: ${decision.reason}`
    : `Needs correction before review: ${decision.reason}`;
  return {
    ...preview,
    action: decision.decision === "REJECTED" ? "REJECTED" : "LOW_CONFIDENCE",
    reason,
  } as PreviewJob;
}
