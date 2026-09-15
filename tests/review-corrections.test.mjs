import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReviewCorrections, applyReviewCorrections, prepareCorrectedCandidate, ReviewCorrectionValidationError } from '../lib/automation/review-corrections.ts';
import { buildPreviewJob } from '../lib/automation/review.ts';

test('corrections normalize exact dates and preserve recruitment URL parameters', () => {
  assert.deepEqual(sanitizeReviewCorrections({ lastDate: '11/10/2099', applyLink: 'https://SSC.GOV.IN/apply/?ref=notice-7&utm_source=test', qualification: ' Graduation ' }), { lastDate: '2099-10-11', applyLink: 'https://ssc.gov.in/apply?ref=notice-7', qualification: 'Graduation' });
});
test('invalid dates, links, values and identity edits are rejected', () => {
  for (const input of [{ lastDate: '31/02/2099' }, { lastDate: 'October 2099' }, { applyLink: 'javascript:alert(1)' }, { applyLink: 'https://user:pass@ssc.gov.in/' }, { sourceUrl: 'https://other.gov.in' }, { title: 'Changed identity' }, { qualification: 5 }, { qualification: 'x'.repeat(2001) }, []]) {
    assert.throws(() => sanitizeReviewCorrections(input), ReviewCorrectionValidationError);
  }
});
test('blank values and untouched original fields remain distinct', () => {
  assert.deepEqual(applyReviewCorrections({ salary: 'Rs. 37,000', location: 'Bengaluru' }, { salary: '' }), { salary: null, location: 'Bengaluru' });
});
test('preview and corrected candidate use the same final field cleanup', () => {
  const original = { title: 'Junior Research Fellow Recruitment', sourceUrl: 'https://drdo.gov.in/jobs', rawText: 'Official recruitment notice with details for eligible graduates.', contentHash: 'a'.repeat(64), extractionMethod: 'PDF' };
  const job = prepareCorrectedCandidate(original, { department: 'DRDO', qualification: 'B.E. / B.Tech', salary: 'Duration of Internship Location of Internship', lastDate: '11/10/2099' });
  const preview = buildPreviewJob(job, { id: 1, name: 'DRDO' }, 0.7, 'WOULD_ADD', 'Review');
  assert.equal(job.salary, null);
  for (const key of ['department', 'qualification', 'salary', 'lastDate']) assert.equal(preview[key], job[key]);
});
test('merged corrections reject a start date later than the deadline', () => {
  const original = { title: 'Junior Research Fellow Recruitment', sourceUrl: 'https://drdo.gov.in/jobs', rawText: 'Official recruitment notice with details for eligible graduates.', contentHash: 'a'.repeat(64), extractionMethod: 'PDF', lastDate: '2099-10-11' };
  assert.throws(() => prepareCorrectedCandidate(original, { applicationStartDate: '12/10/2099' }), ReviewCorrectionValidationError);
});
