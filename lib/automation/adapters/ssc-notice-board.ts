import type { JobSource } from "@prisma/client";
import { automationConfig } from "../config";
import { fetchHtml } from "../http";
import {
  canonicalizeUrl,
  cleanText,
  contentHash,
  extractSourceJobId,
} from "../normalizer";
import type { CollectedJob, SourceAdapter } from "../types";
import {
  canonicalNoticeIdentity,
  mergeCollectedJobs,
  resultOnlyTitle,
} from "./html-parser";
import { enrichOfficialNotices } from "./notice-enrichment";

type JsonObject = Record<string, unknown>;

function allObjects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(allObjects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  return [object, ...Object.values(object).flatMap(allObjects)];
}

function firstText(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = cleanText(value);
      if (text) return text;
    }
  }
  return null;
}

function apiDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function titleDates(title: string) {
  const values = [...title.matchAll(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})\b/g)]
    .map((match) => match[1]);
  return { start: values.length >= 2 ? values.at(-2)! : null, end: values.at(-1) || null };
}

function officialUrl(value: string, base: string, key = "") {
  const text = cleanText(value);
  if (!text) return null;
  if (/^[^/]+\.pdf(?:\?.*)?$/i.test(text) && /file|attachment|document/i.test(key)) {
    return canonicalizeUrl(`/api/attachment/uploads/masterData/NoticeBoards/${text}`, base);
  }
  if (!/^https?:\/\//i.test(text) && !text.startsWith("/") && !/^api\//i.test(text)) {
    return null;
  }
  return canonicalizeUrl(text.startsWith("api/") ? `/${text}` : text, base);
}

function recordUrls(value: unknown, base: string, key = "", output = new Map<string, string>()) {
  if (typeof value === "string") {
    const url = officialUrl(value, base, key);
    if (url) output.set(url, key);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) recordUrls(item, base, key, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value as JsonObject)) {
      recordUrls(child, base, childKey, output);
    }
  }
  return output;
}

function recruitmentNotice(title: string) {
  if (
    resultOnlyTitle(title) ||
    /\b(?:answer keys?|admission certificate|city of examination|exam(?:ination)? schedule|exam(?:ination)? date|allocation|cancellation|postponed|representation|response sheet|document verification)\b/i.test(title)
  ) {
    return false;
  }
  if (/\b(?:corrigendum|revised dates?|date extension)\b/i.test(title)) return false;
  return /\b(?:recruitment|advertisement|applications? (?:are )?invited|filling up|selection posts?|engagement|vacanc(?:y|ies)|notice of .{0,100} examination)\b/i.test(title);
}

function recordTitle(object: JsonObject) {
  return firstText(object, [
    "title",
    "headline",
    "noticeTitle",
    "noticeHeading",
    "heading",
    "subject",
  ]);
}

function toCandidate(
  object: JsonObject,
  source: JobSource,
  sourceUrl: string,
  apiUrl: string
): { job: CollectedJob; urlCount: number } | null {
  const title = recordTitle(object);
  if (!title || title.length < 8 || title.length > 500 || !recruitmentNotice(title)) return null;

  const urls = recordUrls(object, new URL(apiUrl).origin);
  const pdf = [...urls.keys()].find((url) =>
    /\.pdf(?:\/|$|\?)/i.test(url) &&
    new URL(url).hostname.toLowerCase().replace(/^www\./, "") === "ssc.gov.in"
  );
  const redirect = [...urls.entries()].find(([url, key]) =>
    /apply|redirect|candidate|application/i.test(`${key} ${url}`)
  )?.[0];
  if (!pdf && !redirect) return null;

  const rawText = JSON.stringify(object).slice(0, 80_000);
  const relatedText = `${title} ${[...urls.keys()].join(" ")}`;
  const dates = titleDates(title);
  const explicitId = firstText(object, ["noticeId", "noticeBoardId", "id", "_id"]);
  const examName = firstText(object, ["examName", "examinationName"]);
  const description = firstText(object, ["examDescription", "description", "summary"]);
  const directLastDate = firstText(object, [
    "endDate",
    "lastDate",
    "closingDate",
    "applicationEndDate",
  ]);

  return {
    urlCount: urls.size,
    job: {
      title: cleanText(title).slice(0, 240),
      department: "Staff Selection Commission",
      description: description?.slice(0, 4_000) || null,
      applicationStartDate:
        apiDate(firstText(object, ["startDate", "applicationStartDate"])) || dates.start,
      lastDate: apiDate(directLastDate) || dates.end,
      applyLink: redirect || null,
      notificationLink: pdf || redirect || null,
      officialWebsite: new URL(sourceUrl).origin,
      sourceJobId: extractSourceJobId(rawText) || explicitId,
      sourceUrl,
      postedDate: apiDate(firstText(object, ["publishedAt", "publishDate", "createdAt"])),
      rawText: [title, examName, description, rawText].filter(Boolean).join(" ").slice(0, 80_000),
      contentHash: contentHash(rawText),
      isCorrigendum: /\b(?:addendum|corrigendum|revised vacancies?|final vacancies?|date extension|extended date)\b/i.test(relatedText),
      extractionMethod: "HTML",
    },
  };
}

