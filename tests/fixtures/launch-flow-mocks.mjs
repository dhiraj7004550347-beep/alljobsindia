export const state = { jobs: [], sources: [], latestRun: null, calls: [], failure: null };
export const automationConfig = { dryRun: true, allowWriteRuns: false, allowAutoPublish: false, allowManualDrafts: false, allowReviewDecisions: false };
// Minimal Prisma predicate evaluator for date/status eligibility fixtures.
export function matches(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return condition.every(item => matches(row, item));
    if (key === 'OR') return condition.some(item => matches(row, item));
    if (condition && typeof condition === 'object') {
      return row[key] != null && Object.entries(condition).every(([op, value]) => op === 'gte' ? row[key] >= value : op === 'lte' ? row[key] <= value : false);
    }
    return row[key] === condition;
  });
}
export const prisma = {
  $queryRaw: async () => { if (state.failure === 'db') throw Error('Unavailable'); return [{ '?column?': 1 }]; },
  job: { count: async ({ where }) => state.jobs.filter(row => matches(row, where)).length },
  jobSource: { findMany: async () => state.sources },
  automationRun: { findFirst: async () => state.latestRun },
};
export async function isAdminRequest() { return false; }
export class AutomationOverlapError extends Error {}
export class AutomationWriteLockedError extends Error {}
export async function runAutomation(input) {
  state.calls.push(input);
  if (state.failure === 'overlap') throw new AutomationOverlapError('Already running');
  if (state.failure === 'locked') throw new AutomationWriteLockedError('Writes locked');
  return { dryRun: input.dryRun };
}
