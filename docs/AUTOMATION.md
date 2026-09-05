# Automation architecture

`lib/automation/engine.ts` is the only orchestration entry point. It creates a persistent run, acquires the global database lock, loads enabled registry sources, runs a bounded collector pool, validates/deduplicates candidates, records actions, expires stale published jobs and releases the lock.

## Modules

- `config.ts` — safe defaults, limits and feature gates.
- `types.ts` — adapter and candidate contracts.
- `http.ts` — public HTTP/HTTPS validation, DNS/private-address rejection, redirects, robots, timeouts and response limits.
- `collector.ts` and `adapters/` — adapter selection and per-source isolation.
- `adapters/ssc-notice-board.ts` — bounded reads from SSC's official public notice-board API; result/schedule noise is rejected before PDF enrichment.
- `adapters/notice-enrichment.ts` — merges a detail page and its official notification PDF into the same canonical notice.
- `pdf-parser.ts` — bounded text-layer extraction. Scanned PDFs are not OCRed automatically.
- `pdf-fields.ts` — deterministic, source-supported vacancy, qualification, age, pay, selection, application and date extraction; a generic website URL is never treated as an apply URL.
- `ai-extractor.ts` — optional Zod-validated extraction; every returned value must be supported by source text.
- `validator.ts` — confidence and publication eligibility.
- `quality.ts` — rejects non-recruitment/expired items and keeps candidates below the configured draft threshold in `LOW_CONFIDENCE`.
- `dedupe.ts` — source ID, official apply URL, notification URL, fingerprint, composite and corrigendum matching.
- `source-discovery.ts` — same-domain career/recruitment link discovery; candidates are pending, disabled and untrusted.
- `logger.ts`, `expiry.ts` — PostgreSQL run history and non-destructive expiry.
- `review.ts` — canonical review identity, source-snapshot hashes and preview-boundary sanitation.
- `manual-review.ts` — server-side revalidation, idempotent draft-only creation and review audit actions behind default-off locks.

## Adding an adapter

1. Implement `SourceAdapter` in `lib/automation/adapters/` with `canHandle()` and `collect()`.
2. Use `fetchHtml`/`fetchPdf`; do not call arbitrary URLs directly.
3. Return only source-supported values and always include `sourceUrl`, `rawText`, `contentHash` and `extractionMethod`.
4. Register it in the ordered adapter list in `collector.ts`.
5. Add deterministic fixtures/tests, then use Admin → Sources → Test before any write run.

## Source review workflow

Add only official public pages. Test untrusted sources first. Confirm the domain, visible recruitment notices, official application path, robots policy and parser output. Approval and trust are separate from enablement. Keep `autoPublish` off until repeated dry runs are accurate. The global `AUTOMATION_ALLOW_AUTO_PUBLISH` switch should remain false through launch review.

One source failure is logged and isolated. Detail/PDF sub-fetches and SSC API pages are bounded. Run/job/source limits prevent uncontrolled crawling and AI payloads are capped.

The `pdfjs-dist` worker module is loaded before the main parser, preventing its Node fake-worker fallback from resolving `pdf.worker.mjs` relative to `.next/server/chunks`. Official same-domain detail URLs prefer HTTPS. HTML listing labels are word-bounded and field-validated so page navigation, dates and escaped markup cannot masquerade as vacancies, age, pay or other recruitment facts.

The default draft-quality threshold is 60%. Passing that gate means only that a notice may be proposed for a review-required draft; it does not make the notice trusted or eligible for auto-publication.

## V9–V11 release gates

V9 adds a write-free process-local guard to the source-test route. One source
cannot be tested concurrently and more than eight tests per minute are
accepted for that source. This avoids accidental refresh loops without adding
database rows to a read-only test.

V10 stores manual review decisions in the existing automation audit stream.
The decision is keyed by the canonical candidate key and exact source snapshot
hash. A later source test overlays `REJECTED` or `LOW_CONFIDENCE` on that same
snapshot; a changed official snapshot is eligible for a fresh review.

V11 adds a read-only launch checklist at `/admin/launch`. It checks database
reachability, public URL and admin-secret configuration, all automation locks,
source safety state, published content and the latest run status. It does not
run source collection and does not mutate PostgreSQL.

`wouldUpdate` is the explicit preview metric. It is incremented only when a
candidate matches a persistent Job and at least one supported field differs.
The old `updated` response property remains as a compatibility alias.

## V8 manual review and write locks

`/admin/review` calls the source-test endpoint, which reads sources and existing Jobs but creates no Job, source-health row or automation-run row. Candidate keys prefer source notice IDs, then canonical notification URLs, then detail/title/date identity. A separate snapshot hash detects any source-supported field change.

Bulk write runs require `AUTOMATION_DRY_RUN=false` and `AUTOMATION_ALLOW_WRITE_RUNS=true`. Manual draft creation requires `AUTOMATION_ALLOW_MANUAL_DRAFTS=true`; review decision audit writes require `AUTOMATION_ALLOW_REVIEW_DECISIONS=true`. These switches are independent and default to false. The manual draft endpoint re-collects and revalidates the current official notice, rejects stale snapshots, low-confidence/expired/rejected items and persistent matches, and forces the created record to `DRAFT` with `featured=false` and `publishedAt=null`.
