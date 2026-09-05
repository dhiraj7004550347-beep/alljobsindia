import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { automationConfig } from "./config";

const USER_AGENT =
  "AllJobsIndiaBot/1.0 (+public job information; respects robots.txt)";
const ROBOTS_TTL_MS = 60 * 60 * 1000;

type RobotsCacheEntry = {
  expiresAt: number;
  rules: Array<{ allow: boolean; path: string }>;
};

const robotsCache = new Map<string, RobotsCacheEntry>();
const pdfCache = new Map<string, { expiresAt: number; bytes: Uint8Array; finalUrl: string }>();
const pdfInFlight = new Map<string, Promise<{ bytes: Uint8Array; finalUrl: string }>>();

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export async function assertSafePublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public HTTP/HTTPS sources are supported");
  }
  if (url.username || url.password) {
    throw new Error("Source URLs must not contain credentials");
  }

  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") {
    throw new Error("Only standard public web ports are allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Private or local source URLs are not allowed");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Source resolved to a private or unsafe address");
  }
  return url;
}

async function readBoundedBody(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("Source response is too large");
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Source response exceeded the configured size limit");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function parseRobots(text: string) {
  const groups: Array<{ agents: string[]; rules: RobotsCacheEntry["rules"] }> = [];
  let current: { agents: string[]; rules: RobotsCacheEntry["rules"] } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow") && value) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }

  const named = groups.find((group) =>
    group.agents.some((agent) => agent === "alljobsindiabot")
  );
  const wildcard = groups.find((group) => group.agents.includes("*"));
  return (named || wildcard)?.rules || [];
}

function applyRobotsRules(rules: RobotsCacheEntry["rules"], path: string) {
  const matching = rules
    .filter((rule) => path.startsWith(rule.path.replace(/\*.*$/, "")))
    .sort((a, b) => b.path.length - a.path.length);
  return matching.length === 0 || matching[0].allow;
}

async function robotsAllows(url: URL): Promise<boolean> {
  const cached = robotsCache.get(url.origin);
  if (cached && cached.expiresAt > Date.now()) {
    return applyRobotsRules(cached.rules, `${url.pathname}${url.search}`);
  }

  try {
    const result = await fetchFollowingSafeRedirects(
      new URL("/robots.txt", url.origin).toString(),
      "text/plain,*/*;q=0.1",
      false,
      500_000
    );
    const rules = result.response.ok
      ? parseRobots(new TextDecoder().decode(result.bytes))
      : [];
    robotsCache.set(url.origin, {
      expiresAt: Date.now() + ROBOTS_TTL_MS,
      rules,
    });
    return applyRobotsRules(rules, `${url.pathname}${url.search}`);
  } catch {
    return true;
  }
}

async function fetchFollowingSafeRedirects(
  input: string,
  accept: string,
  respectRobots: boolean,
  maxBytes: number
) {
  let current = input;

  for (let redirect = 0; redirect <= 3; redirect++) {
    const url = await assertSafePublicUrl(current);
    if (respectRobots && !(await robotsAllows(url))) {
      throw new Error("robots.txt does not allow collection from this URL");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), automationConfig.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        cache: "no-store",
        headers: {
          Accept: accept,
          "Accept-Language": "en-IN,en;q=0.9",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Source returned an invalid redirect");
        current = new URL(location, url).toString();
        continue;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await readBoundedBody(response, maxBytes);
      return { response, bytes, finalUrl: url.toString() };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Source request timed out after ${automationConfig.requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Source exceeded the redirect limit");
}

export async function fetchHtml(url: string) {
  const result = await fetchFollowingSafeRedirects(
    url,
    "text/html,application/xhtml+xml,application/json;q=0.8",
    true,
    automationConfig.maxHtmlBytes
  );
  const contentType = result.response.headers.get("content-type") || "";
  if (!/html|json|text\//i.test(contentType)) {
    throw new Error(`Unexpected source content type: ${contentType || "unknown"}`);
  }
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(result.bytes),
    finalUrl: result.finalUrl,
    contentType,
  };
}

export async function fetchPdf(url: string) {
  const key = new URL(url).toString();
  const cached = pdfCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { bytes: cached.bytes.slice(), finalUrl: cached.finalUrl };
  }
  const existingRequest = pdfInFlight.get(key);
  if (existingRequest) {
    const shared = await existingRequest;
    return { bytes: shared.bytes.slice(), finalUrl: shared.finalUrl };
  }
  const request = fetchPdfUncached(key);
  pdfInFlight.set(key, request);
  try {
    const result = await request;
    if (pdfCache.size >= 5) pdfCache.delete(pdfCache.keys().next().value!);
    pdfCache.set(key, { ...result, bytes: result.bytes.slice(), expiresAt: Date.now() + 15 * 60_000 });
    return result;
  } finally {
    pdfInFlight.delete(key);
  }
}

async function fetchPdfUncached(url: string) {
  const result = await fetchFollowingSafeRedirects(url, "application/pdf", true, automationConfig.maxPdfBytes);
  const contentType = result.response.headers.get("content-type") || "";
  const signature = new TextDecoder().decode(result.bytes.slice(0, 5));
  if (!/application\/pdf/i.test(contentType) && signature !== "%PDF-") {
    throw new Error("The notification URL did not return a PDF");
  }
  return { bytes: result.bytes, finalUrl: result.finalUrl };
}
