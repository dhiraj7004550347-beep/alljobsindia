import type { JobSource } from "@prisma/client";
import { automationConfig } from "../config";
import { fetchHtml } from "../http";
import {
  canonicalizeUrl,
  contentHash,
  normalizeText,
  sameDomain,
} from "../normalizer";
import type { CollectedJob } from "../types";
import { collectPdfUrl, strongRecruitmentTitle } from "./pdf-notification";
import {
  extractPdfLinks,
  inspectHtmlJobs,
  mergeCollectedJobs,
  stripHtml,
} from "./html-parser";

function officialSourceUrl(value: string, source: JobSource) {
  if (sameDomain(value, source.domain)) return true;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return (
      /(^|\.)sbi\.(?:co\.in|bank\.in)$/.test(host) &&
      /(^|\.)sbi\.(?:co\.in|bank\.in)$/.test(source.domain.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function officialHttpsUrl(value: string, source: Pick<JobSource, "domain" | "startUrl">) {
  const canonical = canonicalizeUrl(value, source.startUrl);
  if (!canonical) return null;
  const url = new URL(canonical);
  if (
    url.protocol === "http:" &&
    new URL(source.startUrl).protocol === "https:" &&
    sameDomain(url.toString(), source.domain)
  ) {
    url.protocol = "https:";
  }
  return canonicalizeUrl(url.toString());
}

function closestDetailJob(base: CollectedJob, details: CollectedJob[]) {
  if (base.sourceJobId) {
    const id = normalizeText(base.sourceJobId);
    const byId = details.find((job) => normalizeText(job.sourceJobId) === id);
    if (byId) return byId;
  }
  const title = normalizeText(base.title);
  return (
    details.find((job) => {
      const incoming = normalizeText(job.title);
      return incoming.includes(title) || title.includes(incoming);
    }) || (details.length === 1 ? details[0] : null)
  );
}

export function mergePdfEnrichment(listing: CollectedJob, pdf: CollectedJob) {
  const listingTitle = normalizeText(listing.title);
  const genericListing = /^(?:walk in interview|recruitment|vacancies|advertisement|notification)$/.test(listingTitle);
  const title = genericListing && strongRecruitmentTitle(pdf.title) ? pdf.title : listing.title;
  const merged = mergeCollectedJobs(listing, {
    ...pdf,
    // The official listing/detail title represents the notice identity. Only
    // replace a truly generic label when the PDF has a strong recruitment
    // heading; never let table fragments overwrite a good title.
    title,
  });
  const explicitListingAmendment = /\b(?:addendum|corrigendum|revised vacancies?|final vacancies?|date extension|extended (?:closing|last) date)\b/i.test(
    listing.title
  );
  return {
    ...merged,
    title,
    // A parent API object or attachment list can contain amendment wording
    // unrelated to a normal examination notice. Only the visible listing title
    // or the PDF's own header may classify the final notice as an amendment.
    isCorrigendum: Boolean(explicitListingAmendment || pdf.isCorrigendum),
  };
}

export async function enrichOfficialNotices(
  source: JobSource,
  jobs: CollectedJob[],
  options: { followDetailPages: boolean }
) {
  const warnings: string[] = [];
  const enriched: CollectedJob[] = [];
  const limit = automationConfig.maxNoticeEnrichmentsPerSource;

  for (const [index, base] of jobs.entries()) {
    if (index >= limit) {
      enriched.push(base);
      continue;
    }

    let job = base;
    const noticeUrl = officialHttpsUrl(
      canonicalizeUrl(base.notificationLink, base.sourceUrl) || "",
      source
    );
    if (!noticeUrl || !officialSourceUrl(noticeUrl, source)) {
      enriched.push(job);
      continue;
    }

    // Preserve the notice identity while replacing obsolete official HTTP
    // links with their HTTPS equivalent before fetching and previewing.
    job = { ...job, notificationLink: noticeUrl };

    try {
      if (/\.pdf(?:\/|$|\?)/i.test(noticeUrl)) {
        const pdf = await collectPdfUrl(source, noticeUrl, base.title);
        job = mergePdfEnrichment(job, pdf);
      } else if (options.followDetailPages) {
        const detail = await fetchHtml(noticeUrl);
        const detailText = stripHtml(detail.text).slice(0, 80_000);
        if (detailText.length > job.rawText.length) {
          job = mergeCollectedJobs(job, {
            ...job,
            notificationLink: noticeUrl,
            rawText: detailText,
            contentHash: contentHash(detailText),
          });
        }

        const parsed = inspectHtmlJobs(detail.text, source, detail.finalUrl);
        const detailJob = closestDetailJob(job, parsed.jobs);
        if (detailJob) job = mergeCollectedJobs(job, detailJob);

        const pdf = extractPdfLinks(detail.text, detail.finalUrl)[0];
        if (pdf) {
          const pdfJob = await collectPdfUrl(source, pdf.url, job.title);
          job = mergePdfEnrichment(job, pdfJob);
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown parser error";
      warnings.push(`${base.title}: notice enrichment skipped (${reason}).`);
    }
    enriched.push(job);
  }

  return { jobs: enriched, warnings };
}
