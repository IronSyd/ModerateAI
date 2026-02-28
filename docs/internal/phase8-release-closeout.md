# Phase 8: Docs + Release Closeout

This playbook closes the release preparation cycle by consolidating evidence, explicit defer handling, and go/no-go decisions.

## 1) Closeout Objective

1. Confirm phases 1, 2, 5, 6, and 7 are documented with executable evidence.
2. Record release decision (`PASS`, `FAIL`, `PASS-WITH-DEFER`) with owner accountability.
3. Ensure release notes, rollback readiness, and deferred actions are explicit and dated.

---

## 2) Required Closeout Inputs

1. Baseline artifacts:
   - `docs/internal/prd-v1.md`
   - `docs/internal/nfr-v1.md`
   - `docs/internal/acceptance-matrix.md`
   - `docs/internal/phase1-sdlc-baseline.md`
2. Reliability and QA evidence:
   - `docs/internal/phase5-reliability-hardening.md`
   - `docs/internal/phase6-qa-gates.md`
3. Security and observability evidence:
   - `docs/internal/phase7-security-observability.md`
4. Live release gate policy:
   - `docs/internal/release-gates.md`

---

## 3) Go/No-Go Checklist

1. Local quality gates pass:
   - `npm run check`
   - `npm run build`
2. Required scripted checks pass:
   - `npm run test:playwright:smoke`
   - `npm run test:phase7:regressions`
3. Visual snapshot evidence is recorded for required Phase 6 routes/breakpoints.
4. Runtime hardening and observability controls are validated (`/api/health`, `/api/admin/ops/runtime-observability`).
5. Any unresolved items are captured as defer records with owner + target date.

---

## 4) Defer Policy

A release may be marked `PASS-WITH-DEFER` only when:
1. No open P0/P1 defect exists.
2. Defer scope is limited to non-blocking release tasks (for example: deployed environment confirmation after local gate completion).
3. Every defer item includes:
   - severity
   - owner
   - target date
   - verification command or evidence path

If any P0/P1 issue exists, status must be `FAIL`.

---

## 5) Closeout Record (2026-02-28)

## Consolidated Evidence Index
| Area | Status | Evidence |
| --- | --- | --- |
| Phase 1 baseline integration | `PASS-WITH-DEFER` | `docs/internal/phase1-sdlc-baseline.md` sign-off log |
| Phase 2 architecture/ADR docs | `PASS` | `docs/architecture.md`, `docs/adr/*`, `docs/internal/phase2-refactor-plan.md` |
| Phase 5 reliability hardening | `PASS` (local) / `PARTIAL` (deployed) | `docs/internal/phase5-reliability-hardening.md` (live health + runtime-config verified on 2026-02-28) |
| Phase 6 expanded QA gates | `PASS` (local) / `PENDING` (deployed-auth) | `docs/internal/phase6-qa-gates.md` + `checkpoints/phase6-visuals/...` |
| Phase 7 security/observability | `PASS` (local) / `PARTIAL` (deployed) | `docs/internal/phase7-security-observability.md` (live `/api/health` reachable but expected security headers absent on 2026-02-28) |

## Current Release Decision
- Status: `PASS-WITH-DEFER`
- Reason: local gates are complete; deployed checks are partially complete and currently blocked by missing admin credentials plus unresolved security-header parity on live endpoint.

## Deployed Verification Attempt (2026-02-28, `https://www.moderateai.net`)
| Check | Result |
| --- | --- |
| `GET /api/health` | Pass (`200`, body `{\"status\":\"ok\",\"mode\":\"production\"}`) |
| `GET /api/runtime-config` | Pass (`200`, expected v1 gate payload) |
| Public route rendering (`/`, `/auth`, `/privacy-policy`, `/terms-of-service`) | Pass (Playwright marker checks) |
| Security header parity (`x-request-id`, `x-content-type-options`, `x-frame-options`, `referrer-policy`, `strict-transport-security`) | Not met (headers absent on live `/api/health`) |
| Admin-authenticated checks (`/api/admin/ops/runtime-observability`, deployed smoke with admin routes) | Blocked (owner/admin password not configured in local verification environment) |

## Defer Items
| Item | Severity | Owner | Target Date | Verification |
| --- | --- | --- | --- | --- |
| Restore/confirm security-header parity on live API responses | P2 | Ops + Eng Lead | 2026-03-03 | `curl -i https://www.moderateai.net/api/health` shows expected Phase 7 headers |
| Complete deployed admin-auth checks (smoke + observability endpoint) with valid credentials | P2 | Ops + Eng Lead | 2026-03-03 | Admin login succeeds, `npm run test:playwright:smoke` against live URL passes, `GET /api/admin/ops/runtime-observability` returns `200` |
| Final Product/QA/Ops release approval | P3 | Product + QA + Ops | 2026-03-03 | Signed row update in `phase1-sdlc-baseline.md` |

---

## 6) Completion Gate

Phase 8 is complete when:
1. This closeout record is updated for the release candidate.
2. Defer items are tracked with owner/date.
3. Release decision is explicit and aligned with `docs/internal/release-gates.md`.
