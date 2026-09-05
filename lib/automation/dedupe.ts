import type { Job, JobSource } from "@prisma/client";
import {
  canonicalizeUrl,
  normalizeText,
  parseSupportedDate,
  sourceFingerprint,
} from "./normalizer";
import type { CollectedJob } from "./types";

type ExistingJob = Pick<
  Job,
  | "id"
  | "title"
  | "department"
  | "qualification"
  | "vacancy"
  | "salary"
  | "ageLimit"
  | "location"
  | "applicationFee"
  | "selectionProcess"
  | "description"
  | "howToApply"
  | "applicationStartDate"
  | "lastDate"
  | "applyLink"
  | "notificationLink"
  | "officialWebsite"
  | "sourceId"
  | "sourceJobId"
  | "sourceHash"
  | "canonicalApplyUrl"
  | "canonicalNoticeUrl"
  | "status"
  | "reviewStatus"
>;

export type DedupeIndex = ReturnType<typeof createDedupeIndex>;

export function createDedupeIndex(jobs: ExistingJob[]) {
  const bySourceJobId = new Map<string, ExistingJob>();
  const byApply = new Map<string, ExistingJob>();
  const byNotice = new Map<string, ExistingJob>();
  const byHash = new Map<string, ExistingJob>();
  const byComposite = new Map<string, ExistingJob>();
  const bySource = new Map<number, ExistingJob[]>();

  for (const job of jobs) {
    if (job.sourceId && job.sourceJobId) {
      bySourceJobId.set(`${job.sourceId}|${normalizeText(job.sourceJobId)}`, job);
    }
    if (job.sourceId) bySource.set(job.sourceId, [...(bySource.get(job.sourceId) || []), job]);
    const apply = job.canonicalApplyUrl || canonicalizeUrl(job.applyLink);
    const notice = job.canonicalNoticeUrl || canonicalizeUrl(job.notificationLink);
    if (apply) byApply.set(apply, job);
    if (notice) byNotice.set(notice, job);
    if (job.sourceHash) byHash.set(job.sourceHash, job);
    byComposite.set(compositeKey(job), job);
  }

  return { bySourceJobId, byApply, byNotice, byHash, byComposite, bySource };
}

function compositeKey(job: {
  title?: unknown;
  department?: unknown;
  location?: unknown;
  lastDate?: unknown;
}) {
  return [
    normalizeText(job.title),
    normalizeText(job.department),
    normalizeText(job.location),
    parseSupportedDate(job.lastDate)?.toISOString().slice(0, 10) || "",
  ].join("|");
}

export function findExistingJob(
  index: DedupeIndex,
  incoming: CollectedJob,
  source: JobSource
) {
  if (incoming.sourceJobId) {
    const match = index.bySourceJobId.get(
      `${source.id}|${normalizeText(incoming.sourceJobId)}`
    );
    if (match) return { job: match, matchedBy: "source job ID" };
  }

  if (incoming.isCorrigendum) {
    const incomingTokens = significantTitleTokens(incoming.title);
    const match = (index.bySource.get(source.id) || []).find((job) => {
      const previousTokens = significantTitleTokens(job.title);
      if (incomingTokens.size < 2 || previousTokens.size < 2) return false;
      const overlap = [...incomingTokens].filter((token) => previousTokens.has(token)).length;
      return overlap / Math.min(incomingTokens.size, previousTokens.size) >= 0.6;
    });
    if (match) return { job: match, matchedBy: "corrigendum title/source" };
  }

  const apply = canonicalizeUrl(incoming.applyLink);
  if (apply && index.byApply.has(apply)) {
    return { job: index.byApply.get(apply)!, matchedBy: "official apply URL" };
  }

  const notice = canonicalizeUrl(incoming.notificationLink);
  if (notice && index.byNotice.has(notice)) {
    return { job: index.byNotice.get(notice)!, matchedBy: "notification URL" };
  }

  const hash = sourceFingerprint(incoming);
  if (index.byHash.has(hash)) {
    return { job: index.byHash.get(hash)!, matchedBy: "source fingerprint" };
  }

  const composite = index.byComposite.get(compositeKey(incoming));
  return composite ? { job: composite, matchedBy: "title/department/location/date" } : null;
}

function significantTitleTokens(value: unknown) {
  const ignored = new Set([
    "corrigendum", "correction", "extension", "extended", "last", "date",
    "recruitment", "notification", "advertisement", "advt", "vacancy", "vacancies",
  ]);
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2 && !ignored.has(token)));
}

const comparableFields = [
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
  "applicationStartDate",
  "lastDate",
  "applyLink",
  "notificationLink",
  "officialWebsite",
] as const;

export function changedFields(existing: ExistingJob, incoming: CollectedJob) {
  return comparableFields.filter((field) => {
    const next = incoming[field];
    if (next === null || next === undefined || next === "") return false;
    const previous = existing[field];
    if (field === "lastDate" || field === "applicationStartDate") {
      return (
        parseSupportedDate(previous)?.toISOString().slice(0, 10) !==
        parseSupportedDate(next)?.toISOString().slice(0, 10)
      );
    }
    if (field.endsWith("Link") || field === "officialWebsite") {
      return canonicalizeUrl(previous) !== canonicalizeUrl(next);
    }
    return normalizeText(previous) !== normalizeText(next);
  });
}

export function addToDedupeIndex(
  index: DedupeIndex,
  job: ExistingJob,
  sourceHash?: string | null
) {
  if (job.sourceId && job.sourceJobId) {
    index.bySourceJobId.set(`${job.sourceId}|${normalizeText(job.sourceJobId)}`, job);
  }
  if (job.sourceId) index.bySource.set(job.sourceId, [...(index.bySource.get(job.sourceId) || []), job]);
  const apply = canonicalizeUrl(job.applyLink);
  const notice = canonicalizeUrl(job.notificationLink);
  if (apply) index.byApply.set(apply, job);
  if (notice) index.byNotice.set(notice, job);
  if (sourceHash) index.byHash.set(sourceHash, job);
  index.byComposite.set(compositeKey(job), job);
}
