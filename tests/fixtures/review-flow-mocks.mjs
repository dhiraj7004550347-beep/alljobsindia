export const state = { jobs: [], audit: [], calls: [], source: null, candidate: null, session: true, origin: true, rate: true, failSave: false };
export const automationConfig = { allowManualDrafts: false, allowReviewDecisions: false, maxJobsPerRun: 50, minimumDraftConfidence: 0.6, highConfidenceThreshold: 0.82, allowAutoPublish: false };
export const prisma = {
  jobSource: { findUnique: async () => state.source },
  job: {
    findMany: async () => state.jobs,
    create: async ({ data }) => { state.calls.push('job'); const job = { ...data, id: state.jobs.length + 1 }; state.jobs.push(job); return job; },
  },
  automationRunItem: { findMany: async () => [...state.audit].reverse() },
};
export async function collectSources() { state.calls.push('collect'); return [{ succeeded: true, jobs: [state.candidate] }]; }
export async function extractWithOptionalAi(candidate) { return candidate; }
export async function acquireAutomationLock() { state.calls.push('lock'); }
export async function releaseAutomationLock() { state.calls.push('unlock'); }
export function buildAutomationJobData(candidate, source, runId, confidence, publish) {
  return { ...candidate, sourceId: source.id, sourceName: source.name, category: source.category, automationRunId: runId, automationConfidence: confidence, status: publish ? 'PUBLISHED' : 'DRAFT' };
}
export async function createAutomationRun() { state.calls.push('run'); return { id: 1 }; }
export async function finishAutomationRun(id, status) { state.calls.push(status); }
export async function logRunItem(item) {
  if (state.failSave) throw new Error('Storage unavailable');
  state.audit.push({ ...item, createdAt: new Date() });
}
export async function getAdminSession() { return state.session ? { username: 'review-test' } : null; }
export function isSameOrigin() { return state.origin; }
export function requestIp() { return '127.0.0.1'; }
export async function checkRateLimit() { state.calls.push('rate'); return { allowed: state.rate, retryAfterSeconds: 5 }; }
