# Phase 5: Reliability + Render Production Hardening

This playbook converts the Wave 1 post-UI work into an operational checklist that can be executed before broad rollout.

## 1) Startup Preflight Checks (Fail Fast)

## Objective
Ensure the app exits early with actionable error messages when critical runtime inputs are missing or malformed.

## Existing Runtime Contract
`server/runtime-preflight.ts` is imported first by `server/index.ts` and currently enforces:
- required env vars: `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`
- `PORT` shape validation (1-65535)
- production warnings for short `SESSION_SECRET` and missing `FRONTEND_URL`
- startup log for UI gate state (`UI_V2_*`, `UI_WAVE1_REDO_*` summary)

## Validation Steps
1. Missing-secret guardrails:
   - Temporarily unset each required env var and confirm process exits with `[startup-preflight] Missing required environment variable: <NAME>`.
2. Invalid port guardrail:
   - Set `PORT=abc` and confirm process exits with invalid-port message.
3. Production warning path:
   - Run with `NODE_ENV=production`, short `SESSION_SECRET`, and unset `FRONTEND_URL`; confirm warning logs are emitted.
4. Healthy startup path:
   - Provide valid required env vars and verify normal startup plus preflight summary log line.

## Exit Criteria
- All failure paths are explicit and deterministic.
- Operators can diagnose misconfiguration from first log screen without reading source code.

---

## 2) Render Runbook Hardening

## Objective
Standardize release execution, rollback triggers, and post-deploy smoke checks.

## Pre-Deploy Checklist
1. Confirm branch/commit matches approved release notes.
2. Run:
   - `npm run check`
   - `npm run build`
3. Verify required Render env vars are present:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `OPENAI_API_KEY`
   - `FRONTEND_URL` (required for production correctness)
4. Verify UI gate defaults for safe rollout:
   - `UI_V2_ENABLED=0` unless intentional canary
   - `UI_WAVE1_REDO_ENABLED=0` unless explicit redo canary

## Deploy Sequence
1. Start Render deploy from approved commit.
2. Watch startup logs for preflight output and scheduler boot messages.
3. Confirm health endpoint:
   - `curl -fsS https://<service-url>/api/health` returns 200 (fails on HTTP 4xx/5xx).

## Post-Deploy Smoke Checklist
1. Auth: admin login succeeds.
2. Runtime config: `/api/runtime-config` returns expected gate values.
3. Core ops pages load:
   - Dashboard
   - Conversations
   - Knowledge Base
   - Integrations
4. Public routes load:
   - `/`
   - `/privacy-policy`
   - `/terms-of-service`
5. Optional scripted smoke:
   - `npm run test:playwright:smoke` (if credentials/test env are available)

## Rollback Triggers
Trigger rollback immediately if any occur:
1. Startup crash loop or repeated failed health checks.
2. Auth/session failure blocking operator login.
3. P0/P1 data isolation or integrity issue.
4. Sustained elevated runtime exceptions after deploy.

## Rollback Steps
1. For UI regressions, set `UI_V2_ENABLED=0` (and `UI_WAVE1_REDO_ENABLED=0` if needed).
2. Redeploy previous known-good commit/image.
3. Re-check health endpoint with `curl -fsS https://<service-url>/api/health` and verify admin login.
4. Re-run focused smoke on core workflows.
5. Record incident note and follow-up RCA task.

---

## 3) Dependency Risk Register

## Objective
Track accepted package risk with explicit ownership and review cadence.

## Current Accepted Items
| Package / Area | Risk Summary | Acceptance Rationale | Owner | Review Date | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| `xlsx` (`0.18.5`) | Known vulnerability advisories in ecosystem; patch line adoption may lag. | Required for current import/export compatibility and customer workflow continuity. | Engineering Lead | 2026-03-31 | Re-evaluate alternatives (`exceljs`/upgraded `xlsx`) and sandbox parsing path. |
| Legacy transitive vulnerabilities (non-runtime or low exploitability paths) | Audit reports may contain inherited CVEs not exercised by production code paths. | Immediate removal may require major dependency graph churn during active UI rollout. | Engineering Lead | 2026-03-31 | Re-run audit after Wave 1 stabilization and prioritize removable transitive trees. |

## Enforcement
- Update this table in each release that adds/updates dependencies.
- Any P0/P1 security advisory cancels acceptance and becomes immediate remediation work.

---

## 4) Canary Controls Review (`UI_V2_*`)

## Objective
Ensure canary/rollback controls are documented, testable, and reversible within minutes.

## Control Surface
Primary flags:
- `UI_V2_ENABLED`
- `UI_V2_ROUTE_SCOPE`
- `UI_V2_ALLOWLIST_EMAILS`
- `UI_V2_FORCE_ROLES`

Wave 1 redo overlay flags:
- `UI_WAVE1_REDO_ENABLED`
- `UI_WAVE1_REDO_ROUTE_SCOPE`
- `UI_WAVE1_REDO_ALLOWLIST_EMAILS`
- `UI_WAVE1_REDO_FORCE_ROLES`

## Canary Validation Matrix
1. Global fallback: `UI_V2_ENABLED=0` shows v1 globally.
2. Route canary: `UI_V2_ENABLED=1` + scoped routes only affects selected families.
3. Allowlist targeting: non-allowlisted user remains on v1 when allowlist active.
4. Role targeting: forced roles receive v2 while non-forced roles stay on v1.
5. Fast rollback: toggling `UI_V2_ENABLED=0` returns affected routes to v1.
6. Overlay rule: redo flags have no effect if UI v2 gate is disabled.

## Evidence Required Per Canary
- Runtime config snapshot (`/api/runtime-config`).
- Screenshots for changed routes and mobile breakpoints.
- Short note confirming rollback tested in environment.

---

## Phase 5 Completion Gate
All four sections above must be completed before moving to Phase 6 expanded QA gates.
