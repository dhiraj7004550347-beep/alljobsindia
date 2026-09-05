# Consolidated V9–V11 release

This is the final pre-launch hardening sequence. It is intentionally shipped
as one code package so the operator does not install three partially
overlapping versions.

## V9 — reliability

- Source-test requests are process-locally serialized per source and capped at
  eight tests per minute.
- Unexpected source-test failures return a safe structured error instead of a
  stack trace or fabricated candidate.
- The Windows retest waits for a cold-start local health endpoint before
  testing sources.

## V10 — review durability

- Manual decisions are stored in the existing `AutomationRunItem` audit stream
  with `candidateKey` and `snapshotHash`.
- The next inspection overlays an exact `REJECTED` or `LOW_CONFIDENCE` action.
- A changed official notice has a new snapshot and must be reviewed again.
- A manual draft is still a separate, explicit, unpublished `DRAFT` path and
  remains locked by default.

## V11 — launch certification

- `/admin/launch` and `/api/admin/launch-readiness` perform read-only checks for
  database health, URL/secrets, safety gates, consistent source state, content
  and the latest run. A deliberately approved/trusted source is allowed when
  its own auto-publish flag is off.
- `wouldUpdate` is the explicit metric for a real persistent Job change;
  temporary preview candidates cannot become updates.
- The final PowerShell retest verifies all three source adapters, identity
  hashes, public API privacy and before/after database snapshots.

## What still requires an operator

The code cannot safely invent these production facts:

1. A verified PostgreSQL backup and staging migration deployment.
2. Final HTTPS URL, admin/automation secrets and monitoring owner.
3. Manual review of source previews and creation of approved content.
4. A scheduler that calls `/api/automation/cron` with a secret, initially in
   dry-run mode.
5. Legal/contact text, Search Console, email-alert provider and ad/analytics
   approval if those services are desired.

The release never performs these steps automatically and never enables
auto-publish.
