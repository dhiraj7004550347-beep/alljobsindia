import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fixtures/launch-flow-loader.mjs', import.meta.url);
const { state, automationConfig, matches } = await import('./fixtures/launch-flow-mocks.mjs');
const { GET, POST } = await import('../app/api/automation/cron/route.ts');
const { getLaunchReadiness } = await import('../lib/automation/launch-readiness.ts');
const { activePublishedJobsWhere, buildPublicJobsWhere, parsePublicJobFilters } = await import('../lib/public-jobs-query.ts');
const { NextRequest } = await import('next/server');

beforeEach(() => {
  state.jobs = []; state.sources = []; state.latestRun = null; state.calls = []; state.failure = null;
  Object.assign(automationConfig, { dryRun: true, allowWriteRuns: false, allowAutoPublish: false, allowManualDrafts: false, allowReviewDecisions: false });
  process.env.CRON_SECRET = 'test-only-cron-secret';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test';
  process.env.ADMIN_SECRET = 'test-only-admin-secret-'.repeat(3);
});
const request = (method, token) => new NextRequest('https://example.test/api/automation/cron', { method, headers: token ? { authorization: `Bearer ${token}` } : {} });

test('cron GET authenticates before engine work and preserves dry-run', async () => {
  assert.equal((await GET(request('GET'))).status, 401);
  assert.equal((await GET(request('GET', 'wrong'))).status, 401);
  assert.equal(state.calls.length, 0);
  const response = await GET(request('GET', process.env.CRON_SECRET));
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls, [{ dryRun: true, requestedBy: 'cron' }]);
  assert.equal((await response.json()).result.dryRun, true);
});
test('cron POST remains supported and lock errors retain their status', async () => {
  assert.equal((await POST(request('POST', process.env.CRON_SECRET))).status, 200);
  state.failure = 'overlap';
  assert.equal((await GET(request('GET', process.env.CRON_SECRET))).status, 409);
  state.failure = 'locked';
  assert.equal((await GET(request('GET', process.env.CRON_SECRET))).status, 423);
});
test('either expired deadline hides published jobs, including conflicting dates', () => {
  const now = new Date('2099-06-15T12:00:00Z');
  const past = new Date('2099-06-14'); const future = new Date('2099-06-20');
  const eligible = activePublishedJobsWhere(now);
  for (const [lastDate, expiresAt, expected] of [[null, null, true], [future, null, true], [null, future, true], [past, future, false], [future, past, false], [past, null, false], [null, past, false]]) {
    assert.equal(matches({ status: 'PUBLISHED', lastDate, expiresAt }, eligible), expected);
  }
  assert.equal(matches({ status: 'DRAFT', lastDate: future, expiresAt: null }, eligible), false);
  const closing = buildPublicJobsWhere(parsePublicJobFilters({ closing: 'soon' }), now);
  assert.equal(matches({ status: 'PUBLISHED', lastDate: new Date('2099-08-01'), expiresAt: future }, closing), true);
});
test('expired published records cannot report launch ready', async () => {
  state.jobs = [{ status: 'PUBLISHED', lastDate: new Date('2000-01-01'), expiresAt: null }];
  const result = await getLaunchReadiness();
  assert.equal(result.ready, false);
  assert.equal(result.counts.publishedJobs, 0);
  assert.equal(result.checks.find(check => check.key === 'content').passed, false);
  assert.equal(result.checks.find(check => check.key === 'recent-run').passed, false);
});
test('manual corrections and drafts can be enabled without certifying automation', async () => {
  state.jobs = [{ status: 'PUBLISHED', lastDate: new Date('2099-01-01'), expiresAt: null }];
  automationConfig.allowManualDrafts = true; automationConfig.allowReviewDecisions = true;
  state.latestRun = { id: 1, status: 'COMPLETED', startedAt: new Date('2000-01-01') };
  const result = await getLaunchReadiness();
  assert.equal(result.ready, true);
  assert.equal(result.checks.find(check => check.key === 'recent-run').passed, false);
  assert.equal(result.checks.find(check => check.key === 'enabled-sources').passed, false);
  assert.equal(result.checks.find(check => check.key === 'manual-drafts').passed, true);
});
test('database failure prevents launch-ready status', async () => {
  state.failure = 'db';
  assert.equal((await getLaunchReadiness()).ready, false);
});
