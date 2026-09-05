import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeUrl,
  normalizeText,
  parseSupportedDate,
  sourceFingerprint,
  extractSourceJobId,
} from "../lib/automation/normalizer.ts";
import { jobMatchesAlert } from "../lib/automation/alerts.ts";
import { changedFields, createDedupeIndex, findExistingJob } from "../lib/automation/dedupe.ts";
import { canonicalNoticeIdentity, extractHtmlJobs, inspectHtmlJobs, mergeCollectedJobs, plausibleLabeledValue, stripHtml } from "../lib/automation/adapters/html-parser.ts";
import { mergePdfEnrichment, officialHttpsUrl } from "../lib/automation/adapters/notice-enrichment.ts";
import { isPdfAmendmentNotice, pdfTitle } from "../lib/automation/adapters/pdf-notification.ts";
import { classifyCandidateQuality } from "../lib/automation/quality.ts";
import { extractRecruitmentPdfFields, findSupportedApplyUrl, sanitizePdfField } from "../lib/automation/pdf-fields.ts";
import { extractPdfText } from "../lib/automation/pdf-parser.ts";
import { parseSscNoticeBoardPayload } from "../lib/automation/adapters/ssc-notice-board.ts";
import { validateCandidate } from "../lib/automation/validator.ts";
import {
  buildPublicJobsWhere,
  parsePublicJobFilters,
  publicJobsPageCount,
} from "../lib/public-jobs-query.ts";
import { publicJobSelect } from "../lib/public-job.ts";
import { isTransientCollectionError } from "../lib/automation/retry.ts";
import { sanitizeCollectedJobFields } from "../lib/automation/field-sanitizer.ts";
import { hashAlertToken, normalizeAlertEmail } from "../lib/automation/alert-token.ts";
import {
  buildPreviewJob,
  manualDraftEligibility,
  reviewCandidateKey,
  reviewSnapshotHash,
  applyPersistedReviewDecision,
} from "../lib/automation/review.ts";

test("canonical URLs remove tracking noise but preserve official parameters", () => {
  assert.equal(
    canonicalizeUrl("https://example.gov.in/jobs/?id=42&utm_source=test#section"),
    "https://example.gov.in/jobs?id=42"
  );
});

test("normalization and fingerprinting are deterministic", () => {
  assert.equal(normalizeText("  Senior–Engineer (IT) "), "senior engineer it");
  const candidate = {
    title: "Senior Engineer",
    department: "Example PSU",
    location: "Delhi",
    lastDate: "2026-12-31",
    notificationLink: "https://example.gov.in/notice.pdf",
  };
  assert.equal(sourceFingerprint(candidate), sourceFingerprint({ ...candidate }));
  assert.equal(sourceFingerprint(candidate).length, 64);
});

test("unsupported or ambiguous dates are never invented", () => {
  assert.equal(parseSupportedDate("not announced"), null);
  assert.equal(parseSupportedDate(undefined), null);
  assert.equal(parseSupportedDate("2026-12-31")?.toISOString().slice(0, 10), "2026-12-31");
});

