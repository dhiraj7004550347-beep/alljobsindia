import test from 'node:test';
import assert from 'node:assert/strict';
import { persistedAutomationRunCounts } from '../lib/automation/run-persistence.ts';

test('run finalization persists only columns supported by the deployed schema', () => {
  const persisted = persistedAutomationRunCounts({
    sourcesChecked: 2,
    sourcesSucceeded: 1,
    sourcesFailed: 1,
    candidates: 8,
    processed: 3,
    wouldAdd: 2,
    added: 0,
    updated: 0,
    duplicates: 1,
    expired: 0,
    skipped: 2,
    errors: 1,
    draftsCreated: 0,
    rawLinks: 8,
    recruitmentLinks: 4,
    uniqueNotices: 3,
    parsedJobs: 3,
    rejected: 2,
    lowConfidence: 1,
  });

  assert.deepEqual(persisted, {
    sourcesChecked: 2,
    sourcesSucceeded: 1,
    sourcesFailed: 1,
    candidates: 8,
    processed: 3,
    wouldAdd: 2,
    added: 0,
    updated: 0,
    duplicates: 1,
    expired: 0,
    skipped: 2,
    errors: 1,
    draftsCreated: 0,
  });
});

