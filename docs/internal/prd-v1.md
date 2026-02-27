# ModerateAI PRD v1 (Live Stabilization + UI v2)

## Context
ModerateAI is already live on Render. This cycle focuses on production-safe improvements while rolling out UI v2 behind runtime flags.

## Product Goals
1. Preserve live reliability while shipping iterative improvements.
2. Improve operator speed in core workflows (conversations, KB, integrations, admin ops).
3. Introduce a premium UI system (dark + electric blue) without breaking existing behavior.
4. Maintain backward-compatible API and workflow contracts during UI modernization.

## Non-Goals
1. No multi-instance scheduler redesign in this cycle.
2. No public API version break.
3. No full workflow rewrite of existing pages.
4. No big-bang UI release.

## Primary Users
1. Owner/Admin operators managing multi-channel support.
2. Moderators reviewing conversations and moderation outcomes.
3. SMB founders configuring website/Telegram/Discord support.

## Scope (This Release Window)
1. SDLC baseline docs and release gates.
2. Runtime UI v2 rollout controls (`UI_V2_*`) and route-scoped activation.
3. Design token and typography refresh with v1 fallback.
4. Wave-based UI rollout, starting with core ops surfaces.
5. Expanded release/rollback runbook and quality gates.

## Out of Scope (This Window)
1. External API contract changes.
2. New billing model changes.
3. Distributed job orchestration.
4. Deep backend service decomposition beyond prioritized hotspots.

## Success Criteria
1. Zero P0 regressions in production after rollout.
2. UI v2 can be enabled/disabled instantly through runtime flags.
3. Core ops wave pages remain functionally identical with improved usability.
4. Release checklist and acceptance matrix are enforced per PR.

## Rollout Strategy
1. Default production state: `UI_V2_ENABLED=0` (v1 everywhere).
2. Preview state: `UI_V2_ENABLED=1` + route scope and optional allowlist.
3. Wave rollout: core ops first, then admin/settings/help/public pages.
4. Fast rollback: disable `UI_V2_ENABLED` or shrink `UI_V2_ROUTE_SCOPE`.
