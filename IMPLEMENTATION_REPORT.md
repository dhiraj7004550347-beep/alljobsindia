# AllJobsIndia production implementation report

Date: 24 August 2026

## A. Architecture changes

The repository now has one automation architecture under `lib/automation/`. It uses a PostgreSQL source registry and run history, bounded adapter collection, safe public fetching, deterministic HTML/JSON-LD/PDF parsing, optional schema-validated AI, confidence gates, multi-stage dedupe/corrigendum updates, source-content caching, expiry, overlap locking and persistent run items. Legacy file/env-list automation storage was retired.

## B. Files added

- Source/config: `.env.example`, `IMPLEMENTATION_REPORT.md`, `docs/{AUTOMATION,DATABASE,PRODUCTION}.md`.
- Automation: `lib/automation/config.ts`, `normalizer.ts`, `http.ts`, `validator.ts`, `logger.ts`, `expiry.ts`, `source-registry.ts`, `source-discovery.ts`, `pdf-parser.ts`, `ai-extractor.ts`, and `adapters/{generic-html,government-html,html-parser,pdf-notification}.ts`.
- Platform services: `lib/google-indexing.ts`, `lib/public-job.ts`, `lib/rate-limit.ts`.
- Admin/source APIs and UI: `app/admin/sources/page.tsx`, `app/api/admin/sources/**`.
- Alerts: `app/api/job-alerts/route.ts`.
- SEO/content: `app/{about,contact,privacy-policy,terms,disclaimer}/page.tsx`, `components/{AdSlot,LegalPage,OptionalScripts,PublicFooter,ResourcePlaceholder}.tsx`.
- Database: `prisma/migrations/20260825010000_production_automation_foundation/migration.sql`.
- Tests: `tests/automation.test.mjs`, `tests/register-loader.mjs`, `tests/ts-loader.mjs`.

## C. Files modified

- Prisma/package/config: `prisma/schema.prisma`, `package.json`, `package-lock.json`, `next.config.ts`, `proxy.ts`, `.gitignore`, `AGENTS.md`, `WINDOWS_SETUP_AND_VERIFY.ps1`, `README.md`.
- Core/admin: `actions/jobs.ts`, admin dashboard/layout/jobs/automation pages, `components/{DeleteJobButton,JobForm,JobStatusBadge,PublicJobSearch}.tsx`.
- APIs: admin login/logout; automation cron/logs/match/preferences/preview/run/status; jobs list/detail/import/export-csv/featured/stats; health.
- Public UI/SEO: root layout/home, jobs/list/detail, government/private listings, robots, sitemap, globals, alerts and neutral results/admit-card/answer-key/syllabus/admission pages.
- Existing automation core: `collector.ts`, `dedupe.ts`, `engine.ts`, `types.ts`, `auth.ts`.
- Job helpers: `lib/{admin-auth,job-input,job-seo,seo,site-config}.ts`.

## D. Files removed

- Competing/legacy automation: `lib/automation-config.ts`, `lib/automation/ai-processor.ts`, `lib/automation/log-store.ts`.
- Unused UI/types/sample content: `components/JobSearch.tsx`, `types/job.ts`, `app/components/ResourceDirectory.tsx`, default Next SVG assets.
- Superseded repair artifacts: `.env.production.example`, `CLEANUP_OLD_ALLJOBSINDIA.ps1`, `FINAL_MASTER_README.md`, `MASTER_CHANGELOG.md`, `VERIFICATION_REPORT.md`.

## E–F. Prisma schema and migration

Added job provenance, canonical URL, source ID/hash, first/last seen, source update, confidence, review, run, posted/published/expiry and richer content fields. Unknown extracted fields are nullable and the database default is now DRAFT. Added `JobSource`, `AutomationRun`, `AutomationRunItem`, `AutomationLock`, `JobAlertSubscription` and `RateLimitBucket`, supporting enums, relations and indexes.

Migration `20260825010000_production_automation_foundation` is additive: it relaxes NOT NULL constraints, adds columns/types/tables/indexes/foreign keys, changes the future status default to DRAFT and backfills existing rows. It has no table/column drop, truncate, row delete or reset. It was inspected and validated but not applied because no database credentials were supplied.

## G. Supported source types

