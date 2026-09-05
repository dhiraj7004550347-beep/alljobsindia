import type { JobSource } from "@prisma/client";
import { z } from "zod";
import { automationConfig } from "./config";
import {
  canonicalizeUrl,
  cleanText,
  parseSupportedDate,
  sameDomain,
} from "./normalizer";
import type { CollectedJob, ValidationResult } from "./types";

const candidateSchema = z.object({
  title: z.string().trim().min(5).max(240),
  sourceUrl: z.string().url(),
  rawText: z.string().max(100_000),
  contentHash: z.string().length(64),
});

function validUrl(value: unknown) {
  return Boolean(canonicalizeUrl(value));
}

export function validateCandidate(job: CollectedJob, source: JobSource): ValidationResult {
  const parsed = candidateSchema.safeParse(job);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid job candidate");
  }

  let confidence = 0.1;
  const reasons: string[] = [];
  const deadline = parseSupportedDate(job.lastDate);
  const now = new Date();

  if (source.trusted && sameDomain(job.sourceUrl, source.domain)) {
    confidence += 0.18;
    reasons.push("trusted official source");
  } else if (!source.trusted) {
    reasons.push("untrusted source requires review");
  }

  if (cleanText(job.department)) confidence += 0.08;
  if (cleanText(job.qualification)) confidence += 0.08;
  if (cleanText(job.vacancy)) confidence += 0.07;
  if (cleanText(job.salary)) confidence += 0.05;
  if (cleanText(job.location)) confidence += 0.05;
  if (cleanText(job.ageLimit)) confidence += 0.03;
  if (cleanText(job.selectionProcess)) confidence += 0.03;
  if (cleanText(job.howToApply)) confidence += 0.02;
  if (job.sourceJobId) confidence += 0.09;

  if (cleanText(job.rawText).length >= 500) {
    confidence += 0.05;
    reasons.push("substantial official source text found");
  }

  if (validUrl(job.applyLink)) confidence += 0.12;
  if (validUrl(job.notificationLink)) confidence += 0.12;

  if (deadline && deadline > now) {
    confidence += 0.16;
    reasons.push("future application deadline found");
  } else if (deadline) {
    reasons.push("deadline has passed");
  } else {
    reasons.push("application deadline not reliably found");
  }

  confidence = Math.min(1, Number(confidence.toFixed(2)));
  const highConfidence = confidence >= automationConfig.highConfidenceThreshold;
  const eligibleForAutoPublish = Boolean(
    automationConfig.allowAutoPublish &&
      source.trusted &&
      source.autoPublish &&
      source.reviewStatus === "APPROVED" &&
      highConfidence &&
      deadline &&
      deadline > now &&
      (validUrl(job.applyLink) || validUrl(job.notificationLink))
  );

  if (!eligibleForAutoPublish) {
    reasons.push("saved as draft unless manually verified");
  }

  return { job, confidence, reasons, highConfidence, eligibleForAutoPublish };
}