export function parseSscNoticeBoardPayload(
  text: string,
  source: JobSource,
  sourceUrl: string,
  apiUrl: string
) {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("SSC notice endpoint returned invalid JSON");
  }

  const records = allObjects(payload).filter((object) => Boolean(recordTitle(object)));
  const candidates = records
    .map((record) => toCandidate(record, source, sourceUrl, apiUrl))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const rawLinks = records.reduce(
    (total, record) => total + recordUrls(record, new URL(apiUrl).origin).size,
    0
  );

  return {
    recordsScanned: records.length,
    jobs: candidates.map((candidate) => candidate.job),
    rawLinks,
    recruitmentLinks: candidates.reduce((total, candidate) => total + Math.max(1, candidate.urlCount), 0),
  };
}

function endpoint(source: JobSource, page: number) {
  const url = new URL("/api/general-website/portal/notice-boards", source.startUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", "50");
  url.searchParams.set("contentType", "notice-boards");
  url.searchParams.set("key", "createdAt");
  url.searchParams.set("order", "DESC");
  url.searchParams.set("isAttachment", "true");
  url.searchParams.set("language", "english");
  url.searchParams.set(
    "attributes",
    "id,headline,examId,contentType,redirectUrl,startDate,endDate,language,createdAt"
  );
  return url.toString();
}

export const SscNoticeBoardAdapter: SourceAdapter = {
  name: "SscNoticeBoardAdapter",
  canHandle(source) {
    return source.parserType === "GOVERNMENT_HTML" && /^ssc\.gov\.in$/i.test(source.domain);
  },
  async collect(source) {
    const jobs = new Map<string, CollectedJob>();
    const warnings: string[] = [];
    const hashes: string[] = [];
    let rawLinks = 0;
    let recruitmentLinks = 0;
    let recordsScanned = 0;

    for (let page = 1; page <= automationConfig.maxSscApiPages; page++) {
      const apiUrl = endpoint(source, page);
      const fetched = await fetchHtml(apiUrl);
      hashes.push(contentHash(fetched.text));
      const parsed = parseSscNoticeBoardPayload(
        fetched.text,
        source,
        source.startUrl,
        fetched.finalUrl
      );
      rawLinks += parsed.rawLinks;
      recruitmentLinks += parsed.recruitmentLinks;
      recordsScanned += parsed.recordsScanned;
      for (const job of parsed.jobs) {
        const key = canonicalNoticeIdentity(job);
        const current = jobs.get(key);
        jobs.set(key, current ? mergeCollectedJobs(current, job) : job);
      }
      if (parsed.recordsScanned === 0) break;
    }

    const enrichment = await enrichOfficialNotices(source, [...jobs.values()], {
      followDetailPages: false,
    });
    if (recordsScanned > 0 && enrichment.jobs.length === 0) {
      warnings.push("SSC API was accessible, but its recent pages contained no actionable recruitment notice.");
    }
    warnings.push(...enrichment.warnings);

    return {
      jobs: enrichment.jobs,
      discoveredSources: [],
      contentHash: contentHash(hashes.join("|")),
      metrics: {
        rawLinks,
        recruitmentLinks,
        uniqueNotices: enrichment.jobs.length,
        rejectedNoise: Math.max(0, rawLinks - recruitmentLinks),
      },
      warnings,
    };
  },
};
