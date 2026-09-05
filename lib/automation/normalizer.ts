import { createHash } from "node:crypto";

export function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned || null;
}

export function normalizeText(value: unknown): string {
  return cleanText(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeUrl(value: unknown, base?: string): string | null {
  const raw = cleanText(value);
  if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return null;

  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function contentHash(value: string): string {
  return sha256(cleanText(value));
}

export function parseSupportedDate(value: unknown): Date | null {
  const raw = cleanText(value);
  if (!raw) return null;

  const iso = raw.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})$/);

  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (/20\d{2}/.test(raw)) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function extractSourceJobId(text: string): string | null {
  const match = cleanText(text).match(
    /(?:advertisement|advt\.?|notification|notice)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([a-z0-9][a-z0-9/&_.\-]{2,80})/i
  );
  if (!match) return null;

  const value = cleanText(match[1]).toUpperCase();
  if (
    /^(?:PUBLISHED|DATE|START|END|DUE|LAST|VIEW|MORE|DOWNLOAD|APPLY|ONLINE|NOT|AVAILABLE|NIL|N\/A)$/i.test(
      value
    )
  ) {
    return null;
  }
  return value;
}

export function sourceFingerprint(job: {
  title?: unknown;
  department?: unknown;
  location?: unknown;
  lastDate?: unknown;
  sourceJobId?: unknown;
}): string {
  const deadline = parseSupportedDate(job.lastDate)?.toISOString().slice(0, 10);
  return sha256(
    [
      normalizeText(job.title),
      normalizeText(job.department),
      normalizeText(job.location),
      deadline || "",
      normalizeText(job.sourceJobId),
    ].join("|")
  );
}

export function sameDomain(urlValue: string, domainValue: string): boolean {
  try {
    const host = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
    const domain = domainValue.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}
