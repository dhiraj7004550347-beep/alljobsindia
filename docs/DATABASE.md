# Database migration, backup and restore

The `20260825010000_production_automation_foundation` migration preserves all existing `Job` rows. It relaxes automation-unknown fields to nullable, adds job provenance/review/expiry columns, backfills first/last-seen and published/expiry dates, creates registry/run/lock/alert/rate-limit tables, and adds indexes/foreign keys. It contains no `DROP`, `TRUNCATE` or `DELETE` statement.

## Safe production procedure

1. Put automation in dry-run mode and stop scheduled writes.
2. Create and verify a full PostgreSQL backup, for example `pg_dump --format=custom --file=alljobsindia-before-migration.dump "$DATABASE_URL"` from an appropriately secured operator machine.
3. Inspect the SQL migration and test it on a staging copy.
4. Run `npx prisma migrate deploy` in the application release environment.
5. Run `npx prisma generate`, deploy, and perform the smoke-test checklist.
6. Resume cron in dry-run mode first.

The Admin Backup screen exports/imports job rows only. It is authenticated, size/rate limited and useful for portability, but it is not a substitute for a full database backup containing sources, automation logs and alerts.

Restore a full `pg_dump` only into an explicitly selected empty/recovery database using PostgreSQL tooling and a rehearsed runbook. Never restore over production from a public API. This repository intentionally does not automate destructive restore or database deletion.
