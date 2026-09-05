# AllJobsIndia

Production-intended Next.js 16 job-information platform with PostgreSQL, Prisma, secured admin CRUD, a reviewed official-source registry and one bounded automation engine.

## Safety model

- Existing jobs are preserved. The new migration is additive and never resets the database.
- Automation defaults to `AUTOMATION_DRY_RUN=true`.
- Bulk writes require both `AUTOMATION_DRY_RUN=false` and `AUTOMATION_ALLOW_WRITE_RUNS=true`; a request body cannot bypass these server gates.
- Manual drafts and persistent review decisions have separate default-off environment locks.
- Discovered and untrusted sources are disabled, untrusted and pending review.
- A candidate can publish automatically only when the global switch is enabled, the source is approved/trusted with `autoPublish=true`, and confidence exceeds the configured threshold.
- Missing vacancies, salary, dates, age, eligibility and fees remain `null`; presentation may show “Not specified”.
- Collection respects robots rules and blocks credentials, local/private IP targets, nonstandard ports, oversized responses and unsafe redirects. It does not solve CAPTCHAs or bypass access controls.

## Local setup

1. Install Node.js 20.9+ and PostgreSQL.
2. Copy `.env.example` to `.env.local` and set the required values. Use a random `ADMIN_SECRET` of at least 32 characters.
3. Back up the existing database and inspect `prisma/migrations/20260825010000_production_automation_foundation/migration.sql`.
4. Apply the additive production migration: `npx prisma migrate deploy`.
5. Run:

```bash
npm install
npx prisma generate
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run start
```

No setup script runs a migration or deletes data automatically.

## Main admin areas

- `/admin/jobs` — create, edit, publish, draft, expire, archive, feature and explicitly delete jobs.
- `/admin/sources` — review, add, edit, enable, trust, test and run sources.
- `/admin/automation` — accurate dry-run/write-run counters, candidate previews and persistent run/error logs.
- `/admin/review` — read-only current-source review with canonical candidate/snapshot identity and locked manual actions.
- `/admin/launch` — read-only launch certification for database, safety gates, source state and content readiness.
- `/admin/backup` — authenticated job JSON export/import. Use `pg_dump` for a complete database backup.

Public `/jobs` search is database-backed and paginated. Public APIs use an explicit safe-field selection so automation hashes, confidence and internal review state are never exposed.

## Automation

The single implementation lives in `lib/automation/`. Supported adapters are generic HTML, government HTML with bounded notice-detail/PDF enrichment, SSC's official public notice-board JSON endpoint, and direct PDF notification. JSON-LD is preferred; deterministic HTML/PDF extraction is the fallback; optional AI only fills source-supported missing fields after Zod validation.

Production cron calls `POST /api/automation/cron` with `Authorization: Bearer <AUTOMATION_CRON_SECRET>`. A database lock prevents overlapping runs. A 6–12 hour schedule is a reasonable starting point; review source terms and server capacity.

`AUTOMATION_MIN_DRAFT_CONFIDENCE` defaults to `0.60`. Candidates below that threshold are reported as `LOW_CONFIDENCE` and are not written even as drafts. The separate high-confidence threshold and all trust gates still control any future publication eligibility.

V8 adds three independent database-write gates. Keep all of them false during parser verification:

```env
AUTOMATION_ALLOW_WRITE_RUNS=false
AUTOMATION_ALLOW_MANUAL_DRAFTS=false
AUTOMATION_ALLOW_REVIEW_DECISIONS=false
```

## V9–V11 consolidated hardening

The final hardening layer is delivered as one package rather than separate
partial installers:

- V9 reliability adds a process-local source-test overlap/rate guard and
  structured failure responses. A transient network failure is reported as a
  source error; it cannot create a fake candidate or write a Job.
- V10 review durability records audit decisions against the exact canonical
  candidate key and source snapshot. A later preview applies the persisted
  decision (`REJECTED` or `LOW_CONFIDENCE`) until the official snapshot changes.
- V11 launch certification exposes `/admin/launch` and
  `/api/admin/launch-readiness`. These are read-only checks; they never run a
  source, apply a migration, change a source, create a Job or enable publishing.

The API now reports `wouldUpdate` explicitly. The legacy `updated` field is
retained only for compatibility and has the same meaning: a matching
persistent Job has supported fields that would genuinely change. Temporary
preview rows are never counted as updates.

The Manual Review Center uses the no-write source-test endpoint. Every notice receives a canonical candidate key plus a snapshot hash. If the source changes between preview and approval, the server rejects the stale action. When manual drafts are deliberately enabled later, the server re-fetches the official notice, re-runs quality and persistent-database dedupe checks, acquires the global automation lock, and can create only an unpublished `DRAFT`. It never updates or publishes an existing Job.

`AUTOMATION_MAX_NOTICE_ENRICHMENTS` and `AUTOMATION_MAX_SSC_API_PAGES` bound V7 detail/PDF enrichment and SSC API pagination. Result, admit-card, answer-key, schedule and corrigendum-only records remain noise unless an existing canonical notice can be safely associated by the normal update engine.

Server-side PDF parsing preloads the `pdfjs-dist` worker before the main parser so Next/Turbopack never resolves it relative to a generated chunk. Official same-domain HTTP detail links are upgraded to HTTPS, and listing-page labels pass field-specific plausibility checks before they can affect confidence.

## Documentation

- [Architecture and source adapters](docs/AUTOMATION.md)
- [Production deployment, SEO and external services](docs/PRODUCTION.md)
- [Database migration, backup and restore](docs/DATABASE.md)
- [Launch operations, scheduling, backups and alert verification](docs/LAUNCH-OPERATIONS.md)

## Intentionally not automated

CAPTCHA/authentication bypass, protected/private data collection, OCR of scanned PDFs, blind internet-wide scraping, source trust approval, provider-less alert delivery, AdSense activation and deployment are deliberately excluded.
