# ModerateAI Release Gates (Live on Render)

## Severity Model
1. P0: auth bypass, workspace isolation failure, data corruption, deploy/startup crash.
2. P1: critical workflow broken (core support/moderation/KB/integrations/ops).
3. P2: non-critical workflow defect with workaround.
4. P3: cosmetic/documentation-only issue.

## PR Definition of Done
1. Plan linked (decision-complete and scoped).
2. Scope and non-scope explicitly stated.
3. Tests added/updated for changed surfaces.
4. `npm run check` and `npm run build` pass.
5. Docs updated (`docs/internal` and user-facing docs when behavior changes).
6. Rollout and rollback notes included.
7. Risk items listed (if any) with owner and review date.

## Release Entry Gate
1. No open P0/P1 defects.
2. Runtime flags reviewed for target environment.
3. Render env vars verified (required vs optional).
4. Migration/schema steps validated for current release.
5. Smoke test matrix completed on release candidate.

## Release Exit Gate
1. Deploy healthy (`curl -fsS https://<service-url>/api/health` returns 200).
2. Core workflows verified post-deploy.
3. Scheduler startup logs reviewed for duplicate/loop behavior.
4. Monitoring and alerts verified.
5. Rollback command path validated and documented.
6. Use `docs/internal/ops-testing-notes.md` for executable smoke command checklists.

## Rollback Triggers
1. Repeated startup crashes or failed health checks.
2. Auth/session failure preventing normal admin login.
3. P0 data integrity or workspace isolation incident.
4. High-volume runtime exceptions after release.

## Rollback Actions
1. Set `UI_V2_ENABLED=0` immediately for UI regressions.
2. Re-deploy last known stable image/commit.
3. Validate health endpoint with `curl -fsS https://<service-url>/api/health` and verify admin login.
4. Re-run focused smoke checks.
5. Publish incident note and follow-up RCA task.

## Phase 5 Reliability Reference
- Use `docs/internal/phase5-reliability-hardening.md` as the source of truth for preflight validation, Render deploy/rollback sequence, dependency risk acceptance, and UI canary controls.

## Policy boundary
- This file defines release decision gates (entry/exit/rollback criteria).
- `docs/internal/ops-testing-notes.md` defines executable command snippets used to satisfy these gates.

## Phase 6 QA Gates Reference
- Use `docs/internal/phase6-qa-gates.md` as the source of truth for Playwright smoke coverage and visual regression evidence requirements before broad rollout.