test("alert matching respects category, location and qualification", () => {
  const job = { title: "Clerk", category: "Banking Jobs", location: "Mumbai", qualification: "Graduate" };
  const preference = {
    id: "one",
    keywords: ["clerk"],
    categories: ["banking"],
    locations: ["Mumbai"],
    qualification: "graduate",
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  assert.equal(jobMatchesAlert(job, preference), true);
  assert.equal(jobMatchesAlert(job, { ...preference, active: false }), false);
});

test("alert tokens are deterministic and emails are normalized", () => {
  assert.equal(normalizeAlertEmail("  User@Example.COM "), "user@example.com");
  assert.equal(hashAlertToken("token").length, 64);
  assert.equal(hashAlertToken("token"), hashAlertToken("token"));
  assert.notEqual(hashAlertToken("token"), hashAlertToken("other"));
});

test("dedupe prioritizes source ID and canonical notification URL", () => {
  const existing = {
    id: 7,
    title: "Engineer Recruitment",
    department: "Example PSU",
    location: "Delhi",
    lastDate: new Date("2026-12-31"),
    sourceId: 3,
    sourceJobId: "ADV-42",
    notificationLink: "https://example.gov.in/notice.pdf",
    canonicalNoticeUrl: "https://example.gov.in/notice.pdf",
    applyLink: null,
    canonicalApplyUrl: null,
    sourceHash: null,
  };
  const index = createDedupeIndex([existing]);
  const source = { id: 3 };
  assert.equal(
    findExistingJob(index, { title: "Changed title", sourceJobId: "adv-42" }, source)?.job.id,
    7
  );
  assert.equal(
    findExistingJob(index, { title: "Other", notificationLink: "https://www.example.gov.in/notice.pdf?utm_source=x" }, source)?.job.id,
    7
  );
});

test("corrigendum matching updates the original source record", () => {
  const existing = {
    id: 9,
    title: "Assistant Engineer Electrical Posts",
    department: "Example Board",
    location: "Patna",
    lastDate: new Date("2026-10-10"),
    sourceId: 4,
    sourceJobId: null,
    notificationLink: null,
    canonicalNoticeUrl: null,
    applyLink: null,
    canonicalApplyUrl: null,
    sourceHash: null,
  };
  const match = findExistingJob(
    createDedupeIndex([existing]),
    { title: "Corrigendum: Assistant Engineer Electrical Posts last date extension", isCorrigendum: true },
    { id: 4 }
  );
  assert.equal(match?.job.id, 9);
  assert.equal(match?.matchedBy, "corrigendum title/source");
});

test("source IDs reject adjacent labels and preserve official advertisement numbers", () => {
  assert.equal(extractSourceJobId("Advertisement No Published Date 27/08/2026"), null);
  assert.equal(
    extractSourceJobId("ADVERTISEMENT NO: CRPD/CR/2026-27/17"),
    "CRPD/CR/2026-27/17"
  );
  assert.equal(
    extractSourceJobId("Advertisement No DIBT/HRD/RA&JRF/RECT/2026"),
    "DIBT/HRD/RA&JRF/RECT/2026"
  );
});

test("SBI sub-links merge into one recruitment and result-only cards are excluded", () => {
  const html = `
    <section>
      <h3>RECRUITMENT OF JUNIOR ASSOCIATES (Apply Online from 11.12.2026 to 31.12.2026)</h3>
      <p>ADVERTISEMENT NO: CRPD/CR/2026-27/17</p>
      <p>LAST DATE TO APPLY: 31-12-2026</p>
      <a href="/documents/ja-biodata.pdf">BIODATA</a>
      <a href="/documents/ja-17.pdf/official-uuid?t=123">DOWNLOAD ADVERTISEMENT</a>
      <a href="https://apply.sbi.co.in/ja-17">APPLY ONLINE</a>
      <a href="https://apply.sbi.co.in/ja-17">Apply Now</a>
    </section>
    <section>
      <h3>RECRUITMENT OF PROBATIONARY OFFICERS (FINAL RESULT ANNOUNCED)</h3>
      <p>ADVERTISEMENT NO: CRPD/PO/2025-26/04</p>
      <a href="/documents/po-result.pdf">FINAL RESULT</a>
    </section>
  `;
  const source = {
    id: 5,
    name: "SBI Official Current Openings",
    domain: "sbi.co.in",
    category: "Banking Jobs",
  };
  const jobs = extractHtmlJobs(html, source, "https://sbi.co.in/web/careers/current-openings");

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourceJobId, "CRPD/CR/2026-27/17");
  assert.match(jobs[0].title, /RECRUITMENT OF JUNIOR ASSOCIATES/i);
  assert.doesNotMatch(jobs[0].title, /ADVERTISEMENT NO|DOWNLOAD/i);
  assert.equal(jobs[0].notificationLink, "https://sbi.co.in/documents/ja-17.pdf/official-uuid?t=123");
  assert.equal(jobs[0].applyLink, "https://apply.sbi.co.in/ja-17");
  assert.equal(jobs[0].lastDate, "31.12.2026");
});

test("DRDO title and View More links collapse into one vacancy with its deadline", () => {
  const html = `
    <article>
      <a href="/drdo/en/vacancy/debel-jrf">DEBEL, Bengaluru invites application for the post of Junior Research Fellow (JRF)</a>
      <div>Advertisement No</div><div>DEBEL/HRD/1/JRF-1/2026</div>
      <div>Published Date</div><div>27/08/2026</div>
      <div>Start Date</div><div>27/08/2026</div>
      <div>End Date</div><div>18/09/2026</div>
      <a href="/drdo/en/vacancy/debel-jrf">View More</a>
    </article>
  `;
  const source = {
    id: 4,
    name: "DRDO Official Vacancies",
    domain: "drdo.gov.in",
    category: "Government Jobs",
  };
  const jobs = extractHtmlJobs(html, source, "https://drdo.gov.in/drdo/en/offerings/vacancies");

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourceJobId, "DEBEL/HRD/1/JRF-1/2026");
  assert.match(jobs[0].title, /Junior Research Fellow/);
  assert.equal(jobs[0].lastDate, "18/09/2026");
});

