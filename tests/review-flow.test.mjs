import { register } from 'node:module';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
register('./fixtures/review-flow-loader.mjs', import.meta.url);
const { state, automationConfig: config } = await import('./fixtures/review-flow-mocks.mjs');
const { reviewCandidateKey, reviewSnapshotHash } = await import('../lib/automation/review.ts');
const { sanitizeCollectedJobFields } = await import('../lib/automation/field-sanitizer.ts');
const { recordManualReviewCorrection, createManualDraft, recordManualReviewDecision, readManualReviewCorrections } = await import('../lib/automation/manual-review.ts');
const correctionRoute = await import('../app/api/admin/review/correction/route.ts');
const draftRoute = await import('../app/api/admin/review/draft/route.ts');
const { NextRequest } = await import('next/server.js');
function input(corrections = { department: 'DRDO', qualification: 'B.E. / B.Tech', salary: 'Rs. 37,000 per month' }) {
  const safe = sanitizeCollectedJobFields(state.candidate);
  return { sourceId: 1, candidateKey: reviewCandidateKey(1, safe), snapshotHash: reviewSnapshotHash(safe), actor: 'review-test', corrections };
}
function request(payload) { return new NextRequest('https://alljobsindia.vercel.app/api/admin/review/correction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
function payload() { const body = input(); delete body.actor; return body; }
beforeEach(() => {
  Object.assign(state, { jobs: [], audit: [], calls: [], session: true, origin: true, rate: true, failSave: false,
    source: { id: 1, name: 'DRDO Official Vacancies', domain: 'drdo.gov.in', category: 'Government Jobs', trusted: false, autoPublish: false },
    candidate: { title: 'Junior Research Fellow Recruitment', sourceJobId: 'DRDO/JRF/99', sourceUrl: 'https://drdo.gov.in/jobs', notificationLink: 'https://drdo.gov.in/notice.pdf', lastDate: '2099-10-11', rawText: 'Official recruitment notice with eligibility and application details. '.repeat(12), contentHash: 'a'.repeat(64), extractionMethod: 'PDF' },
  });
  config.allowReviewDecisions = true; config.allowManualDrafts = true;
});
test('correction save writes an audit record and supports exact-snapshot reload without a Job', async () => {
  const command = input();
  const saved = await recordManualReviewCorrection(command);
  assert.equal(state.jobs.length, 0); assert.equal(saved.preview.action, 'WOULD_ADD');
  assert.equal(saved.preview.snapshotHash, command.snapshotHash); assert.equal(saved.preview.candidateKey, command.candidateKey);
  assert.equal(state.audit[0].details.corrections.department, 'DRDO');
  assert.equal((await readManualReviewCorrections(1))[0].snapshotHash, command.snapshotHash);
});
test('stale source cannot save corrections or create a draft', async () => {
  const command = input(); state.candidate.contentHash = 'b'.repeat(64);
  await assert.rejects(recordManualReviewCorrection(command), /changed after preview/);
  await assert.rejects(createManualDraft(command), /changed after preview/);
  assert.equal(state.audit.length, 0); assert.equal(state.jobs.length, 0); assert.ok(!state.calls.includes('run'));
});
test('corrected draft stays unpublished and audits the actual applied corrections', async () => {
  const saved = await recordManualReviewCorrection(input());
  const created = await createManualDraft(input());
  assert.equal(created.created, true); assert.equal(state.jobs[0].status, 'DRAFT'); assert.equal(state.jobs[0].publishedAt, null);
  assert.equal(state.jobs[0].salary, saved.preview.salary); assert.equal(state.jobs[0].department, saved.preview.department);
  assert.equal(state.audit.at(-1).details.corrections.department, 'DRDO');
});
test('repeat draft requests cannot create a second Job', async () => {
  await createManualDraft(input());
  await assert.rejects(createManualDraft(input()), /Only WOULD_ADD/);
  assert.equal(state.jobs.length, 1);
});
test('review decisions still work without a corrections property and rejection blocks draft', async () => {
  const command = input(); delete command.corrections;
  await recordManualReviewDecision({ ...command, decision: 'REJECTED', reason: 'This exact notice is not suitable.' });
  await assert.rejects(createManualDraft(input()), /requires review/);
  assert.equal(state.jobs.length, 0);
});
test('expired corrections remain ineligible for a draft', async () => {
  await assert.rejects(createManualDraft(input({ ...input().corrections, lastDate: '2000-01-01' })), /EXPIRED/);
  assert.equal(state.jobs.length, 0);
});
test('authentication, origin and capability gates run before writes', async () => {
  state.session = false;
  assert.equal((await correctionRoute.POST(request(payload()))).status, 401);
  state.session = true; state.origin = false;
  assert.equal((await correctionRoute.POST(request(payload()))).status, 403);
  state.origin = true; config.allowReviewDecisions = false;
  assert.equal((await correctionRoute.POST(request(payload()))).status, 423);
  config.allowManualDrafts = false;
  assert.equal((await draftRoute.POST(request({ ...payload(), confirmation: 'CREATE_DRAFT' }))).status, 423);
  assert.deepEqual(state.calls, []);
});
test('invalid corrections return 400 from both APIs before a rate-limit write', async () => {
  const body = { ...payload(), corrections: { lastDate: '31/02/2099' } };
  assert.equal((await correctionRoute.POST(request(body))).status, 400);
  assert.equal((await draftRoute.POST(request({ ...body, confirmation: 'CREATE_DRAFT' }))).status, 400);
  assert.deepEqual(state.calls, []);
});
test('draft endpoint requires explicit CREATE_DRAFT confirmation', async () => {
  assert.equal((await draftRoute.POST(request(payload()))).status, 400);
  assert.deepEqual(state.calls, []);
});
test('rate limit stops corrections and failed audit saves do not report success', async () => {
  state.rate = false;
  assert.equal((await correctionRoute.POST(request(payload()))).status, 429);
  assert.equal(state.jobs.length, 0);
  state.rate = true; state.failSave = true;
  assert.equal((await correctionRoute.POST(request(payload()))).status, 500);
  assert.ok(state.calls.includes('FAILED')); assert.equal(state.audit.length, 0);
});
