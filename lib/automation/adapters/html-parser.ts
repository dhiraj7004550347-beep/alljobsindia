import type { JobSource } from "@prisma/client";
import {
  canonicalizeUrl,
  cleanText,
  contentHash,
  extractSourceJobId,
  normalizeText,
  parseSupportedDate,
} from "../normalizer";
import type { CollectedJob, CollectionMetrics } from "../types";

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripHtml(html: string) {
  const decoded = decodeEntities(html);
  return cleanText(
    decodeEntities(
      decoded
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...(object["@graph"] ? flattenJsonLd(object["@graph"]) : [])];
}

function isJobPosting(value: Record<string, unknown>) {
  const type = value["@type"];
  const values = Array.isArray(type) ? type : [type];
  return values.some((item) => String(item || "").toLowerCase() === "jobposting");
}

function objectName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  return cleanText(object.name || object.legalName) || null;
}

function objectUrl(value: unknown, base: string) {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  return canonicalizeUrl(object.sameAs || object.url, base);
}

function locationText(value: unknown): string | null {
  const locations = Array.isArray(value) ? value : [value];
  const values = locations.flatMap((location) => {
    if (!location || typeof location !== "object") return [];
    const address = (location as Record<string, unknown>).address;
    if (typeof address === "string") return [cleanText(address)];
    if (!address || typeof address !== "object") return [];
    const record = address as Record<string, unknown>;
    return [
      [record.addressLocality, record.addressRegion, record.addressCountry]
        .map(cleanText)
        .filter(Boolean)
        .join(", "),
    ];
  });
  return values.filter(Boolean).join("; ") || null;
}

function salaryText(value: unknown): string | null {
  if (!value || typeof value !== "object") return cleanText(value) || null;
  const object = value as Record<string, unknown>;
  const nested =
    object.value && typeof object.value === "object"
      ? (object.value as Record<string, unknown>)
      : object;
  const min = cleanText(nested.minValue);
  const max = cleanText(nested.maxValue);
  const amount = min && max ? `${min} - ${max}` : min || max || cleanText(nested.value);
  return [cleanText(object.currency), amount, cleanText(nested.unitText)]
    .filter(Boolean)
    .join(" ") || null;
}

function extractJsonLdJobs(html: string, source: JobSource, sourceUrl: string) {
  const jobs: CollectedJob[] = [];
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  ) || [];

  for (const script of scripts) {
    const json = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      for (const object of flattenJsonLd(JSON.parse(json))) {
        if (!isJobPosting(object)) continue;
        const title = cleanText(object.title || object.name);
        if (!title) continue;
        const rawText = JSON.stringify(object);
        jobs.push({
          title,
          department: objectName(object.hiringOrganization),
          qualification:
            cleanText(
              object.qualifications ||
                object.educationRequirements ||
                object.experienceRequirements
            ) || null,
          vacancy: cleanText(object.totalJobOpenings) || null,
          salary: salaryText(object.baseSalary),
          location: locationText(object.jobLocation) || cleanText(object.jobLocationType) || null,
          description: stripHtml(cleanText(object.description)) || null,
          lastDate: cleanText(object.validThrough) || null,
          postedDate: cleanText(object.datePosted) || null,
          updatedDate: cleanText(object.dateModified) || null,
          applyLink: canonicalizeUrl(object.url, sourceUrl),
          notificationLink: sourceUrl,
          officialWebsite: objectUrl(object.hiringOrganization, sourceUrl),
          sourceJobId:
            cleanText(
              typeof object.identifier === "object" && object.identifier
                ? (object.identifier as Record<string, unknown>).value
                : object.identifier
            ) || extractSourceJobId(rawText),
          sourceUrl,
          rawText: rawText.slice(0, 20_000),
          contentHash: contentHash(rawText),
          extractionMethod: "JSON_LD",
        });
      }
    } catch {
      // Malformed JSON-LD is ignored; deterministic HTML parsing still runs.
    }
  }
  return jobs;
}

type LabeledField =
  | "text"
  | "qualification"
  | "vacancy"
  | "salary"
  | "age"
  | "location"
  | "fee"
  | "selection"
  | "date";