test("raw links, recruitment links, and unique notices have distinct meanings", () => {
  const html = `<article><h3>Recruitment of Engineers</h3><p>Advertisement No: ENG/1/2026</p><a href="/eng.pdf">Download Advertisement</a><a href="/apply">Apply Online</a><a href="/contact">Contact</a><a href="/result">Final Result</a></article>`;
  const report = inspectHtmlJobs(html, { id: 2, name: "Official", domain: "example.gov.in", category: "Gov" }, "https://example.gov.in/jobs");
  assert.equal(report.metrics.rawLinks, 4);
  assert.equal(report.metrics.uniqueNotices, 1);
  assert.ok(report.metrics.recruitmentLinks >= 1);
  assert.ok(report.metrics.rejectedNoise >= 1);
});

test("canonical notice identity prefers an official notice number over sub-links", () => {
  assert.equal(
    canonicalNoticeIdentity({ sourceJobId: "CRPD/CR/2026-27/17", title: "One", lastDate: null }),
    canonicalNoticeIdentity({ sourceJobId: "crpd/cr/2026-27/17", title: "Other", lastDate: null })
  );
});

test("a persistent match with changed data is a true update, not an in-memory preview update", () => {
  const existing = {
    id: 71, title: "Recruitment of Engineers", department: "Example", location: "Delhi", lastDate: new Date("2026-10-10"),
    sourceId: 3, sourceJobId: "ENG/1/2026", notificationLink: "https://example.gov.in/eng.pdf", canonicalNoticeUrl: "https://example.gov.in/eng.pdf", applyLink: null, canonicalApplyUrl: null, sourceHash: null,
  };
  const incoming = { title: "Recruitment of Engineers", sourceJobId: "ENG/1/2026", sourceUrl: "https://example.gov.in/jobs", rawText: "official recruitment notice", contentHash: "a".repeat(64), lastDate: "15/10/2026", notificationLink: "https://example.gov.in/eng.pdf" };
  const match = findExistingJob(createDedupeIndex([existing]), incoming, { id: 3 });
  assert.equal(match?.job.id, 71);
  assert.deepEqual(changedFields(match.job, incoming), ["lastDate"]);
});

test("result and call-letter-only links are rejected before notices are created", () => {
  const html = `<section><h3>Recruitment of Officers</h3><p>Advertisement No: OFF/1/2026</p><a href="/result.pdf">Final Result</a><a href="/call.pdf">Call Letter</a></section>`;
  const jobs = extractHtmlJobs(html, { id: 1, name: "Official", domain: "example.gov.in", category: "Gov" }, "https://example.gov.in/jobs");
  assert.equal(jobs.length, 0);
});

test("SBI uses each opening title date and does not copy a later deadline to expired cards", () => {
  const html = `
    <section><h3>RECRUITMENT OF ACTIVE OFFICERS (Apply Online from 01.12.2026 to 31.12.2026)</h3><p>ADVERTISEMENT NO: CRPD/SCO/2026-27/99</p><a href="/active.pdf">DOWNLOAD ADVERTISEMENT</a><a href="https://apply.sbi.bank.in/active">APPLY ONLINE</a></section>
    <section><h3>RECRUITMENT OF OLD OFFICERS (Apply Online from 01.08.2026 to 27.08.2026)</h3><p>ADVERTISEMENT NO: CRPD/SCO/2026-27/98</p><a href="/old.pdf">DOWNLOAD ADVERTISEMENT</a><a href="https://apply.sbi.bank.in/old">APPLY ONLINE</a></section>`;
  const report = inspectHtmlJobs(html, { id: 5, name: "SBI", domain: "sbi.bank.in", category: "Banking" }, "https://sbi.bank.in/web/careers/current-openings");
  assert.equal(report.jobs.length, 1);
  assert.equal(report.jobs[0].sourceJobId, "CRPD/SCO/2026-27/99");
  assert.equal(report.jobs[0].lastDate, "31.12.2026");
  assert.equal(report.jobs[0].notificationLink, "https://sbi.bank.in/active.pdf");
});

test("SSC empty client shell reports a parser warning instead of manufacturing jobs", () => {
  const report = inspectHtmlJobs("<main><div id=app></div></main>", { id: 3, name: "SSC", domain: "ssc.gov.in", category: "Government" }, "https://ssc.gov.in/home/notice-board");
  assert.equal(report.jobs.length, 0);
  assert.match(report.warnings.join(" "), /client-rendered page shell/i);
});

test("public job filters are bounded and server pagination never has page zero", () => {
  const filters = parsePublicJobFilters({
    q: "  Engineer  ",
    category: "Government Jobs",
    location: "Delhi",
    closing: "soon",
    page: "999999",
  });
  assert.deepEqual(filters, {
    query: "Engineer",
    category: "Government Jobs",
    location: "Delhi",
    closingSoon: true,
    page: 10_000,
  });
  assert.equal(publicJobsPageCount(0), 1);
  assert.equal(publicJobsPageCount(25), 3);
  const where = buildPublicJobsWhere(filters, new Date("2026-09-01T00:00:00Z"));
  assert.equal(Array.isArray(where.AND), true);
  assert.match(JSON.stringify(where), /PUBLISHED/);
  assert.match(JSON.stringify(where), /Engineer/);
});

