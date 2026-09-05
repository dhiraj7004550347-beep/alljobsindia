import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSafePublicUrl } from "./http";
import { canonicalizeUrl } from "./normalizer";

export const sourceInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  startUrl: z.string().url().max(2_000),
  type: z.enum([
    "GOVERNMENT",
    "PSU",
    "BANKING",
    "RAILWAY",
    "UNIVERSITY",
    "HOSPITAL",
    "PRIVATE_COMPANY",
    "OTHER_OFFICIAL",
  ]),
  category: z.string().trim().min(2).max(100),
  enabled: z.boolean().default(false),
  trusted: z.boolean().default(false),
  autoPublish: z.boolean().default(false),
  parserType: z.enum(["GENERIC_HTML", "GOVERNMENT_HTML", "PDF_NOTIFICATION"]),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
}).strict();

export async function parseSourceInput(value: unknown) {
  const parsed = sourceInputSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Invalid source" };
  }

  try {
    await assertSafePublicUrl(parsed.data.startUrl);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unsafe source URL",
    };
  }

  const startUrl = canonicalizeUrl(parsed.data.startUrl)!;
  const domain = new URL(startUrl).hostname.toLowerCase().replace(/^www\./, "");
  const trusted = parsed.data.reviewStatus === "APPROVED" && parsed.data.trusted;

  return {
    ok: true as const,
    data: {
      ...parsed.data,
      startUrl,
      domain,
      trusted,
      autoPublish: trusted && parsed.data.autoPublish,
    },
  };
}

export function listSources() {
  return prisma.jobSource.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }] });
}

export function enabledSources(sourceIds?: number[]) {
  return prisma.jobSource.findMany({
    where: sourceIds?.length ? { id: { in: sourceIds } } : { enabled: true },
    orderBy: [{ trusted: "desc" }, { name: "asc" }],
  });
}