export function plausibleLabeledValue(value: string | null, field: LabeledField) {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.length > 180) return null;
  if (/(?:class\s*=|href\s*=|views-field|content["']?>|<\/?[a-z]|next page|last page|know more about)/i.test(cleaned)) {
    return null;
  }
  if (field === "vacancy") {
    if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}$/.test(cleaned)) return null;
    return /\b\d{1,6}\b|\b(?:various|multiple)\b/i.test(cleaned) ? cleaned : null;
  }
  if (field === "age") {
    return /\b(?:\d{1,3}\s*(?:years?|yrs?)|age\s*(?:limit|as on)|not exceeding|between\s+\d{1,3})\b/i.test(cleaned)
      ? cleaned
      : null;
  }
  if (field === "salary") {
    return /(?:₹|\brs\.?\b|rupees?|pay\s*(?:level|scale|matrix)|salary|stipend|remuneration|emoluments?|per month|monthly|ctc)/i.test(cleaned)
      ? cleaned
      : null;
  }
  if (field === "fee") {
    return /(?:₹|\brs\.?\b|rupees?|\bfee\b|no fee|nil|exempt)/i.test(cleaned) ? cleaned : null;
  }
  if (field === "qualification") {
    return /\b(?:graduate|postgraduate|degree|diploma|b\.?e\.?|b\.?tech|m\.?e\.?|m\.?tech|ph\.?d|master|bachelor|matric|10th|12th|iti|education|qualification|experience)\b/i.test(cleaned)
      ? cleaned
      : null;
  }
  if (field === "selection") {
    return /\b(?:interview|examination|exam|test|merit|shortlist|screening|selection|document verification)\b/i.test(cleaned)
      ? cleaned
      : null;
  }
  if (field === "date") return parseSupportedDate(cleaned) ? cleaned : null;
  return cleaned;
}

function labeled(text: string, label: RegExp, field: LabeledField = "text") {
  const match = text.match(
    new RegExp(`\\b(?:${label.source})\\b\\s*[:\\-]?\\s*(.{1,180}?)(?=\\s{2,}|\\b(?:published date|start date|end date|due date|last date|closing date|salary|pay scale|qualification|vacanc(?:y|ies)|location|age limit|application fee|selection process|view more|download|apply online|biodata|undertaking|ctc negotiation)\\b|$)`, "i")
  );
  return plausibleLabeledValue(cleanText(match?.[1]) || null, field);
}

function genericTitle(value: string) {
  return /^(home|about|contact|careers?|jobs?|recruitment|vacanc(?:y|ies)|latest|details|read more|view more|know more(?: about vacancies)?|click here|apply|apply now|apply online|current openings|download(?: revised)? advertisement|advertisement|biodata|ctc negotiation format|corrigendum|result)$/i.test(
    value
  );
}

function jobTitleSignal(value: string) {
  return /\b(?:recruit(?:ment|ing)?|engagement|vacanc(?:y|ies)|invites?|applications?|apprentices?|fellowships?|jrf|research associates?|internships?|officers?|managers?|engineers?|scientists?|consultants?|assistants?|associates?|clerks?|trainees?|appointment|posts?|walk[- ]?in|interview|employment|cadre)\b/i.test(
    value
  );
}