test("featured public API selection excludes internal automation fields", () => {
  for (const field of [
    "sourceHash",
    "rawSourceReference",
    "automationConfidence",
    "automationRunId",
    "reviewStatus",
  ]) {
    assert.equal(field in publicJobSelect, false, `${field} must not be public`);
  }
  assert.equal(publicJobSelect.title, true);
  assert.equal(publicJobSelect.sourceUrl, true);
});

test("SSC official JSON endpoint keeps recruitment notices and rejects result noise", () => {
  const source = {
    id: 3,
    name: "SSC Official Notice Board",
    domain: "ssc.gov.in",
    category: "Government Jobs",
    startUrl: "https://ssc.gov.in/home/notice-board",
  };
  const payload = JSON.stringify({
    data: {
      items: [
        {
          id: "ssc-cgl-2026",
          headline: "Notice of Combined Graduate Level Examination, 2026",
          publishedAt: "2026-08-20T12:00:00.000Z",
          endDate: "2026-09-30T23:59:59.000Z",
          attachment: { fileName: "Notice_of_adv_cgl_2026.pdf" },
        },
        {
          id: "ssc-result-2026",
          headline: "Combined Graduate Level Examination, 2025: Declaration of Final Result",
          attachment: { fileName: "cgl_final_result.pdf" },
        },
      ],
    },
  });
  const parsed = parseSscNoticeBoardPayload(
    payload,
    source,
    source.startUrl,
    "https://ssc.gov.in/api/general-website/portal/notice-boards?page=1"
  );

  assert.equal(parsed.recordsScanned, 2);
  assert.equal(parsed.rawLinks, 2);
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0].sourceJobId, "ssc-cgl-2026");
  assert.equal(parsed.jobs[0].lastDate, "30/09/2026");
  assert.match(parsed.jobs[0].notificationLink, /Notice_of_adv_cgl_2026\.pdf$/);
});

test("DRDO PDF facts support confidence without inventing an apply URL", () => {
  const rawText = `
    DEFENCE BIOENGINEERING AND ELECTROMEDICAL LABORATORY (DEBEL)
    Advt No. DEBEL/HRD/1/JRF-1/2026
    ADVERTISEMENT FOR THE AWARD OF JUNIOR RESEARCH FELLOW (JRF)
    No. of Fellowships 02
    Essential Qualifications BE/BTech in Mechanical Engineering with first division and valid GATE score.
    General Conditions Tenure is two years.
    Age Limit The upper age limit for JRF is maximum 28 years as on the closing date.
    THE CLOSING DATE OF RECEIPT OF APPLICATIONS is 18th Sep 2026.
    How to apply Candidates must email the signed prescribed application form with supporting certificates.
    Selection procedure Screening followed by interview.
    Visit https://www.drdo.gov.in for updates.
  `;
  const fields = extractRecruitmentPdfFields(rawText);
  assert.equal(fields.vacancy, "02");
  assert.match(fields.qualification, /Mechanical Engineering/i);
  assert.match(fields.ageLimit, /28 years/i);
  assert.equal(fields.lastDate, "18 Sep 2026");
  assert.equal(fields.applyLink, null);
  assert.equal(findSupportedApplyUrl("Apply online at https://ssc.gov.in/candidate-portal/apply"), "https://ssc.gov.in/candidate-portal/apply");

  const job = {
    title: "DEBEL Junior Research Fellow (JRF)",
    ...fields,
    department: "DEBEL, DRDO",
    notificationLink: "https://drdo.gov.in/drdo/sites/default/files/vacancy/debel-jrf.pdf",
    officialWebsite: "https://drdo.gov.in",
    sourceJobId: "DEBEL/HRD/1/JRF-1/2026",
    sourceUrl: "https://drdo.gov.in/drdo/en/offerings/vacancies/debel-jrf",
    rawText,
    contentHash: "a".repeat(64),
    extractionMethod: "PDF",
  };
  const validation = validateCandidate(job, {
    id: 4,
    domain: "drdo.gov.in",
    trusted: false,
    autoPublish: false,
    reviewStatus: "PENDING",
  });
  assert.ok(validation.confidence >= 0.6);
  assert.equal(validation.eligibleForAutoPublish, false);
});

