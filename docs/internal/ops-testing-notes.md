# Internal Ops and Regression Notes

This page contains internal-only script and maintenance references extracted from `scripts/README.md`.

## Core Regression Runs

- `npm run test:all`
- `npm run test:journey`
- `npm run test:tier:matrix`
- `npm run test:widget:regressions`
- `npm run test:phase1`
- `npm run test:phase2`
- `npm run test:phase3`
- `npm run test:phase4`

## Performance Utilities

- `npm run db:indexes:perf`
- `npm run perf:smoke`

## Dev Server Utilities

- `npm run dev:bg`
- `npm run dev:status`
- `npm run dev:stop`

## Notes

- `test:*` scripts use `.env` automatically with `tsx --env-file=.env`.
- Auth rate-limit bypass header is available in non-production when `AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN` is set.
- Use production mode (`npm run start:prod`) for realistic performance checks.

## Phase 5 Reliability Checks

- `npm run check`
- `npm run build`
- `npm run test:playwright:smoke` (optional when env + credentials are available)
- Local health check: `curl -fsS http://localhost:5000/api/health` (fails on HTTP 4xx/5xx)
- Deployed health check: `curl -fsS https://<service-url>/api/health` (fails on HTTP 4xx/5xx)

Execution notes:
- This file is the executable command companion to release policy gates.

See also: `docs/internal/phase5-reliability-hardening.md`.

## Phase 6 QA Commands

- `npm run test:playwright:smoke`
- Manual visual snapshots for required routes at desktop/tablet/mobile (see `docs/internal/phase6-qa-gates.md`)
