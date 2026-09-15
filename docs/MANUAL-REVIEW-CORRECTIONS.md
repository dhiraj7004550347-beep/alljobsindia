# Manual Review Correction Workspace

Review workspace release: V12-REVIEW-20260915-01

Open `/admin/review`, select an official source and load the read-only review.
Use **Edit Fields** to correct supported facts from the official notification.
**Save Correction** stores a review audit record and rechecks the current source.
A failed save keeps the editor and entered values open. Accepted, cleaned values
are shown after a successful save.

Saved corrections are restored only for the same source identity and snapshot.
After reloading, open the editor and save once more before creating a draft.
A changed official notice requires a fresh review. Rejected snapshots cannot be
converted into drafts through this workflow.

**Approve as Draft** requires explicit confirmation and creates an unpublished
DRAFT. It reruns validation and deduplication, and records the corrections used.
Use the resulting Manage Job link for any later editorial review or publishing.

## Existing capability switches

- `AUTOMATION_ALLOW_REVIEW_DECISIONS=true` enables saved corrections and decisions.
- `AUTOMATION_ALLOW_MANUAL_DRAFTS=true` enables explicit single-draft creation.
- Read-only review remains available when both are disabled.
- Keep `AUTOMATION_DRY_RUN=true`, `AUTOMATION_ALLOW_WRITE_RUNS=false`, and
  `AUTOMATION_ALLOW_AUTO_PUBLISH=false` for the current manual workflow.

This release does not change environment variables, source trust, database schema,
cron schedules, or public job publication. A code deployment alone does not enable
locked actions. Capability changes must be made deliberately in the environment
where the application runs.

## Verification

The test suite includes invalid dates/URLs, stale snapshots, authentication,
origin/capability checks, repeat draft requests, and failed correction saves.
API/service tests use isolated fixtures; they never contact the production database.
The production build can use temporary local-only environment values. Those values
must not be saved in production environment settings.
