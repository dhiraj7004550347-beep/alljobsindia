import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSupportedDate } from '../lib/automation/normalizer.ts';
import { parseJobWriteData } from '../lib/job-input.ts';
import { extractAnchorJobs } from '../lib/automation/adapters/html-parser.ts';
import { sanitizeCollectedJobFields } from '../lib/automation/field-sanitizer.ts';
import { prepareCorrectedCandidate } from '../lib/automation/review-corrections.ts';
const candidate = { title: 'Junior Research Fellow Recruitment', sourceUrl: 'https://drdo.gov.in/jobs', rawText: 'Official recruitment notification.', contentHash: 'a'.repeat(64), extractionMethod: 'PDF' };

test('dates require an exact valid calendar day', () => {
  for (const date of ['October 2099', '2099', '2099-02-31', '31/02/2099', '2099-10-11Tgarbage', '29/02/2099']) assert.equal(parseSupportedDate(date), null, date);
  for (const [input, expected] of [['29/02/2096', '2096-02-29'], ['11 October 2099', '2099-10-11'], ['11-Oct-2099', '2099-10-11'], ['2099-10-11T00:00:00.000Z', '2099-10-11']]) assert.equal(parseSupportedDate(input)?.toISOString().slice(0, 10), expected);
});
test('manual job writes reject ambiguous dates, calendar rollover and reversed range', () => {
  const base = { title: 'Recruitment for Engineers', category: 'Government Jobs' };
  for (const fields of [{ lastDate: '2099-02-31' }, { lastDate: 'October 2099' }, { applicationStartDate: '2099-10-12', lastDate: '2099-10-11' }, { applyLink: 'https://user:password@example.test/' }]) assert.equal(parseJobWriteData({ ...base, ...fields }).ok, false);
  assert.equal(parseJobWriteData({ ...base, applicationStartDate: '2099-10-01', lastDate: '2099-10-11' }).ok, true);
});
test('correction chronology checks original Indian-format deadlines', () => {
  assert.throws(() => prepareCorrectedCandidate({ ...candidate, lastDate: '11/10/2099' }, { applicationStartDate: '12/10/2099' }), /must not be after/);
});
test('DRDO View More uses its linked title rather than preceding notice text', () => {
  const title = 'Advertisement for the Post of Director, DIA-CoE, Bharathiar University';
  const html = `<div>End Date 11/10/2099 View More Previous recruitment notice</div><a href="/director">${title}</a><div>End Date 12/10/2099</div><a href="/director">View More</a>`;
  const jobs = extractAnchorJobs(html, { id: 1, name: 'DRDO', domain: 'drdo.gov.in', category: 'Government Jobs' }, 'https://drdo.gov.in/jobs');
  assert.equal(jobs.length, 2);
  for (const job of jobs) assert.equal(job.title, title);
});
test('age cleanup retains relaxation rules but rejects incomplete reference dates', () => {
  assert.equal(sanitizeCollectedJobFields({ ...candidate, ageLimit: 'The upper age limit for JRF is maximum 28 years as on the' }).ageLimit, null);
  const age = sanitizeCollectedJobFields({ ...candidate, ageLimit: 'Below 25 Years. c. Selected students will only be notified about joining procedures.' }).ageLimit;
  assert.equal(age, 'Below 25 Years.');
  assert.match(sanitizeCollectedJobFields({ ...candidate, ageLimit: '28 years. Relaxation by five years for SC/ST and three years for OBC.' }).ageLimit, /SC\/ST/);
});
