/** Fields that exist on the durable AutomationRun row in every deployed schema. */
export type PersistedAutomationRunCounts = {
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  candidates: number;
  processed: number;
  wouldAdd: number;
  added: number;
  updated: number;
  duplicates: number;
  expired: number;
  skipped: number;
  errors: number;
  draftsCreated: number;
};

/** Keep detailed parser metrics in the run-item JSON snapshot, not DB columns. */
export function persistedAutomationRunCounts(
  counts: PersistedAutomationRunCounts
): PersistedAutomationRunCounts {
  return {
    sourcesChecked: counts.sourcesChecked,
    sourcesSucceeded: counts.sourcesSucceeded,
    sourcesFailed: counts.sourcesFailed,
    candidates: counts.candidates,
    processed: counts.processed,
    wouldAdd: counts.wouldAdd,
    added: counts.added,
    updated: counts.updated,
    duplicates: counts.duplicates,
    expired: counts.expired,
    skipped: counts.skipped,
    errors: counts.errors,
    draftsCreated: counts.draftsCreated,
  };
}

