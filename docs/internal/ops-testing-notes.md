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
- `npm run test:playwright:smoke` (gating run; admin route coverage enforced with owner bootstrap fallback)
- Local health check: `curl -fsS http://localhost:5000/api/health` (fails on HTTP 4xx/5xx)
- Deployed health check: `curl -fsS https://<service-url>/api/health` (fails on HTTP 4xx/5xx)

See also: `docs/internal/phase5-reliability-hardening.md`.

## Phase 6 QA Commands

- `npm run test:playwright:smoke` (admin route coverage enforced by default; owner bootstrap fallback enabled)
- `PLAYWRIGHT_REQUIRE_ADMIN_ROUTES=0 npm run test:playwright:smoke` (local non-gating opt-out)
- Manual visual snapshots for required routes at desktop/tablet/mobile (see `docs/internal/phase6-qa-gates.md`)

## Phase 7 Security/Observability Commands

- `npm run test:phase7:regressions`
- Local header check: `curl -i http://localhost:5000/api/health`
- Admin observability summary: `GET /api/admin/ops/runtime-observability` (authenticated admin session)
- See `docs/internal/phase7-security-observability.md` for gate criteria and rollback controls.

## Phase 8 Release Closeout Commands

- `npm run check`
- `npm run build`
- `npm run test:playwright:smoke`
- `npm run test:phase7:regressions`
- Update `docs/internal/phase8-release-closeout.md` with final status and defer tracking.
