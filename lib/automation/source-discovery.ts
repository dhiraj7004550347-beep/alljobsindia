import type { JobSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizeUrl, cleanText, sameDomain } from "./normalizer";
import type { DiscoveredSource } from "./types";

const DISCOVERY_TERMS =
  /\b(careers?|jobs?|recruitments?|vacanc(?:y|ies)|opportunities|join[-\s]?us|work[-\s]?with[-\s]?us)\b/i;

function stripHtml(value: string) {
  return cleanText(value.replace(/<[^>]+>/g, " "));
}

export function discoverSourceCandidates(
  html: string,
  source: JobSource
): DiscoveredSource[] {
  const results = new Map<string, DiscoveredSource>();
  const links = html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of links) {
    const label = stripHtml(match[2]);
    const href = canonicalizeUrl(match[1], source.startUrl);
    if (!href || !DISCOVERY_TERMS.test(`${label} ${href}`)) continue;
    if (!sameDomain(href, source.domain)) continue;
    if (/\.pdf(?:$|\?)/i.test(href)) continue;

    const url = new URL(href);
    results.set(href, {
      name: label.slice(0, 120) || `${source.name} Careers`,
      domain: url.hostname.toLowerCase().replace(/^www\./, ""),
      startUrl: href,
      type: source.type,
      category: source.category,
      parserType:
        source.type === "GOVERNMENT" || source.type === "PSU"
          ? "GOVERNMENT_HTML"
          : "GENERIC_HTML",
      discoveredFromUrl: source.startUrl,
    });
  }

  return [...results.values()].slice(0, 20);
}

export async function saveDiscoveredSources(candidates: DiscoveredSource[]) {
  let created = 0;
  for (const candidate of candidates) {
    const existing = await prisma.jobSource.findUnique({
      where: { startUrl: candidate.startUrl },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.jobSource.create({
      data: {
        ...candidate,
        enabled: false,
        trusted: false,
        autoPublish: false,
        reviewStatus: "PENDING",
      },
    });
    created++;
  }
  return created;
}
