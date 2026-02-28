# Phase 1: SDLC Baseline Finalization

## Objective
Turn baseline planning docs into an explicit release workflow requirement with accountable ownership and repeatable sign-off.

## Baseline Artifact Set
| Artifact | Path | Purpose | Owner Role | Required Per Release |
| --- | --- | --- | --- | --- |
| Product requirements | `docs/internal/prd-v1.md` | Scope, goals, non-goals, rollout strategy | Product + Eng Lead | Yes |
| Non-functional requirements | `docs/internal/nfr-v1.md` | Reliability, security, compatibility, operability constraints | Eng Lead + Ops | Yes |
| Acceptance matrix | `docs/internal/acceptance-matrix.md` | Pass/fail criteria and severity gate | QA + Eng Lead | Yes |
| Release gates | `docs/internal/release-gates.md` | Entry/exit and rollback controls | Eng Lead + Ops | Yes |

## Workflow Integration

### PR Phase
1. Confirm scope alignment with `prd-v1.md`.
2. Confirm changed behavior still satisfies `nfr-v1.md`.
3. Update acceptance criteria/evidence expectations when behavior changes.
4. Link release/rollback path in PR notes.

### Release Candidate Phase
1. Validate all release entry gates.
2. Validate acceptance matrix evidence for changed surfaces.
3. Confirm risk ownership for any defer items.
4. Record sign-off row in the table below.

### Post-Deploy Phase
1. Validate release exit gates.
2. Capture rollback readiness outcome.
3. Archive links to smoke evidence and visual evidence.

## Sign-off Log (Per Release Candidate)
| Date | Branch/Tag | Product | Engineering | QA | Ops | Status (`PASS`/`FAIL`/`PASS-WITH-DEFER`) | Evidence Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-02-28 | `release/prep-prod-v1` | defer (final release approval pending) | pass (local gate evidence complete) | pass (local smoke + visual evidence complete) | defer (deployed admin checks + header parity fix pending) | PASS-WITH-DEFER | Live URL checks executed (`/api/health`, `/api/runtime-config`, public routes) on 2026-02-28; deferred items tracked in `phase8-release-closeout.md` (target 2026-03-03) |

## Completion Criteria
1. Baseline artifacts are enforced in PR and release gate checks.
2. Every release candidate has an explicit sign-off row with status and evidence.
3. Defer items always include owner and target date.
