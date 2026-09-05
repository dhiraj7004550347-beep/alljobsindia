import type { JobSource } from "@prisma/client";
import { fetchPdf } from "../http";
import {
  cleanText,
  contentHash,
  extractSourceJobId,
} from "../normalizer";
import { extractRecruitmentPdfFields } from "../pdf-fields";
import { extractPdfText } from "../pdf-parser";
import type { AdapterResult, CollectedJob, SourceAdapter } from "../types";

const AMENDMENT_PATTERN = /\b(?:corrigendum|addendum|extension of (?:the )?(?:closing|last) date|(?:closing|last) date (?:has been )?extended|revised (?:closing|last) date)\b/i;

function weakPdfTitle(value: string) {
  return /^(?:walk[- ]?in interview|recruitment|vacanc(?:y|ies)|advertisement|notification|of vacancies?\b|actual number of vacancies?\b)/i.test(value) ||
    /(?:\uFFFD|à[¤¥]|ï¿½|â|Â)/.test(value);
}

export function strongRecruitmentTitle(value: string) {
  const title = cleanText(value);
  if (title.length < 12 || title.length > 220 || /(?:\uFFFD|à[¤¥]|ï¿½|â|Â)/.test(title)) return false;
  if (/\b(?:actual number of vacancies|vacancies may vary|no\.? of vacancies|discipline|general instructions?|eligibility criteria|selection procedure)\b/i.test(title)) return false;
  return /\b(?:recruitment of|advertisement for|applications? (?:are )?invited|invites? applications?|engagement of|appointment to|walk[- ]?in interview for|junior research fellow|research associate|apprentices?)\b/i.test(title);
}

function embeddedPdfHeadings(text: string) {
  const header = cleanText(text.slice(0, 4_000));
  const starts = [
    ...header.matchAll(/\b(?:advertisement|notification)\s+for\s+(?:the\s+)?(?:recruitment|selection|engagement|award|appointment)\b/gi),
    ...header.matchAll(/\brecruitment\s+of\b/gi),
    ...header.matchAll(/\bapplications?\s+(?:are\s+)?invited\b/gi),
  ].sort((left, right) => (left.index || 0) - (right.index || 0));

  return starts.flatMap((start) => {
    const tail = header.slice(start.index || 0, (start.index || 0) + 280);
    const stop = tail.slice(20).search(
      /\s+(?:advertisement|advt\.?|notification)\s*(?:no\.?|number|#)|\s+(?:essential|educational|minimum)\s+qualifications?|\s+eligibility criteria|\s+general (?:conditions|instructions)|\s+part[- ]?\d+|\.\s+/i
    );
    const candidate = cleanText(stop >= 0 ? tail.slice(0, stop + 20) : tail).slice(0, 220);
    return strongRecruitmentTitle(candidate) ? [candidate] : [];
  });
}

export function pdfTitle(text: string, fallback: string) {
  const safeFallback = cleanText(fallback).slice(0, 220);
  if (safeFallback && !weakPdfTitle(safeFallback)) return safeFallback;
  const lines = text.split(/\n|(?<=[.!?])\s+/).map(cleanText).filter(Boolean);
  return (
    embeddedPdfHeadings(text)[0] || lines.find(strongRecruitmentTitle) || safeFallback || "Recruitment notification"
  ).slice(0, 220);
}

export function isPdfAmendmentNotice(title: string, fallback: string, rawText: string) {
  // Amendment classification is intentionally header-bound. A normal
  // advertisement may mention an "extended last date" in boilerplate or
  // history; that must not turn the whole opening into a corrigendum.
  const label = cleanText(fallback);
  if (AMENDMENT_PATTERN.test(label)) return true;
  if (
    label.length >= 20 &&
    /\b(?:recruitment|notice of|appointment|engagement|applications?|invites?|walk[- ]?in|fellow|officer|engineer|apprentice|vacanc(?:y|ies))\b/i.test(label)
  ) {
    return false;
  }
  const header = `${cleanText(title)} ${cleanText(rawText.slice(0, 700))}`;
  return AMENDMENT_PATTERN.test(header);
}

export async function collectPdfUrl(
  source: JobSource,
  url: string,
  label?: string
): Promise<CollectedJob> {
  const fetched = await fetchPdf(url);
  const parsed = await extractPdfText(fetched.bytes);
  const rawText = parsed.text.slice(0, 80_000);
  const fallback = cleanText(label) || decodeURIComponent(new URL(fetched.finalUrl).pathname.split("/").pop() || "Recruitment notification").replace(/\.pdf$/i, "");
  const fields = extractRecruitmentPdfFields(rawText);

  return {
    title: pdfTitle(rawText, fallback),
    department: fields.department,
    qualification: fields.qualification,
    vacancy: fields.vacancy,
    salary: fields.salary,
    ageLimit: fields.ageLimit,
    location: fields.location,
    applicationFee: fields.applicationFee,
    selectionProcess: fields.selectionProcess,
    howToApply: fields.howToApply,
    applicationStartDate: fields.applicationStartDate,
    lastDate: fields.lastDate,
    applyLink: fields.applyLink,
    notificationLink: fetched.finalUrl,
    officialWebsite: new URL(source.startUrl).origin,
    sourceJobId: extractSourceJobId(rawText),
    sourceUrl: fetched.finalUrl,
    rawText,
    contentHash: contentHash(rawText || new TextDecoder().decode(fetched.bytes)),
    isCorrigendum: isPdfAmendmentNotice(pdfTitle(rawText, fallback), fallback, rawText),
    extractionMethod: "PDF",
  };
}

export const PdfNotificationAdapter: SourceAdapter = {
  name: "PdfNotificationAdapter",
  canHandle(source) {
    return source.parserType === "PDF_NOTIFICATION" || /\.pdf(?:$|\?)/i.test(source.startUrl);
  },
  async collect(source): Promise<AdapterResult> {
    const job = await collectPdfUrl(source, source.startUrl, source.name);
    return {
      jobs: [job], discoveredSources: [], contentHash: job.contentHash,
      metrics: { rawLinks: 1, recruitmentLinks: 1, uniqueNotices: 1, rejectedNoise: 0 },
      warnings: [],
    };
  },
};
