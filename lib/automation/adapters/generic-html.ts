import type { SourceAdapter } from "../types";
import { fetchHtml } from "../http";
import { contentHash } from "../normalizer";
import { discoverSourceCandidates } from "../source-discovery";
import { inspectHtmlJobs } from "./html-parser";
import { enrichOfficialNotices } from "./notice-enrichment";

export const GenericHtmlAdapter: SourceAdapter = {
  name: "GenericHtmlAdapter",
  canHandle(source) {
    return source.parserType === "GENERIC_HTML";
  },
  async collect(source) {
    const fetched = await fetchHtml(source.startUrl);
    const parsed = inspectHtmlJobs(fetched.text, source, fetched.finalUrl);
    const enrichment = /(^|\.)sbi\.(?:co\.in|bank\.in)$/i.test(source.domain)
      ? await enrichOfficialNotices(source, parsed.jobs, { followDetailPages: false })
      : { jobs: parsed.jobs, warnings: [] as string[] };
    return {
      jobs: enrichment.jobs,
      discoveredSources: discoverSourceCandidates(fetched.text, source),
      contentHash: contentHash(fetched.text),
      metrics: parsed.metrics,
      warnings: [...parsed.warnings, ...enrichment.warnings],
    };
  },
};
