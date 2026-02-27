# Wave 1 Redo Handoff Checklist (Figma -> Code)

## Scope
This checklist is the hard gate for starting Wave 1 full redo implementation (parallel v2.1 track).

Wave 1 routes:
- `/dashboard`
- `/conversations`
- `/knowledge-base`
- `/integrations/telegram`
- `/integrations/discord`
- `/integrations/website`

## Required Figma Inputs (Must Be Complete)
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

## Asset Requirements
- All icons/images exported or available through Figma asset references.
- No placeholder assets allowed for final implementation.
- Asset naming must be stable and mapped to route/component usage.

## Component Mapping Table (Fill Before Implementation)
| Figma Component | Variant/State | React Target Path | Reuse or New | Notes |
|---|---|---|---|---|
| `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |

## Implementation Boundaries
- Keep workflow logic and backend contracts unchanged.
- UI redo is presentation/component composition only unless a blocker is documented.
- Legacy Wave 1 v2 path remains intact for rollback until post-canary cleanup.

## Completion Gate
Wave 1 redo implementation does not begin until all sections above are complete and reviewed.
