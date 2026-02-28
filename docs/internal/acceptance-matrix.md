# ModerateAI Acceptance Matrix (v1 Window)

| Area | Acceptance Criteria | Verification |
| --- | --- | --- |
| Runtime config | `/api/runtime-config` returns `uiPerfProfile`, `uiVersion`, `uiV2Enabled`, `uiV2RouteScope` | API smoke check |
| UI fallback safety | `UI_V2_ENABLED=0` keeps v1 visuals globally | Manual smoke (core pages) |
| Route-scoped rollout | `UI_V2_ENABLED=1` + scoped routes only updates selected route families | Manual smoke + screenshot evidence |
| Auth and access | Admin and non-admin access controls remain unchanged | Role-based manual checks |
| Conversations flow | List/view/correction workflows still function | Manual + existing regression scripts |
| Knowledge base flow | Document ingest, URL extraction/sync flows remain functional | Manual flow + API checks |
| Integrations flow | Telegram/Discord/Website settings pages remain functional | Manual smoke |
| Learning ops | Page loads, filters work, refresh/backfill actions still execute | Manual smoke |
| Public pages | `/`, `/privacy-policy`, `/terms-of-service` are accessible and render | Public route smoke |
| Build/typecheck | `npm run check` and `npm run build` pass | CI and local run |
| Deployability | Render deploy reaches healthy state and `/api/health` returns 200 | Render logs + health check |

## Severity Gate
1. P0 and P1 issues block release.
2. P2 and P3 may ship only with defer notes and owner/date.
