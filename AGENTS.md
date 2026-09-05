<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AllJobsIndia repository rules

- Keep one automation engine under `lib/automation/`; do not introduce a second collector/orchestrator.
- Never reset, force-push, truncate or bulk-delete the database. Migrations must preserve existing jobs and be reviewed before deployment.
- Missing recruitment facts remain nullable. Do not invent dates, vacancies, salary, qualifications, fees, age or locations.
- New/discovered sources default to untrusted, disabled and pending review. Auto-publishing requires every trust/confidence/environment gate.
- Do not bypass robots rules, CAPTCHAs, authentication, rate limits or access controls. Use the bounded safe fetch helpers.
- Secure every admin/data-changing API at the handler in addition to optimistic proxy checks.
