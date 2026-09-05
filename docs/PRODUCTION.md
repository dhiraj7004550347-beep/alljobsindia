# Production guide

## Deployment

Set every required `.env.example` value in the hosting secret manager. `NEXT_PUBLIC_SITE_URL` must be the final absolute public URL and may not be localhost in production. Use HTTPS, a managed PostgreSQL database, a strong unique admin password and separate long random admin/automation/cron secrets.

After a verified backup, run `npx prisma migrate deploy` once per release, then `npm run build`. Do not use `prisma migrate reset`, destructive `db push`, or force-reset commands.

Configure a scheduler to send authenticated `POST` requests to `/api/automation/cron`. Start with dry-run every 6–12 hours. Inspect Automation Control Center logs and per-source health before enabling writes.

Keep `AUTOMATION_ALLOW_WRITE_RUNS`, `AUTOMATION_ALLOW_MANUAL_DRAFTS`, `AUTOMATION_ALLOW_REVIEW_DECISIONS` and `AUTOMATION_ALLOW_AUTO_PUBLISH` false through source validation. Enabling a manual draft does not enable scheduled writes or publishing. Enabling scheduled writes additionally requires `AUTOMATION_DRY_RUN=false`.

`GET /api/health` performs a real read against the migrated `Job` table and returns HTTP 503 when the database is unreachable. Use it for a low-frequency uptime check; it intentionally returns no credentials, counts or database error details.

## Search and JobPosting

Submit `/sitemap.xml` in Google Search Console and verify `robots.txt`. Only active published jobs appear in the sitemap. A job page emits `JobPosting` JSON-LD only when the visible record contains a complete real description, organisation, location, posting date and official application path. Test representative pages with Google Rich Results Test and URL Inspection.

For the optional Indexing API: enable the API in a Google Cloud project, create a service account, add that account as a verified Search Console owner, request appropriate quota, and configure `GOOGLE_INDEXING_CLIENT_EMAIL` and `GOOGLE_INDEXING_PRIVATE_KEY`. The app then sends `URL_UPDATED` for published additions/updates and `URL_DELETED` for expiry/removal. Sitemap coverage remains enabled. Never use fake credentials or multiple accounts to evade quota.

## AdSense and analytics

No provider ID is bundled. After approval, set a valid `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and numeric slot ID. `AdSlot` reserves space and stays absent when unconfigured. Keep ads away from apply controls and verify cumulative layout shift. Optional Google Analytics loads only with a valid `G-…` ID. Update the privacy page for any additional providers or consent obligations that apply to your audience.

## Job alerts

Alert preferences are stored in PostgreSQL as pending/unverified subscriptions. The app exposes token-based verification at `/api/job-alerts/verify` and disabling at `/api/job-alerts/unsubscribe`. Set `ALERT_EMAIL_WEBHOOK_URL` to an HTTPS provider endpoint and `ALERT_EMAIL_FROM` only after approving the provider and privacy/retention terms. If the provider is absent or rejects the request, the address remains unverified and no alert is delivered. The webhook must process bounces; matching/delivery of job notifications still needs a durable sent-event strategy.

## Launch checklist

- Database backup verified and additive migration inspected/applied.
- TypeScript, lint, tests, build and `npm audit` reviewed.
- Admin/login/CRUD/import/export tested against the migrated staging database.
- Sources individually tested; discovered sources reviewed; auto-publish still off.
- Manual Review Center source tests leave Job, source and automation-run snapshots unchanged; all write locks are visibly OFF/LOCKED.
- SSC API, DRDO detail/PDF and SBI advertisement enrichment retested with persistent Job/source/run snapshots unchanged.
- No `pdf.worker.mjs` warning, DRDO detail `fetch failed`, or markup/navigation text in structured preview fields.
- Cron secret/schedule configured and overlapping-run protection observed.
- Production URL, HTTPS, legal/contact pages, Search Console and sitemap verified.
- Representative JobPosting pages pass Rich Results Test; expired jobs return 404 and leave the sitemap.
- AdSense/analytics remain off unless approved and configured.
- Monitoring, database backups and rollback procedure documented by the operator.