test("detail and PDF records merge into one canonical notice", () => {
  const detail = {
    title: "DEBEL invites applications for Junior Research Fellow",
    lastDate: "18/09/2026",
    notificationLink: "https://drdo.gov.in/drdo/en/offerings/vacancies/debel-jrf",
    sourceJobId: "DEBEL/HRD/1/JRF-1/2026",
    sourceUrl: "https://drdo.gov.in/drdo/en/offerings/vacancies/debel-jrf",
    rawText: "Official DRDO detail page",
    contentHash: "a".repeat(64),
    extractionMethod: "HTML",
  };
  const pdf = {
    ...detail,
    title: "ADVERTISEMENT FOR THE AWARD OF JUNIOR RESEARCH FELLOW",
    qualification: "BE/BTech in Mechanical Engineering",
    vacancy: "02",
    notificationLink: "https://drdo.gov.in/drdo/sites/default/files/vacancy/debel-jrf.pdf",
    sourceUrl: "https://drdo.gov.in/drdo/sites/default/files/vacancy/debel-jrf.pdf",
    rawText: "Official PDF source text with qualifications and vacancy details".repeat(20),
    contentHash: "b".repeat(64),
    extractionMethod: "PDF",
  };
  const merged = mergeCollectedJobs(detail, pdf);
  assert.equal(canonicalNoticeIdentity(detail), canonicalNoticeIdentity(pdf));
  assert.equal(merged.sourceUrl, detail.sourceUrl);
  assert.equal(merged.notificationLink, pdf.notificationLink);
  assert.equal(merged.qualification, pdf.qualification);
  assert.equal(merged.vacancy, "02");
});

test("draft quality gate classifies confidence below 60 percent as low", () => {
  const candidate = {
    title: "Recruitment of Specialist Officers",
    sourceJobId: "ADV/1/2026",
    sourceUrl: "https://example.gov.in/jobs",
    notificationLink: "https://example.gov.in/notice.pdf",
    rawText: "Official recruitment notice with an application deadline and supporting details.",
    contentHash: "a".repeat(64),
    lastDate: "31/12/2030",
    extractionMethod: "HTML",
  };
  assert.equal(classifyCandidateQuality(candidate, 0.59, 0.6, new Date("2026-09-01")).action, "LOW_CONFIDENCE");
  assert.equal(classifyCandidateQuality(candidate, 0.6, 0.6, new Date("2026-09-01")).action, "WOULD_ADD");
});

test("escaped HTML and navigation text cannot become vacancy or age facts", () => {
  assert.equal(
    stripHtml('Vacancies &lt;span class="views-field-field-due-date-content"&gt;16/09/2026&lt;/span&gt;'),
    "Vacancies 16/09/2026"
  );
  assert.equal(plausibleLabeledValue("16/09/2026", "vacancy"), null);
  assert.equal(plausibleLabeledValue("1 Page 2 Next page Last page Know More About", "age"), null);
  assert.equal(plausibleLabeledValue("02", "vacancy"), "02");
  assert.equal(plausibleLabeledValue("Maximum 28 years", "age"), "Maximum 28 years");

  const noisyListing = `
    <section>
      <div>Vacancies &lt;span class="views-field-field-due-date-content"&gt;16/09/2026&lt;/span&gt;</div>
      <div>Page 1 Page 2 Next page Last page Know More About</div>
      <a href="/drdo/en/offerings/vacancies/dibt-jrf">DIBT invites applications for Research Associate and JRF posts</a>
      <div>Start Date 25/08/2026</div><div>End Date 24/09/2026</div>
    </section>`;
  const jobs = extractHtmlJobs(
    noisyListing,
    { id: 4, name: "DRDO", domain: "drdo.gov.in", category: "Government Jobs" },
    "https://drdo.gov.in/drdo/en/offerings/vacancies"
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].vacancy, null);
  assert.equal(jobs[0].ageLimit, null);
});

test("official DRDO HTTP detail links are upgraded to HTTPS", () => {
  assert.equal(
    officialHttpsUrl(
      "http://drdo.gov.in/drdo/en/offerings/vacancies/debel-jrf",
      { domain: "drdo.gov.in", startUrl: "https://drdo.gov.in/drdo/en/offerings/vacancies" }
    ),
    "https://drdo.gov.in/drdo/en/offerings/vacancies/debel-jrf"
  );
});

test("SSC vacancy revisions are amendments and cannot represent new jobs alone", () => {
  const source = {
    id: 3,
    name: "SSC Official Notice Board",
    domain: "ssc.gov.in",
    category: "Government Jobs",
    startUrl: "https://ssc.gov.in/home/notice-board",
  };
  const parsed = parseSscNoticeBoardPayload(
    JSON.stringify({ data: [{ id: "revision-1", headline: "Important Notice: Revised vacancies regarding Constable Examination, 2025", attachment: { fileName: "revised-vacancies.pdf" } }] }),
    source,
    source.startUrl,
    "https://ssc.gov.in/api/general-website/portal/notice-boards?page=1"
  );
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0].isCorrigendum, true);
});

