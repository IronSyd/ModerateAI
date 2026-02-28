# Wave 1 Redo Handoff Checklist (Design -> Code)

## Scope
This checklist is the hard gate for starting Wave 1 full redo implementation (parallel v2.1 track).

Wave 1 routes:
- `/dashboard`
- `/conversations`
- `/knowledge-base`
- `/integrations/telegram`
- `/integrations/discord`
- `/integrations/website`

## Decision Mode
Use one mode per release candidate:
1. `Figma-first` (default)
2. `Code-first waiver` (allowed only with accepted ADR `0004-phase3-design-system-decision.md`)

## Required Inputs for Figma-First Mode (Must Be Complete)
1. Page-level frames for each Wave 1 route:
- desktop frame
- tablet frame
- mobile frame

2. Shared component library for Wave 1:
- page hero shell
- filter/action bar
- table shell (header, rows, empty, loading, error)
- card/stat blocks
- dialog and drawer variants
- tabs, chips, badges, buttons, fields

3. Interaction/state coverage:
- default
- hover
- focus-visible
- active/pressed
- disabled
- selected
- validation error
- loading

4. Layout system:
- spacing scale
- breakpoints
- grid rules
- container widths
- section gutters

5. Tokens:
- color tokens (including semantic states)
- typography tokens (family, size, weight, line-height)
- radius/shadow/border tokens
- motion tokens (duration/easing), plus reduced-motion behavior

6. Accessibility guidance:
- contrast targets (WCAG AA minimum)
- keyboard focus behavior
- hit area minimums
- icon-only control labeling expectations

## Required Inputs for Code-First Waiver Mode (Must Be Complete)
1. Baseline and candidate screenshots for required routes at desktop/tablet/mobile.
2. Component mapping table from implemented React components to route surfaces.
3. Token usage references for color/typography/spacing/motion decisions.
4. Accessibility review notes (focus visibility, keyboard path, contrast checks).
5. Explicit rollback verification note (`UI_V2_ENABLED` and redo flags).

## Asset Requirements
- All icons/images exported or available through Figma asset references.
- No placeholder assets allowed for final implementation.
- Asset naming must be stable and mapped to route/component usage.

## Component Mapping Table (Fill Before Implementation)
| Figma Component | Variant/State | React Target Path | Reuse or New | Notes |
|---|---|---|---|---|
| Page hero shell | default | `client/src/components/layout/page-shells.tsx` (`PageHeroShell`) | Reuse | Shared across Wave 1 route headers. |
| Filter/action bar | default/filter/search | `client/src/components/layout/page-shells.tsx` (`FilterBarShell`) | Reuse | Used in admin/users and list-heavy surfaces. |
| Table shell + table primitives | default/loading/empty/error wrappers | `client/src/components/layout/page-shells.tsx` (`TableShell`), `client/src/components/ui/table.tsx` | Reuse | Standard table framing and row/cell semantics. |
| Card/stat blocks | dashboard metrics and usage cards | `client/src/components/dashboard/stats-card.tsx` | Reuse | Responsive adjustments applied for tablet readability. |
| Dialog surfaces | modal form/reveal flows | `client/src/components/ui/dialog.tsx` and route-local usage (e.g., `client/src/pages/admin-users.tsx`) | Reuse | Standardized dialog structure with route-specific content. |
| Chips/badges/buttons/inputs | core interactive controls | `client/src/components/ui/badge.tsx`, `button.tsx`, `input.tsx`, `tabs.tsx` | Reuse | Shared primitives with Wave 1 styling tokens. |

## Implementation Boundaries
- Keep workflow logic and backend contracts unchanged.
- UI redo is presentation/component composition only unless a blocker is documented.
- Legacy Wave 1 v2 path remains intact for rollback until post-canary cleanup.

## Completion Gate
Wave 1 redo implementation does not begin until all sections for the selected mode are complete and reviewed.

## Code-First Waiver Evidence (2026-02-28)
1. Baseline candidate screenshots captured at desktop/tablet/mobile:
- `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/*`
2. Defer-fix verification captures:
- `logs/phase6-defer-fix-check-2026-02-28/*`
3. Rollback controls verified via existing runtime flags:
- `UI_V2_ENABLED`
- `UI_WAVE1_REDO_ENABLED`
