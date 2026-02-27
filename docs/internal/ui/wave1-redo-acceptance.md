# Wave 1 Redo Acceptance Matrix (Parallel v2.1)

## Goal
Provide objective pass/fail criteria for Wave 1 redo before canary and before broad rollout.

## Gating Acceptance
1. `UI_WAVE1_REDO_ENABLED=0`:
- All users see legacy Wave 1 v2 experience.

2. `UI_WAVE1_REDO_ENABLED=1` + route in `UI_WAVE1_REDO_ROUTE_SCOPE` + user in redo audience:
- Route renders Wave 1 redo v2.1 experience.

3. `UI_WAVE1_REDO_ENABLED=1` + user outside redo audience:
- Route renders legacy Wave 1 v2 experience.

4. Redo scope empty:
- No route renders Wave 1 redo v2.1 experience.

5. Redo gate on while UI v2 gate off:
- Redo remains inactive (overlay rule enforced).

## Functional Parity
Wave 1 routes must preserve current behavior:
- dashboard data render and refresh
- conversations list/search/filter/thread actions
- knowledge base CRUD and URL-sync controls
- integrations settings, toggles, and destination controls

## UI Quality
Each Wave 1 route must pass:
- desktop/tablet/mobile responsive layout
- no clipped content/horizontal overflow
- loading, empty, error, and populated states render correctly
- visual token consistency with approved Figma system

## Accessibility
Each Wave 1 route must pass:
- keyboard navigation end-to-end
- visible focus indicators
- semantic labels for icon-only controls
- AA contrast for primary text and key interactive elements

## Performance
- No material regression in route transition and first interactive paint relative to baseline captures.
- No repeated runtime errors introduced by redo gating.

## Canary Exit Criteria (24-48h Window)
- No P0/P1 regressions
- No auth/runtime-config regressions
- No critical support escalations from canary users
- Rollback path verified (`UI_WAVE1_REDO_ENABLED=0`)

## Required Validation Commands
- `npm run check`
- `npm run build`
- Route-specific smoke checks for Wave 1 pages

## Sign-off
| Area | Owner | Status | Notes |
|---|---|---|---|
| Figma fidelity | `TBD` | `TBD` |  |
| Functional parity | `TBD` | `TBD` |  |
| Accessibility | `TBD` | `TBD` |  |
| Performance sanity | `TBD` | `TBD` |  |
| Canary monitoring | `TBD` | `TBD` |  |