function minimalTextPdf(text) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 72 100 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

test("PDF worker preloads and text extraction succeeds", async () => {
  const parsed = await extractPdfText(minimalTextPdf("Official Recruitment Notice"));
  assert.match(parsed.text, /Official Recruitment Notice/);
  assert.equal(parsed.pagesRead, 1);
});

test("PDF field cleanup removes mojibake and rejects table serials as vacancy totals", () => {
  const fields = extractRecruitmentPdfFields(`
    No. of Vacancies 1. Food Science and Technology Research Associate 01
    Essential Qualification à¤¦à¥ à¤µà¤¾à¤°à¤¾ Candidates should have passed ITI recognized by NCVT with two years duration.
    Selection Procedure à¤à¤¯à¤¨ Selection will be carried out by shortlisting followed by walk-in interview.
  `);
  assert.equal(fields.vacancy, null);
  assert.equal(fields.qualification, "Candidates should have passed ITI recognized by NCVT with two years duration.");
  assert.match(fields.selectionProcess, /shortlisting followed by walk-in interview/i);
  assert.doesNotMatch(fields.qualification, /à¤|ï¿½|�/);
  assert.equal(sanitizePdfField("à¤à¤¯à¤¨ Official English text", 100), "Official English text");
});

test("PDF title selection preserves listing titles and rejects table fragments", () => {
  const fallback = "DEBEL, Bengaluru invites application for the post of Junior Research Fellow (JRF)";
  assert.equal(
    pdfTitle("Actual number of vacancies may vary as per Organisational requirement.", fallback),
    fallback
  );

  const listing = {
    title: fallback,
    sourceUrl: "https://drdo.gov.in/vacancies/debel",
    notificationLink: "https://drdo.gov.in/vacancies/debel",
    rawText: "Official listing text",
    contentHash: "a".repeat(64),
    extractionMethod: "HTML",
  };
  const merged = mergePdfEnrichment(listing, {
    ...listing,
    title: "Actual number of vacancies may vary as per Organisational requirement.",
    notificationLink: "https://drdo.gov.in/vacancy/debel.pdf",
    rawText: "Official PDF recruitment facts ".repeat(30),
    contentHash: "b".repeat(64),
    extractionMethod: "PDF",
  });
  assert.equal(merged.title, fallback);
  assert.match(merged.notificationLink, /debel\.pdf$/);

  assert.equal(
    pdfTitle(
      "MINISTRY OF DEFENCE ADVERTISEMENT FOR SELECTION OF ITI APPRENTICES FOR TRAINING THROUGH WALK-IN INTERVIEW Essential Qualifications Candidates must have ITI.",
      "walk in interview"
    ),
    "ADVERTISEMENT FOR SELECTION OF ITI APPRENTICES FOR TRAINING THROUGH WALK-IN INTERVIEW"
  );
});

test("PDF amendment detection is header-bound and does not reject an active SBI advertisement", () => {
  const title = "RECRUITMENT OF SPECIALIST CADRE OFFICER ON REGULAR BASIS";
  const body = `${title} Official opening and eligibility details. ${"application conditions ".repeat(80)} The Bank may announce an extended last date separately.`;
  assert.equal(isPdfAmendmentNotice(title, title, body), false);
  assert.equal(
    isPdfAmendmentNotice("CORRIGENDUM: Extension of the last date", "Corrigendum", "Official corrigendum"),
    true
  );
});

test("unreadable preview facts cannot pass the draft quality gate", () => {
  const candidate = {
    title: "Recruitment of Junior Research Fellows",
    qualification: "à¤¦à¥ broken text",
    notificationLink: "https://example.gov.in/notice.pdf",
    sourceUrl: "https://example.gov.in/jobs",
    rawText: "Official recruitment source text ".repeat(10),
    contentHash: "a".repeat(64),
    extractionMethod: "PDF",
  };
  assert.equal(
    classifyCandidateQuality(candidate, 0.9, 0.6, new Date("2026-09-02")).action,
    "LOW_CONFIDENCE"
  );
});

test("age extraction requires numeric age evidence instead of a relaxation paragraph", () => {
  const fields = extractRecruitmentPdfFields(
    "Age Limit indicated is for Unreserved category candidates. Relaxation in upper age limit will be available as per Government guidelines. 6. Selection Procedure Shortlisting and interview."
  );
  assert.equal(fields.ageLimit, null);

  const supported = extractRecruitmentPdfFields(
    "Upper Age Limit Maximum 28 years as on the closing date. Selection Procedure Interview."
  );
  assert.match(supported.ageLimit, /28 years/i);
});

