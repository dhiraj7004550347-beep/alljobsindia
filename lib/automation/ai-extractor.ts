import "server-only";

import { z } from "zod";
import { automationConfig } from "./config";
import { canonicalizeUrl, cleanText, normalizeText } from "./normalizer";
import type { CollectedJob } from "./types";

const extractedSchema = z
  .object({
    title: z.string().max(240).optional(),
    department: z.string().max(300).optional(),
    qualification: z.string().max(2_000).optional(),
    vacancy: z.string().max(200).optional(),
    salary: z.string().max(500).optional(),
    ageLimit: z.string().max(500).optional(),
    location: z.string().max(500).optional(),
    applicationFee: z.string().max(500).optional(),
    selectionProcess: z.string().max(2_000).optional(),
    description: z.string().max(4_000).optional(),
    howToApply: z.string().max(3_000).optional(),
    applicationStartDate: z.string().max(100).optional(),
    lastDate: z.string().max(100).optional(),
    applyLink: z.string().max(2_000).optional(),
    notificationLink: z.string().max(2_000).optional(),
    officialWebsite: z.string().max(2_000).optional(),
    sourceJobId: z.string().max(100).optional(),
    postedDate: z.string().max(100).optional(),
    updatedDate: z.string().max(100).optional(),
  })
  .strict();

type Extracted = z.infer<typeof extractedSchema>;

function extractJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(value.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function supportedValue(value: string, rawText: string) {
  const valueTokens = normalizeText(value).split(" ").filter((token) => token.length > 1);
  const source = normalizeText(rawText);
  return valueTokens.length > 0 && valueTokens.every((token) => source.includes(token));
}

function supportedUrl(value: string, rawText: string) {
  const canonical = canonicalizeUrl(value);
  return canonical && (rawText.includes(value) || rawText.includes(canonical)) ? canonical : null;
}

function supportedFields(extracted: Extracted, candidate: CollectedJob): Partial<CollectedJob> {
  const output: Partial<CollectedJob> = {};
  const urls = new Set(["applyLink", "notificationLink", "officialWebsite"]);

  for (const [key, raw] of Object.entries(extracted)) {
    const value = cleanText(raw);
    if (!value) continue;
    if (urls.has(key)) {
      const url = supportedUrl(value, candidate.rawText);
      if (url) Object.assign(output, { [key]: url });
    } else if (supportedValue(value, candidate.rawText)) {
      Object.assign(output, { [key]: value });
    }
  }
  return output;
}

export async function extractWithOptionalAi(candidate: CollectedJob): Promise<CollectedJob> {
  if (!automationConfig.aiEnabled) return candidate;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !automationConfig.model) return candidate;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), automationConfig.requestTimeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: automationConfig.model,
        input: `Extract only facts explicitly present in the supplied recruitment source text. Return one JSON object only. Use empty strings for absent facts. Never infer or guess vacancies, pay, eligibility, age, fees, dates, or URLs.\n\nAllowed keys: ${Object.keys(extractedSchema.shape).join(", ")}\n\nSOURCE TEXT:\n${candidate.rawText.slice(0, 14_000)}`,
      }),
    });
    if (!response.ok) return candidate;
    const body = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const text =
      body.output_text ||
      body.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") ||
      "";
    const parsed = extractedSchema.safeParse(extractJson(text));
    if (!parsed.success) return candidate;

    const supported = supportedFields(parsed.data, candidate);
    const merged = { ...supported, ...candidate };
    for (const [key, value] of Object.entries(supported)) {
      const current = candidate[key as keyof CollectedJob];
      if (current === null || current === undefined || current === "") {
        Object.assign(merged, { [key]: value });
      }
    }
    return {
      ...merged,
      extractionMethod:
        Object.keys(supported).length > 0 ? "AI" : candidate.extractionMethod,
    } as CollectedJob;
  } catch {
    return candidate;
  } finally {
    clearTimeout(timer);
  }
}
