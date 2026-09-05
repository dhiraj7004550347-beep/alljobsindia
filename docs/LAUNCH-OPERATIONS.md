# AllJobsIndia launch operations

This document is the single operator runbook for the automated, review-first
launch. It keeps collection automated while preventing unreviewed or unsafe
records from becoming public.

## Safe automation now

1. Keep `AUTOMATION_DRY_RUN=true` and all four write/publish switches false.
2. Run `scripts/Validate-AllJobsIndia-Production-Env.ps1` before each release.
3. Start the app, then run `scripts/AllJobsIndia-Automation-DryRun.ps1`.
   The runner auto-detects healthy localhost ports 3000 and 3001 and never
   prints the cron secret.
4. Inspect `/admin/automation`, `/admin/review` and `/admin/launch`.
   Source-test runs are read-only; dry-run cron may create only its audit row.
5. Schedule the runner with
   `scripts/Register-AllJobsIndia-DryRun-Task.ps1`. It previews by default and
   requires `-ConfirmRegistration` for the Windows Task Scheduler change.

For a hosted deployment, the included `vercel.json` schedules the authenticated
automation endpoint every 12 hours. Add the same random value to both
`AUTOMATION_CRON_SECRET` and `CRON_SECRET` in the Vercel project settings;
Vercel Cron supplies the standard bearer token and the route accepts it without
weakening the local scheduler path. Vercel documents cron schedules and the
`CRON_SECRET` header contract in its official guide.

## Backups and release gate

Run `scripts/Backup-AllJobsIndia-Database.ps1` before `npx prisma migrate deploy`.
The script uses `PGPASSWORD` instead of putting a database password in the
`pg_dump` command line, creates a timestamped custom-format dump and never
deletes or changes database rows. Test a restore into a separate database.

The only safe production release order is:

1. Verify backup and restore rehearsal.
2. Apply the additive Prisma migration with `npx prisma migrate deploy`.
3. Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
4. Run the read-only V11 retest against the migrated staging database.
5. Verify HTTPS, admin login, health, sitemap and representative JobPosting
   pages.
6. Keep sources `PENDING`, `Disabled`, `Untrusted` until each source is
   reviewed. Enable one source at a time only after an operator decision.

## Automated email verification

`POST /api/job-alerts` now rotates hashed verification and unsubscribe tokens
for every subscription. `GET /api/job-alerts/verify` verifies the address and
`GET /api/job-alerts/unsubscribe` disables delivery. The app remains provider-
neutral: set `ALERT_EMAIL_WEBHOOK_URL` to an HTTPS provider endpoint and
`ALERT_EMAIL_FROM` to the approved sender. The webhook receives one JSON
`job_alert_verification` event containing the recipient and links; it must send
the message and handle bounces. If the webhook is missing or fails, the
subscription stays pending and no alert is delivered.

Matching and delivery of job-alert notifications still require a provider,
privacy/retention terms and a durable sent-event strategy. No automatic email,
WhatsApp or Telegram is enabled by this code-only release.

## Content and SEO boundary

The jobs workflow is launch-ready for reviewed official recruitment notices.
Results, admit cards, answer keys, admissions and syllabus pages remain honest
placeholders, are marked `noindex` and are excluded from the sitemap until
dedicated source adapters and schemas exist. This prevents empty pages from
being indexed or mistaken for live coverage.

## Incident response

- A source 404/503, timeout or parser quality failure stops that source only;
  it cannot publish a candidate.
- A health failure is a release blocker. Restarting the app may recover a
  transient local process, but investigate database/network logs before retry.
- Never use `prisma migrate reset`, destructive `db push`, force-push, bulk
  delete or a secret printed into a command line.
- If an unsafe candidate appears, leave the source disabled, capture the
  candidate/snapshot identity and reject it in the review ledger after the
  source is deliberately unlocked in a controlled environment.
