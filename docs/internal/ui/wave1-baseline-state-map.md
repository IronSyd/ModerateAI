# Wave 1 Baseline State Map

## Purpose
Capture baseline UX/screens before Wave 1 redo for regression comparison.

## Routes
- `/dashboard`
- `/conversations`
- `/knowledge-base`
- `/integrations/telegram`
- `/integrations/discord`
- `/integrations/website`

## Required States Per Route
- loading
- empty
- error
- populated
- filter/search active (where applicable)
- dialog/drawer open (where applicable)

## Capture Matrix
| Route | State | Desktop | Mobile | Notes |
|---|---|---|---|---|
| `/dashboard` | loading | `TODO` | `TODO` |  |
| `/dashboard` | populated | `TODO` | `TODO` |  |
| `/conversations` | populated | `TODO` | `TODO` |  |
| `/conversations` | thread open | `TODO` | `TODO` |  |
| `/knowledge-base` | populated | `TODO` | `TODO` |  |
| `/knowledge-base` | empty | `TODO` | `TODO` |  |
| `/integrations/telegram` | configured | `TODO` | `TODO` |  |
| `/integrations/discord` | configured | `TODO` | `TODO` |  |
| `/integrations/website` | configured | `TODO` | `TODO` |  |

## Capture Instructions
1. Keep `UI_WAVE1_REDO_ENABLED=0`.
2. Use a stable test workspace and test data snapshot.
3. Capture at minimum:
- desktop 1440px width
- mobile 390px width
4. Save baseline assets under a stable path:
- `docs/internal/ui/baseline/` (or external evidence folder if preferred).

## Automation Option
- Use Playwright scripts for repeatable route/state captures where feasible.
- Keep route/state filenames deterministic to support visual diff.
