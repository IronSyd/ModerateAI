# Utility Scripts

This project keeps a small set of ad-hoc maintenance/testing scripts in TypeScript.

## Running Scripts

Run scripts with `tsx` from the repository root:

```bash
npx tsx <script-file.ts>
```

Examples:

```bash
npx tsx add-knowledge-document.ts
npx tsx list-kb-docs.ts
npx tsx test-kb-search.ts
```

Regression npm scripts (`test:*`) are configured to load `.env` automatically via `tsx --env-file=.env`.

If `AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN` is set, regression scripts automatically send
`x-auth-rate-limit-test-bypass` so auth stress from repeated `/api/login` calls does not create false failures.
The bypass is honored only outside production.

Run the full local regression chain (same order as CI) with:

```bash
npm run test:all
```

## Performance Helpers

- `npm run db:indexes:perf`  
  Applies `migrations/20260220_performance_indexes.sql` using `CREATE INDEX CONCURRENTLY` (no transaction) and runs `EXPLAIN ANALYZE` checks for dashboard/widget-heavy queries.
- `npm run perf:smoke`  
  Runs quick `autocannon` scenarios for `/` and `/auth`, and (optionally) `/api/dashboard/overview` when `PERF_EMAIL` + `PERF_PASSWORD` are provided.

Optional perf env vars:
- `PERF_BASE_URL` (default `http://127.0.0.1:5000`)
- `PERF_CONNECTIONS` (default `30`)
- `PERF_DURATION_SECONDS` (default `12`)
- `PERF_DASHBOARD_P95_BUDGET_MS` (default `300`)
- `PERF_FAIL_ON_THRESHOLD` (`1/true` to fail run when dashboard p95 exceeds budget)

## Dev Server Controls

These npm scripts keep the dev server detached from your terminal on Windows:

- `npm run dev:bg`  
  Start the dev server in background and save PID to `.dev-server.pid`.
- `npm run dev:status`  
  Show if process is running and report `/api/health` status.
- `npm run dev:stop`  
  Stop the background dev server and clean up pid file.

## Available Scripts

### Data and Knowledge Base
- `add-knowledge-document.ts`  
  Seed example knowledge documents.
- `list-kb-docs.ts`  
  Print knowledge bases and document summaries.

### Discord Repair
- `discord-fix.ts`  
  Manual Discord integration fix workflow against DB and bot config.

### Search and Relevance Checks
- `test-kb-search.ts`  
  Quick search smoke checks for knowledge retrieval.
- `test-knowledge.ts`  
  General query checks and preview output.
- `test-pricing-knowledge.ts`  
  Pricing-focused retrieval checks.
- `test-proactive-responses.ts`  
  Proactive response behavior checks.
- `test-relevance-simple.ts`  
  Minimal relevance function test set.

### Widget Regression Checks
- `test-widget-regressions.ts`  
  API regression checks for widget domain limits, daily AI quota enforcement, and rate-limit `429` responses.
- `test-tier-matrix.ts`  
  End-to-end matrix checks for `free`, `standard`, and `pro` entitlements (usage payload limits, knowledge-base MB entitlements, domain overflow enforcement, and daily quota lockout behavior), plus a concrete free-plan knowledge-base storage overflow check.
  Optional heavy stress mode (disabled by default) can simulate Standard/Pro knowledge-base overflow via env vars:
  `TIER_MATRIX_STRESS_KB_OVERFLOW=1`, `TIER_MATRIX_STRESS_KB_PLANS=standard,pro`, `TIER_MATRIX_STRESS_KB_HEADROOM_BYTES=4096`, `TIER_MATRIX_STRESS_KB_OVERFLOW_DOC_BYTES=8192`.
- `test-journey.ts`  
  End-to-end auth/onboarding journey checks (`signup -> login -> free plan selection -> dashboard API load`) plus owner-bypass validation (uses real owner credentials when provided, otherwise runs with a synthetic owner account).
- `test-phase1-regressions.ts`  
  Regression checks for Phase 1 tiered feature controls: conversation history retention windows (`free 7d`, `standard 90d`, `pro 365d`), moderation preset enforcement by plan, and Pro-only endpoint access (`/api/audit-log`, `/api/export/messages`).
- `test-phase2-regressions.ts`  
  Regression checks for Phase 2 persisted audit behavior: workspace settings updates and message exports are written to `audit_events` and retrievable via `/api/audit-log` action filters.
- `test-phase3-regressions.ts`  
  Regression checks for Phase 3 feature behavior: analytics tier enforcement by plan (`free` blocked, `standard` analytics, `pro` deep analytics) and advanced moderation automation policy helper behavior.
- `test-phase4-regressions.ts`  
  Regression checks for Phase 4 moderation event persistence: `moderation_actions` API filtering, deep-analytics Pro gating/aggregation, and analytics moderation counts sourced from the dedicated table.
- `test-phase7-regressions.ts`  
  Regression checks for Phase 7 runtime hardening: security headers on `/api/health`, `x-request-id` propagation, and admin ops summary availability via `/api/admin/ops/runtime-observability`.

## Notes
- These scripts are manual tools, not part of normal app runtime or CI.
- Most scripts require valid environment variables (for example `DATABASE_URL`, `OPENAI_API_KEY`) in your shell.
