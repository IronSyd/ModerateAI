# Phase 6: Expanded QA Gates (Smoke + Visual Regression)

This playbook operationalizes the post-Phase-5 quality expansion.

## Objective
1. Increase confidence for production releases by adding repeatable browser-level smoke checks.
2. Add visual regression evidence for high-impact UI routes and breakpoints.
3. Establish explicit pass/fail gates before canary expansion and broad rollout.

## Scope
- Core smoke coverage for critical operator workflows.
- Admin-surface smoke coverage for high-risk operational actions.
- Visual snapshot evidence for Wave 1 and adjacent shared-shell routes.

Out of scope for this phase:
- Full end-to-end matrix across every role/plan/region.
- Pixel-perfect diff automation in CI (manual snapshot review is acceptable in this phase).

---

## 1) Playwright Smoke Coverage

## Baseline Command
- `npm run test:playwright:smoke` (admin route coverage enforced by default)

## Required Smoke Journeys
1. Authentication and shell load
   - Login route renders and successful auth reaches dashboard shell.
2. Dashboard critical data path
   - Dashboard route loads without runtime error state.
3. Conversations path
   - Conversations list loads and a thread opens.
4. Knowledge base path
   - KB route loads and core controls render.
5. Integrations path
   - Telegram/Discord/Website settings pages load.
6. Admin/ops path
   - Admin users and learning-ops routes load for admin persona.

## Minimum Pass Criteria
- No uncaught browser/page errors.
- No failing network calls on critical bootstrap APIs.
- All required routes are reachable and render expected key UI anchors.
- Admin route checks are required for the Phase 6 gate (override with `PLAYWRIGHT_REQUIRE_ADMIN_ROUTES=0` only for local non-gating runs).

## Admin bootstrap fallback
- When admin checks are required and initial auth is non-admin, the smoke script attempts owner bootstrap/login using `E2E_SMOKE_OWNER_EMAIL`/`E2E_SMOKE_OWNER_PASSWORD` (fallback: `OWNER_EMAIL`/`OWNER_PASSWORD`, then default owner email + smoke password).
- If bootstrap cannot authenticate as owner/admin, the smoke gate fails with actionable credential guidance.

---

## 2) Visual Regression Snapshot Workflow

## Required Breakpoints
- Desktop: 1440x900
- Tablet: 1024x768
- Mobile: 390x844

## Required Snapshot Routes
- `/dashboard`
- `/conversations`
- `/knowledge-base`
- `/integrations/telegram`
- `/integrations/discord`
- `/integrations/website`
- `/admin/users`
- `/admin/ops/admin-history-learning`

## Snapshot Process
1. Set deterministic test data where possible.
2. Capture screenshots for each required route + breakpoint.
3. Compare against previous baseline captures for:
   - layout breakage
   - clipped/overflowing content
   - missing key controls
   - token/contrast regressions
4. Record review outcome in release notes (pass/defer with owner/date).

## Acceptance Rules
- P0/P1 visual regressions block release.
- P2/P3 regressions may defer only with owner + remediation date.

---

## 3) Release Gate Integration

Phase 6 gate is considered passing only when all are true:
1. `npm run check` passes.
2. `npm run build` passes.
3. `npm run test:playwright:smoke` passes for release candidate env with admin credentials available.
4. Required visual snapshots are captured and reviewed.
5. Any deferred issues include severity, owner, and target fix date.

---

## 4) Operator Checklist (Quick Run)

1. Run:
   - `npm run check`
   - `npm run build`
   - `npm run test:playwright:smoke` (admin route coverage enforced by default)
2. Capture required snapshots at desktop/tablet/mobile.
3. Validate critical route anchors and absence of overflow/clipping.
4. Attach evidence links to release/PR notes.
5. Mark Phase 6 gate status: PASS / FAIL / PASS-WITH-DEFER.

---

## Exit Criteria
- Smoke tests and snapshot evidence are consistently produced per release candidate.
- Operators can identify regressions before canary expansion.
- Phase 6 checklist becomes part of normal release hygiene.