function descriptiveContextTitle(value: string) {
  const title = cleanNoticeTitle(value);
  if (
    title.length < 10 ||
    title.length > 240 ||
    genericTitle(title) ||
    !jobTitleSignal(title)
  ) {
    return null;
  }

  // Advertisement numbers can contain tokens such as JRF/RA, but they are
  // identities, not human-readable recruitment titles.
  if (
    /^[a-z0-9&_.\/-]+$/i.test(title) &&
    /[\/_.-]/.test(title)
  ) {
    return null;
  }
  if (/^(?:advertisement|advt\.?|notification|notice)\s*(?:no\.?|number|#)?\b/i.test(title)) {
    return null;
  }

  const words = title.match(/[a-z]{2,}/gi)?.length || 0;
  if (words < 3) return null;
  if (
    !/\b(?:recruit(?:ment|ing)?|engagement|appointment|filling up|applications?|invites?|apprenticeship|apprentices?|fellowships?|jrf|research associates?|post of|position|walk[- ]?in)\b/i.test(
      title
    )
  ) {
    return null;
  }
  return title;
}

export function resultOnlyTitle(value: string) {
  return /\b(?:result|marks secured|call letter|admit card|interview schedule|qualified for interview|provisionally selected|selected candidates|selected and waitlisted|wait ?list|circle allotment|no candidate|nil selection|stands withdrawn)\b/i.test(
    value
  );
}

function contextualJobTitle(beforeHtml: string) {
  // Official cards (notably DRDO) contain verbose markup between their title,
  // advertisement number, dates and action links. Keep the latest descriptive
  // block/anchor before the current action; do not cut at another action in the
  // same card because SBI places Download Advertisement before Apply Online.
  const blockTitles = [
    ...beforeHtml.matchAll(
      /<(?:h[1-6]|div|p|li|a)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|div|p|li|a)>/gi
    ),
  ]
    .map((match) => descriptiveContextTitle(stripHtml(match[1])))
    .filter((value): value is string => Boolean(value));
  if (blockTitles.length > 0) return blockTitles.at(-1)!;

  const beforeText = stripHtml(beforeHtml).slice(-12_000);
  const markers = [
    ...beforeText.matchAll(
      /\b(?:advertisement|advt\.?)\s*(?:no\.?|number|#)?\s*[:\-]?/gi
    ),
  ];
  const marker = markers.at(-1);
  if (marker?.index === undefined) return null;

  const prefix = beforeText.slice(0, marker.index).slice(-900);
  let candidate = prefix;
  const strongStarts = [
    ...candidate.matchAll(
      /\b(?:recruitment|engagement|appointment|filling up|applications? (?:are )?invited|invites? applications?)\b/gi
    ),
  ];
  const start = strongStarts.at(-1)?.index;
  if (start !== undefined && candidate.length > 500) {
    candidate = candidate.slice(start);
  }

  candidate = cleanText(candidate).slice(0, 500);
  return descriptiveContextTitle(candidate);
}

function cleanNoticeTitle(value: string) {
  const title = cleanText(value)
    .replace(/^[a-z-]+=["'][^"']*["']>\s*/i, "")
    .split(/\b(?:ADVERTISEMENT|ADVT\.?|NOTIFICATION)\s*(?:NO\.?|NUMBER|#)\s*[:\-]?/i)[0]
    .replace(/\s+(?:DOWNLOAD|APPLY ONLINE|APPLY NOW|VIEW MORE)\s*$/i, "")
    .trim();
  const signature = title.slice(0, Math.min(32, title.length));
  const repeatedAt = signature.length >= 16 ? title.indexOf(signature, signature.length) : -1;
  return (repeatedAt > 0 ? title.slice(0, repeatedAt) : title).replace(/[â€¦…]+$/g, "").trim().slice(0, 240);
}

function datesFromTitle(title: string) {
  const values = [...title.matchAll(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})\b/g)].map((match) => match[1]);
  return { start: values.length >= 2 ? values.at(-2)! : null, end: values.at(-1) || null };
}

function nearestSourceJobId(value: string) {
  const text = stripHtml(value).slice(-8_000);
  const markers = [...text.matchAll(/(?:advertisement|advt\.?|notification|notice)\s*(?:no\.?|number|#)?\s*[:\-]?\s*[a-z0-9][a-z0-9/&_.\-]{2,80}/gi)];
  for (const marker of markers.reverse()) {
    const id = extractSourceJobId(marker[0]);
    if (id) return id;
  }
  return null;
}

function titleScore(value: string) {
  let score = genericTitle(value) ? 0 : 10;
  if (jobTitleSignal(value)) score += 10;
  if (value.length >= 15 && value.length <= 240) score += 5;
  if (value.length > 320) score -= 10;
  return score;
}

function preferTitle(current: string, incoming: string) {
  const currentScore = titleScore(current);
  const incomingScore = titleScore(incoming);
  if (incomingScore !== currentScore) return incomingScore > currentScore ? incoming : current;
  return incoming.length < current.length ? incoming : current;
}

function preferNotificationLink(current: string | null | undefined, incoming: string | null | undefined) {
  if (!current) return incoming || null;
  if (!incoming) return current;
  const currentPdf = /\.pdf(?:\/|$|\?)/i.test(current);
  const incomingPdf = /\.pdf(?:\/|$|\?)/i.test(incoming);
  return incomingPdf && !currentPdf ? incoming : current;
}

export function mergeCollectedJobs(current: CollectedJob, incoming: CollectedJob): CollectedJob {
  const rawText = incoming.rawText.length > current.rawText.length ? incoming.rawText : current.rawText;
  return {
    ...current,
    title: preferTitle(current.title, incoming.title),
    department: current.department || incoming.department,
    qualification: current.qualification || incoming.qualification,
    vacancy: current.vacancy || incoming.vacancy,
    salary: current.salary || incoming.salary,
    ageLimit: current.ageLimit || incoming.ageLimit,
    location: current.location || incoming.location,
    applicationFee: current.applicationFee || incoming.applicationFee,
    selectionProcess: current.selectionProcess || incoming.selectionProcess,
    description: current.description || incoming.description,
    howToApply: current.howToApply || incoming.howToApply,
    applicationStartDate: current.applicationStartDate || incoming.applicationStartDate,
    lastDate: current.lastDate || incoming.lastDate,
    applyLink: current.applyLink || incoming.applyLink,
    notificationLink: preferNotificationLink(current.notificationLink, incoming.notificationLink),
    officialWebsite: current.officialWebsite || incoming.officialWebsite,
    sourceJobId: current.sourceJobId || incoming.sourceJobId,
    postedDate: current.postedDate || incoming.postedDate,
    updatedDate: current.updatedDate || incoming.updatedDate,
    rawText,
    contentHash: contentHash(rawText),
    isCorrigendum: Boolean(current.isCorrigendum || incoming.isCorrigendum),
  };
}

export function canonicalNoticeIdentity(job: CollectedJob) {
  if (job.sourceJobId) return `id:${normalizeText(job.sourceJobId)}`;
  if (job.notificationLink) return `notice:${canonicalizeUrl(job.notificationLink)}`;
  return [
    "job",
    normalizeText(job.title),
    cleanText(job.lastDate),
  ].join(":");
}

export function extractAnchorJobs(html: string, source: JobSource, sourceUrl: string) {
  const jobs: CollectedJob[] = [];
  const anchors = [...html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )];

  for (const match of anchors) {
    const anchorTitle = stripHtml(match[2]);
    const href = canonicalizeUrl(match[1], sourceUrl);
    if (!href || anchorTitle.length < 2 || anchorTitle.length > 220) continue;

    const start = Math.max(0, (match.index || 0) - 15_000);
    const end = Math.min(html.length, (match.index || 0) + match[0].length + 4_000);
    const beforeHtml = html.slice(start, match.index || 0);
    const block = html.slice(start, end);
    const rawText = stripHtml(block);
    const nearbyBefore = stripHtml(beforeHtml).slice(-500);
    const isPdf = /\.pdf(?:\/|$|\?)/i.test(href);
    const isAdvertisementPdf = isPdf && /download(?: revised| old)? advertisement/i.test(`${nearbyBefore} ${anchorTitle}`);
    // These are supporting/result documents, never the notice identity.
    if (/\b(?:biodata|undertaking|ctc negotiation|acquaint yourself|scribe guidelines?|call letter|result|marks secured|interview schedule|list of candidates|provisionally selected)\b/i.test(anchorTitle)) continue;
    const semanticTitle = isAdvertisementPdf ? "DOWNLOAD ADVERTISEMENT" : anchorTitle;
    const title = cleanNoticeTitle(genericTitle(semanticTitle)
      ? contextualJobTitle(beforeHtml) || anchorTitle
      : anchorTitle);
    if (title.length < 5 || title.length > 500 || genericTitle(title) || !jobTitleSignal(title)) {
      continue;
    }
    if (!/(recruit|engagement|appointment|applications?|apprentice|fellowship|walk[- ]?in|vacanc|qualification|salary|pay scale|last date|closing date|apply|position|post)/i.test(`${title} ${rawText}`)) {
      continue;
    }

    const isApplyLink = /\bapply\b/i.test(`${anchorTitle} ${href}`) && !isPdf;
    const titleDates = datesFromTitle(title);
    // A result or call-letter page is source information, not a live vacancy.
    if (resultOnlyTitle(`${title} ${anchorTitle}`) && !/corrigendum|extension/i.test(`${title} ${anchorTitle}`)) continue;
    jobs.push({
      title,
      department: labeled(rawText, /(?:department|organisation|organization|company)/i),
      qualification: labeled(rawText, /(?:qualification|education|eligibility)/i, "qualification"),
      vacancy: labeled(rawText, /(?:total vacancies|vacancies|vacancy|openings)/i, "vacancy"),
      salary: labeled(rawText, /(?:salary|pay scale|pay)/i, "salary"),
      ageLimit: labeled(rawText, /(?:age limit|age)/i, "age"),
      location: labeled(rawText, /(?:job location|location|place of posting)/i, "location"),
      applicationFee: labeled(rawText, /(?:application fee|fee)/i, "fee"),
      selectionProcess: labeled(rawText, /(?:selection process|selection)/i, "selection"),
      applicationStartDate: titleDates.start || labeled(rawText, /(?:start date|application start date)/i, "date"),
      lastDate: titleDates.end || labeled(rawText, /(?:end date|due date|last date(?: to apply)?|closing date|application deadline|apply before)/i, "date"),
      postedDate: labeled(rawText, /(?:published date|publication date)/i, "date"),
      applyLink: isApplyLink ? href : null,
      notificationLink: isApplyLink ? sourceUrl : href,
      officialWebsite: new URL(sourceUrl).origin,
      sourceJobId: nearestSourceJobId(beforeHtml) || extractSourceJobId(rawText),
      sourceUrl,
      rawText: rawText.slice(0, 20_000),
      contentHash: contentHash(rawText),
      isCorrigendum: /corrigendum|date extension|extended/i.test(`${title} ${rawText}`),
      extractionMethod: "HTML",
    });
  }
  return jobs;
}

export function extractHtmlJobs(html: string, source: JobSource, sourceUrl: string) {
  return inspectHtmlJobs(html, source, sourceUrl).jobs;
}

/**
 * Turns many page links into recruitment notices.  Counts here are link facts,
 * not claims that each anchor is a job.
 */
export function inspectHtmlJobs(html: string, source: JobSource, sourceUrl: string): {
  jobs: CollectedJob[];
  metrics: CollectionMetrics;
  warnings: string[];
} {
  const rawLinks = [...html.matchAll(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)].length;
  const anchorJobs = extractAnchorJobs(html, source, sourceUrl);
  const jsonJobs = extractJsonLdJobs(html, source, sourceUrl);
  const merged = new Map<string, CollectedJob>();
  for (const job of [
    ...jsonJobs,
    ...anchorJobs,
  ]) {
    const key = canonicalNoticeIdentity(job);
    const current = merged.get(key);
    merged.set(key, current ? mergeCollectedJobs(current, job) : job);
  }

  const isSbi = /(^|\.)sbi\.(co\.in|bank\.in)$/i.test(source.domain);
  const now = new Date();
  const jobs = [...merged.values()]
    .filter((job) => !resultOnlyTitle(job.title))
    // SBI's Current Openings page also contains archive/result cards. A notice
    // without its explicit, still-open application deadline is not an opening.
    .filter((job) => !isSbi || Boolean(parseSupportedDate(job.lastDate) && parseSupportedDate(job.lastDate)! > now))
    .slice(0, 100);
  const activeKeys = new Set(jobs.map(canonicalNoticeIdentity));
  const recruitmentLinks = [...anchorJobs, ...jsonJobs]
    .filter((job) => activeKeys.has(canonicalNoticeIdentity(job))).length;
  const warnings: string[] = [];
  if (rawLinks > 0 && jobs.length === 0) {
    warnings.push("Page was accessible, but no link had enough recruitment evidence to create a notice.");
  }
  if (/^ssc\.gov\.in$/i.test(source.domain) && rawLinks === 0) {
    warnings.push("SSC returned a client-rendered page shell without notice links. Zero is not evidence that SSC has no notices; an official data endpoint is required before enabling this source.");
  }
  return {
    jobs,
    metrics: {
      rawLinks,
      recruitmentLinks,
      uniqueNotices: jobs.length,
      rejectedNoise: Math.max(0, rawLinks - recruitmentLinks),
    },
    warnings,
  };
}

export function extractPdfLinks(html: string, baseUrl: string) {
  const links = new Map<string, string>();
  for (const match of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = canonicalizeUrl(match[1], baseUrl);
    const label = stripHtml(match[2]);
    if (
      href &&
      /\.pdf(?:\/|$|\?)/i.test(href) &&
      /(recruit|vacanc|notification|advertisement|advt|corrigendum|extension|career|job)/i.test(
        `${label} ${href}`
      )
    ) {
      links.set(href, label);
    }
  }
  return [...links.entries()].map(([url, label]) => ({ url, label }));
}
