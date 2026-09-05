import type { JobSource } from "@prisma/client";
import { automationConfig } from "./config";
import { GenericHtmlAdapter } from "./adapters/generic-html";
import { GovernmentHtmlAdapter } from "./adapters/government-html";
import { PdfNotificationAdapter } from "./adapters/pdf-notification";
import { SscNoticeBoardAdapter } from "./adapters/ssc-notice-board";
import type { SourceAdapter, SourceCollectionResult } from "./types";
import { contentHash } from "./normalizer";
import { isTransientCollectionError } from "./retry";

const adapters: SourceAdapter[] = [
  PdfNotificationAdapter,
  SscNoticeBoardAdapter,
  GovernmentHtmlAdapter,
  GenericHtmlAdapter,
];

function selectAdapter(source: JobSource) {
  const adapter = adapters.find((candidate) => candidate.canHandle(source));
  if (!adapter) throw new Error(`No adapter supports parser type ${source.parserType}`);
  return adapter;
}

export async function collectSource(source: JobSource): Promise<SourceCollectionResult> {
  const started = Date.now();
  try {
    const adapter = selectAdapter(source);
    let result: Awaited<ReturnType<SourceAdapter["collect"]>> | null = null;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await adapter.collect(source);
        break;
      } catch (error) {
        lastError = error;
        if (!isTransientCollectionError(error) || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
    if (!result) throw lastError || new Error("Source collection failed");
    return {
      source,
      jobs: result.jobs.slice(0, automationConfig.maxJobsPerRun),
      discoveredSources: result.discoveredSources,
      succeeded: true,
      durationMs: Date.now() - started,
      contentHash: contentHash([
        result.contentHash || "",
        ...result.jobs.map((job) => job.contentHash),
      ].join("|")),
      metrics: result.metrics || {
        rawLinks: result.jobs.length,
        recruitmentLinks: result.jobs.length,
        uniqueNotices: result.jobs.length,
        rejectedNoise: 0,
      },
      warnings: result.warnings || [],
    };
  } catch (error) {
    return {
      source,
      jobs: [],
      discoveredSources: [],
      succeeded: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown source collection error",
      metrics: { rawLinks: 0, recruitmentLinks: 0, uniqueNotices: 0, rejectedNoise: 0 },
      warnings: [],
    };
  }
}

export async function collectSources(sources: JobSource[]) {
  const results: SourceCollectionResult[] = new Array(sources.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(automationConfig.concurrency, sources.length) },
    async () => {
      while (cursor < sources.length) {
        const index = cursor++;
        results[index] = await collectSource(sources[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export function automationAdapters() {
  return adapters.map((adapter) => adapter.name);
}
