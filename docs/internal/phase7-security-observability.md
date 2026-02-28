# Phase 7: Security + Observability

This playbook formalizes the runtime hardening and observability controls required before release closeout.

## 1) Security Runtime Baseline

## Objective
Apply consistent HTTP security headers and request tracing without breaking existing API or UI behavior.

## Implemented Controls
- `X-Request-Id` is attached to every response (preserved from inbound header when valid, generated otherwise).
- Express `x-powered-by` header is disabled.
- Baseline hardening headers are enabled by default:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
- `Strict-Transport-Security` is emitted only in production for secure (`https`) requests.

## Runtime Knobs
- `SECURITY_HEADERS_ENABLED` (default `1`)
- `SECURITY_HSTS_MAX_AGE_SECONDS` (default `31536000`)

---

## 2) Runtime Observability Baseline

## Objective
Make API latency and failure patterns visible with request correlation and admin-facing summaries.

## Implemented Controls
- API request logs include request-id.
- Slow API requests emit ops event code: `API_SLOW_REQUEST`.
- API responses with status `>=500` emit ops event code: `API_5XX_RESPONSE`.
- Admin endpoint exposes observability state and recent event counters:
  - `GET /api/admin/ops/runtime-observability`

## Runtime Knobs
- `API_SLOW_REQUEST_THRESHOLD_MS` (default `2000`)
- `OPS_ALERT_API_SLOW_REQUEST_THRESHOLD` (default `30`)
- `OPS_ALERT_API_5XX_RESPONSE_THRESHOLD` (default `8`)

---

## 3) Operator Validation Checklist

1. Validate response security/tracing headers on `/api/health`.
2. Verify admin access to `/api/admin/ops/runtime-observability`.
3. Confirm `npm run test:phase7:regressions` passes in release candidate environment.
4. Confirm Phase 5/6 gates remain green after Phase 7 changes.

---

## 4) Rollback Guidance

1. Emergency compatibility switch: set `SECURITY_HEADERS_ENABLED=0`.
2. Re-deploy last known-good commit/image if runtime regressions persist.
3. Re-validate `/api/health`, auth flow, and Phase 6 smoke checks.
4. Record incident and remediation task in release notes.

---

## 5) Execution Evidence (2026-02-28)

## Command Results
| Gate Item | Command / Evidence | Result |
| --- | --- | --- |
| Phase 7 regressions | `npm run test:phase7:regressions` | Pass |
| Typecheck | `npm run check` | Pass |
| Build | `npm run build` | Pass |
| Runtime health | `GET http://127.0.0.1:5000/api/health` | `200`; headers confirmed: `x-request-id`, `x-content-type-options=nosniff`, `x-frame-options=DENY`, `referrer-policy=strict-origin-when-cross-origin` |
| Admin observability API | `GET /api/admin/ops/runtime-observability` (authenticated admin) | `200`; payload includes `requestTracing`, `securityHeaders`, and event summaries for `API_SLOW_REQUEST` + `API_5XX_RESPONSE` |
| Deployed runtime health | `GET https://www.moderateai.net/api/health` | `200`; body returned expected production health payload |
| Deployed security headers parity | `GET https://www.moderateai.net/api/health` header inspection | Not met on 2026-02-28; expected Phase 7 headers not present on live response |
| Deployed admin observability API | `GET https://www.moderateai.net/api/admin/ops/runtime-observability` | Blocked on 2026-02-28; admin password unavailable in verification environment |

---

## Phase 7 Completion Gate
Phase 7 is complete when sections 1-4 are implemented and section 5 contains dated evidence from release-candidate validation.
