import { sanitizeCollectedJobFields } from "./field-sanitizer";
import type { CollectedJob } from "./types";

export const REVIEW_CORRECTION_FIELDS = [
  "department", "qualification", "vacancy", "salary", "ageLimit", "location",
  "applicationFee", "selectionProcess", "applicationStartDate", "lastDate",
  "applyLink", "notificationLink", "officialWebsite",
] as const;
export type ReviewCorrectionField = (typeof REVIEW_CORRECTION_FIELDS)[number];
export type ReviewCorrections = Partial<Record<ReviewCorrectionField, string | null>>;
const dates = new Set<string>(["applicationStartDate", "lastDate"]);
const links = new Set<string>(["applyLink", "notificationLink", "officialWebsite"]);

export class ReviewCorrectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewCorrectionValidationError";
  }
}

function exactDate(field: string, value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const indian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!iso && !indian) {
    throw new ReviewCorrectionValidationError(`${field}: use YYYY-MM-DD or DD/MM/YYYY.`);
  }
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(indian![3]), Number(indian![2]), Number(indian![1])];
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  if (year < 1900 || year > 9999 || check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new ReviewCorrectionValidationError(`${field}: invalid calendar date.`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function sanitizeReviewCorrections(input: unknown): ReviewCorrections {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ReviewCorrectionValidationError("Corrections must be an object.");
  }
  const allowed = new Set<string>(REVIEW_CORRECTION_FIELDS);
  const result: ReviewCorrections = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key)) throw new ReviewCorrectionValidationError(`Unsupported correction field: ${key}`);
    const field = key as ReviewCorrectionField;
    if (raw === null || raw === undefined) { result[field] = null; continue; }
    if (typeof raw !== "string") throw new ReviewCorrectionValidationError(`${key} must be text or blank.`);
    let value = raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
    if (value.length > 2000) throw new ReviewCorrectionValidationError(`${key}: maximum 2000 characters.`);
    if (!value) { result[field] = null; continue; }
    if (dates.has(key)) value = exactDate(key, value);
    if (links.has(key)) {
      let url: URL;
      try { url = new URL(value); }
      catch { throw new ReviewCorrectionValidationError(`${key}: enter a complete HTTP or HTTPS URL.`); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname) {
        throw new ReviewCorrectionValidationError(`${key}: enter an HTTP or HTTPS URL without credentials.`);
      }
      for (const name of Array.from(url.searchParams.keys())) {
        if (/^utm_/i.test(name) || /^(fbclid|gclid|dclid|msclkid)$/i.test(name)) url.searchParams.delete(name);
      }
      // Preserve business parameters (including ref) and PDF page fragments.
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
      value = url.toString();
    }
    result[field] = value;
  }
  return result;
}

export function applyReviewCorrections<T extends object>(candidate: T, corrections: unknown): T & ReviewCorrections {
  return { ...candidate, ...sanitizeReviewCorrections(corrections) };
}

export function prepareCorrectedCandidate(candidate: CollectedJob, corrections: unknown): CollectedJob {
  const corrected = sanitizeCollectedJobFields(applyReviewCorrections(candidate, corrections));
  const start = corrected.applicationStartDate;
  const end = corrected.lastDate;
  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start > end) {
    throw new ReviewCorrectionValidationError("Application start date must not be after the last date.");
  }
  return corrected;
}
