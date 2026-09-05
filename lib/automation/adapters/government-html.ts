import type { SourceAdapter } from "../types";
import { automationConfig } from "../config";
import { fetchHtml } from "../http";
import { contentHash } from "../normalizer";
import { discoverSourceCandidates } from "../source-discovery";
import { collectPdfUrl } from "./pdf-notification";
import { canonicalNoticeIdentity, extractPdfLinks, inspectHtmlJobs } from "./html-parser";
import { enrichOfficialNotices } from "./notice-enrichment";

export const GovernmentHtmlAdapter: SourceAdapter = {
  name: "GovernmentHtmlAdapter",
  canHandle(source) {
    return source.parserType === "GOVERNMENT_HTML";
  },
  async collect(source) {
    const fetched = await fetchHtml(source.startUrl);
    const parsed = inspectHtmlJobs(fetched.text, source, fetched.finalUrl);
    const jobs = [...parsed.jobs];
    const pdfLinks = extractPdfLinks(fetched.text, fetched.finalUrl).slice(
      0,
      automationConfig.maxPdfsPerSource
    );

    for (const pdf of pdfLinks) {
      try {
        jobs.push(await collectPdfUrl(source, pdf.url, pdf.label));
      } catch {
        // A broken PDF is isolated; HTML candidates from the source remain usable.
      }
    }

    const merged = new Map<string, typeof jobs[number]>();
    for (const job of jobs) {
      // A linked PDF can enrich a notice, but must not become a second notice.
      const key = canonicalNoticeIdentity(job);
      if (!merged.has(key)) merged.set(key, job);
    }
    const mergedJobs = [...merged.values()];
    const enrichment = /^drdo\.gov\.in$/i.test(source.domain)
      ? await enrichOfficialNotices(source, mergedJobs, { followDetailPages: true })
      : { jobs: mergedJobs, warnings: [] as string[] };
    return {
      jobs: enrichment.jobs,
      discoveredSources: discoverSourceCandidates(fetched.text, source),
      contentHash: contentHash(fetched.text),
      metrics: { ...parsed.metrics, uniqueNotices: enrichment.jobs.length },
      warnings: [...parsed.warnings, ...enrichment.warnings],
    };
  },
};
