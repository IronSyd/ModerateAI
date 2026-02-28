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
| `/dashboard` | loading | `gap` | `gap` | Not captured yet; requires deterministic delayed overview API in test workspace. |
| `/dashboard` | populated | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__dashboard.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__dashboard.png` | Candidate baseline captured on 2026-02-28. |
| `/conversations` | populated | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__conversations.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__conversations.png` | Conversation list baseline captured. |
| `/conversations` | thread open | `gap` | `gap` | Requires seeded conversation with open thread target; not captured yet. |
| `/knowledge-base` | populated | `gap` | `gap` | Current captured state is empty; populate KB fixture before recapture. |
| `/knowledge-base` | empty | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__knowledge-base.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__knowledge-base.png` | Empty-state baseline captured. |
| `/integrations/telegram` | configured | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__integrations__telegram.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__integrations__telegram.png` | Settings layout baseline captured. |
| `/integrations/discord` | configured | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__integrations__discord.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__integrations__discord.png` | Settings layout baseline captured. |
| `/integrations/website` | configured | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/desktop__integrations__website.png` | `logs/phase6-snapshots-2026-02-28T11-11-07-557Z/mobile__integrations__website.png` | Settings layout baseline captured. |

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

## Remaining Capture Gaps
1. `/dashboard` loading
2. `/conversations` thread open
3. `/knowledge-base` populated
