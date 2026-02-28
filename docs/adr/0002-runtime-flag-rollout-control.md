# ADR 0002: Runtime Flag Rollout Control

- Status: accepted
- Date: 2026-02-28

## Context
UI modernization is actively shipped behind runtime controls (`UI_V2_*`, `UI_WAVE1_REDO_*`). Fast rollback and audience scoping are critical because the app is live and tightly coupled to operator workflows.

## Decision
Continue using server-side runtime flag evaluation as the primary rollout control mechanism:
- Global enable/disable flags
- Route scope controls
- Optional role and allowlist audience filters
- Overlay rule where redo controls do not activate when base UI gate is off

## Consequences
Positive:
- Immediate rollback capability without code rollback
- Safe canary scope by route and audience
- Operationally consistent with current release-gate process

Tradeoffs:
- Additional complexity in runtime-config evaluation and testing matrix
- Risk of misconfiguration if environment parity is weak

## Follow-up
- Keep release validation tied to `docs/internal/release-gates.md` and `docs/internal/phase6-qa-gates.md`.