test("collection retries only bounded transient transport failures", () => {
  assert.equal(isTransientCollectionError(new Error("fetch failed")), true);
  assert.equal(isTransientCollectionError(new Error("This operation was aborted")), true);
  assert.equal(isTransientCollectionError(new Error("Source request timed out after 30000ms")), true);
  assert.equal(isTransientCollectionError(new Error("HTTP 503")), true);
  assert.equal(isTransientCollectionError(new Error("HTTP 403")), false);
  assert.equal(isTransientCollectionError(new Error("robots.txt does not allow collection")), false);
});

test("final candidate sanitization removes merged mojibake and bounds review fields", () => {
  const rawText = "Official CVRDE apprenticeship recruitment. Total Vacancy 1 Computer Operator 13 Fitter 10.";
  const cleaned = sanitizeCollectedJobFields({
    title: "walk in interview",
    qualification: "NCVT/SCVT à¤¦à¥ à¤µà¤¾à¤°à¤¾ Candidates should have passed ITI recognized by NCVT/SCVT with two years duration.",
    vacancy: "1",
    salary: "(Rs) à¤à¥à¤² Total Vacancy 1 Computer Operator 10,560/- 13 Electrician 11,040/- 12",
    ageLimit: "As on 01/09/2026 â¢ Minimum Age limit: 18 years Maximum Age limit: 27 years Part 3",
    selectionProcess: "à¤à¤¯à¤¨ Selection will be carried out by shortlisting followed by walk-in interview. Selected candidates will receive joining letters. General Instructions Other text.",
    sourceUrl: "https://drdo.gov.in/vacancies",
    notificationLink: "https://drdo.gov.in/vacancy/cvrde.pdf",
    rawText,
    contentHash: "a".repeat(64),
    extractionMethod: "PDF",
  });
  assert.doesNotMatch(JSON.stringify(cleaned), /à¤|ï¿½|â|�/);
  assert.equal(cleaned.vacancy, null);
  assert.ok((cleaned.qualification?.length || 0) <= 420);
  assert.ok((cleaned.salary?.length || 0) <= 220);
  assert.ok((cleaned.ageLimit?.length || 0) <= 240);
  assert.ok((cleaned.selectionProcess?.length || 0) <= 360);
});

test("navigation chrome cannot become a department", () => {
  const sanitized = sanitizeCollectedJobFields({
    title: "Recruitment of Engineer",
    department: "Search here Search Home Organisation About DRDO Our Team Technology Clusters Corporate Clusters Offerings Schemes and Services Industry Support",
    rawText: "official recruitment notice",
  });
  assert.equal(sanitized.department, null);
});

test("normal SSC recruitment labels cannot become amendments from PDF body text", () => {
  assert.equal(
    isPdfAmendmentNotice(
      "Notice of Junior Engineer Examination, 2026",
      "Notice of Junior Engineer Examination, 2026",
      "CORRIGENDUM references from an annexure and historical instructions"
    ),
    false
  );
});

test("DRDO View More inherits the full nearby recruitment title", () => {
  const html = `
    <article>
      <div>CVRDE, Chennai invites applications from eligible candidates for apprenticeship training through walk in interview</div>
      <div>Advertisement No</div><div>CVRDE/ADMIN/2026-27</div>
      <div>Start Date 02/09/2026</div><div>End Date 09/09/2026</div>
      <a href="/drdo/en/offerings/vacancies/cvrde-apprentices">View More</a>
    </article>`;
  const jobs = extractHtmlJobs(
    html,
    { id: 4, name: "DRDO", domain: "drdo.gov.in", category: "Government Jobs" },
    "https://drdo.gov.in/drdo/en/offerings/vacancies"
  );
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].title, /CVRDE.*apprenticeship training/i);
  assert.doesNotMatch(jobs[0].title, /^walk in interview$/i);
});

test("final review fields reject navigation chrome and pay-table fragments", () => {
  const cleaned = sanitizeCollectedJobFields({
    title: "CVRDE apprenticeship recruitment through walk in interview",
    department: "Search here Search Home Organisation About DRDO Our Team Technology Clusters Corporate Clusters Offerings Schemes and Services Industry Support",
    salary: "(Rs.) 1. Graduate Apprentice B.Sc. Microbiology 06 Rs. 12,300/- 2. Biochemistry 04 Rs. 12,300/-",
    applicationFee: "₹ 100/- (Rupees One Hundred only). Women, SC, ST, PwBD and Ex-Servicemen candidates are exempted from payment of fee. Additional payment gateway and application instructions follow here and must not leak into the field.",
    sourceUrl: "https://drdo.gov.in/vacancies",
    notificationLink: "https://drdo.gov.in/vacancy/cvrde.pdf",
    rawText: "Official apprenticeship recruitment notice",
    contentHash: "a".repeat(64),
    extractionMethod: "PDF",
  });
  assert.equal(cleaned.department, null);
  assert.equal(cleaned.salary, null);
  assert.ok((cleaned.applicationFee?.length || 0) <= 200);
});