Government, PSU, banking, railway, university, hospital, private company and other official sources. Parsers: generic HTML, government HTML plus bounded public PDFs, and direct PDF notification. JSON-LD is preferred. Scanned-PDF OCR is deliberately not automatic.

## H. Security fixes

JWT issuer/audience/algorithm validation, strict HttpOnly admin cookie, timing-safe secret comparisons, handler-level authorization, same-origin mutation checks, database rate limiting, protected imports/exports/source/automation routes, input/URL/file-size limits, CSV formula neutralisation, safe public API field selection, SSRF/private-IP/redirect/robots/timeout/size controls, overlap locking and standard security headers. No secrets are returned by public routes.

## I. SEO fixes

Validated production site URL, canonical metadata, Open Graph/Twitter metadata, active published-only sitemap, admin/API robots exclusion, complete-field-only JobPosting JSON-LD, expired-job 404/removal handling, real visible source/updated content, optional Google Indexing API notifications, legal/disclaimer pages and removal of fabricated static update listings.

## J–L. Verification and audit

- `npm install`: passed.
- `prisma generate` and `prisma validate`: passed.
- `tsc --noEmit`: passed.
- ESLint: passed with zero findings.
- Automation tests: 6/6 passed (normalization, no invented dates, alerts, source-ID/notification dedupe, corrigendum matching).
- `next build`: passed; all routes compiled and 35 static entries were generated.
- HTTP smoke: public/static/legal/login/health/robots 200; unauthenticated admin 307; protected status/export/sources/cron/job-write 401.
- Database-backed CRUD, source collection, expiry and log smoke require a migrated PostgreSQL staging database and were not executed against the dummy unreachable URL used only for compilation.
- `npm audit`: improved from 4 to 3 high findings by pinning patched `nanoid@3.3.18`. The remaining three entries are one Prisma 7.9.1 CLI chain (`prisma` → `@prisma/config` → `deepmerge-ts@7.1.5`, GHSA-ggr8-5vv4-36mx). Prisma is a dev dependency/dev-optional package. npm's offered fix is an incompatible downgrade to Prisma 6.12.0, so it was not applied and no force fix was run.

## M. Environment variables

Required: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SECRET`.

Automation: `AUTOMATION_SECRET`, `AUTOMATION_CRON_SECRET`, `AUTOMATION_DRY_RUN`, `AUTOMATION_ALLOW_AUTO_PUBLISH`, source/job/concurrency/timeout/HTML/PDF/high-confidence/lock limits documented in `.env.example`.

Optional: `OPENAI_API_KEY`, `OPENAI_MODEL`, Google Indexing service-account email/private key, contact email, Analytics ID, AdSense client and job slot.

## N. Manual steps required

1. Back up the actual PostgreSQL database and inspect the migration.
2. Configure real environment secrets and the final HTTPS site URL.
3. Apply `npx prisma migrate deploy` to staging, then production after staging smoke tests.
4. Test login, complete CRUD/import/export, active/draft/expired visibility, sources, dry run, logs, dedupe, sitemap and representative JobPosting pages against the migrated staging database.
5. Add and review a small set of official sources; keep auto-publish globally off.
6. Configure a secret-protected 6–12 hour cron in dry-run mode.
7. Verify Search Console, sitemap, Rich Results and optional Indexing API ownership/quota.
8. Configure support contact, monitoring, backups and restore rehearsal. Enable analytics/AdSense only after policy review/approval.

## O. Intentionally not automated

No blind internet-wide scraping, CAPTCHA/login/access-control bypass, IP evasion, private data, automatic trust approval, automatic scanned-PDF OCR, fake fields/credentials, provider-less alert delivery, AdSense approval/activation, paid deployment, destructive database restore or public auto-publish enablement.

## P. Production launch checklist

- Backup verified; migration reviewed and staged.
- Required secrets and final site URL configured.
- Staging CRUD/automation/source/expiry/SEO smoke tests pass with real PostgreSQL.
- Sources reviewed individually; dry-run output accepted; auto-publish remains off through launch.
- Cron/auth/overlap/error logging tested.
- Legal/contact/privacy content and external-provider consent obligations reviewed.
- Sitemap/Search Console/Rich Results/expired removal validated.
- Runtime monitoring, database backup retention and rollback owner assigned.
- Remaining Prisma CLI advisory monitored for an upstream compatible patch.