test("normal SSC exam notice overrides an unrelated inherited amendment flag", () => {
  const listing = {
    title: "Notice of Junior Engineer Examination, 2026",
    isCorrigendum: true,
    sourceUrl: "https://ssc.gov.in/home/notice-board",
    notificationLink: "https://ssc.gov.in/je.pdf",
    rawText: "Official listing",
    contentHash: "a".repeat(64),
    extractionMethod: "HTML",
  };
  const pdf = {
    ...listing,
    isCorrigendum: false,
    rawText: "Official Junior Engineer recruitment advertisement",
    contentHash: "b".repeat(64),
    extractionMethod: "PDF",
  };
  const merged = mergePdfEnrichment(listing, pdf);
  assert.equal(merged.title, listing.title);
  assert.equal(merged.isCorrigendum, false);
});

test("manual review identity ignores sub-link changes when an official notice ID exists", () => {
  const sourceId = 12;
  const base = {
    title: "Recruitment of Specialist Officers",
    sourceJobId: "CRPD/SCO/2026-27/15",
    notificationLink: "https://sbi.bank.in/notice.pdf",
    sourceUrl: "https://sbi.bank.in/current-openings",
    lastDate: "19.09.2026",
  };
  assert.equal(
    reviewCandidateKey(sourceId, base),
    reviewCandidateKey(sourceId, {
      ...base,
      notificationLink: "https://sbi.bank.in/revised-notice.pdf",
    })
  );
  assert.notEqual(
    reviewCandidateKey(sourceId, base),
    reviewCandidateKey(sourceId + 1, base)
  );
});

test("manual review snapshots become stale when supported notice facts change", () => {
  const base = {
    title: "Recruitment of Junior Research Fellows",
    qualification: "BE or BTech with valid GATE score",
    sourceJobId: "JRF/01/2026",
    sourceUrl: "https://example.gov.in/jobs",
    notificationLink: "https://example.gov.in/jrf.pdf",
    lastDate: "2026-10-10",
    rawText: "Official recruitment notice text",
    contentHash: "a".repeat(64),
    extractionMethod: "PDF",
  };
  assert.equal(reviewSnapshotHash(base), reviewSnapshotHash({ ...base }));
  assert.notEqual(
    reviewSnapshotHash(base),
    reviewSnapshotHash({ ...base, qualification: "ME or MTech" })
  );
});

test("manual draft gate accepts only a current WOULD_ADD preview when explicitly enabled", () => {
  const candidate = {
    title: "Recruitment of Engineers",
    sourceJobId: "ENG/01/2026",
    sourceUrl: "https://example.gov.in/jobs",
    notificationLink: "https://example.gov.in/eng.pdf",
    rawText: "Official recruitment source text",
    contentHash: "b".repeat(64),
    extractionMethod: "PDF",
  };
  const preview = buildPreviewJob(
    candidate,
    { id: 9, name: "Official Engineering Board" },
    0.82,
    "WOULD_ADD",
    "Passed quality gate"
  );
  assert.equal(manualDraftEligibility(preview, false).allowed, false);
  assert.match(manualDraftEligibility(preview, false).reason, /locked/i);
  assert.equal(manualDraftEligibility(preview, true).allowed, true);
  assert.equal(
    manualDraftEligibility({ ...preview, action: "LOW_CONFIDENCE" }, true).allowed,
    false
  );
  assert.equal(
    manualDraftEligibility({ ...preview, action: "WOULD_UPDATE" }, true).allowed,
    false
  );
  assert.equal(preview.sourceId, 9);
  assert.equal(preview.candidateKey.length, 64);
  assert.equal(preview.snapshotHash.length, 64);
});

test("persisted review decisions change only the proposed action", () => {
  const preview = {
    title: "Recruitment of Engineers",
    sourceId: 9,
    sourceName: "Official Engineering Board",
    sourceUrl: "https://example.gov.in/jobs",
    candidateKey: "a".repeat(64),
    snapshotHash: "b".repeat(64),
    confidence: 0.82,
    action: "WOULD_ADD",
    reason: "Passed quality gate",
  };
  const rejected = applyPersistedReviewDecision(preview, { decision: "REJECTED", reason: "duplicate notice" });
  assert.equal(rejected.action, "REJECTED");
  assert.match(rejected.reason, /duplicate notice/);
  assert.equal(rejected.title, preview.title);
  const correction = applyPersistedReviewDecision(preview, { decision: "NEEDS_CORRECTION", reason: "missing official deadline" });
  assert.equal(correction.action, "LOW_CONFIDENCE");
  assert.match(correction.reason, /missing official deadline/);
});
