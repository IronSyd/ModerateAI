# Phase 2: Architecture, ADRs, and Refactor Plan

## Objective
Reduce architectural coupling and improve delivery safety while preserving behavior and external compatibility.

## Scope
In scope:
- Architecture baseline document
- ADR set for core decisions
- Incremental modularization plan for server-side boundaries

Out of scope:
- Service decomposition into separate deployables
- Breaking API/schema changes
- Runtime flag model replacement

## Current Hotspots
1. `server/routes.ts` mixes many domain concerns and contains heavy orchestration.
2. `server/storage.ts` exposes a very broad `IStorage` surface with mixed responsibilities.
3. Background scheduler hooks are coupled to process startup and require disciplined single-instance operations.
4. Billing, moderation, integrations, and analytics logic are not consistently layered through services.

## Refactor Workstreams

### WS1: Route Domain Segmentation
Goal:
- Move grouped route registrations into clear domain modules under `server/routes/`.

Sequence:
1. Extract admin/ops routes from `server/routes.ts` into dedicated module.
2. Extract integrations routes (telegram/discord/website) into dedicated modules.
3. Keep auth/session in `server/auth.ts` as canonical source.
4. Keep shared auth/role middleware in one reusable location.

Acceptance:
- `server/routes.ts` becomes composition-only (route wiring, not business orchestration).
- No external route path or payload changes.

### WS2: Service Layer Introduction
Goal:
- Add service modules that own domain orchestration and validation flow.

Sequence:
1. Introduce services for `admin-users`, `workspace-integrations`, and dashboard overview.
2. Move cross-cutting audit/ops event recording to service helpers.
3. Keep route handlers thin: parse input, call service, map response.

Acceptance:
- Route handlers stop directly coordinating many storage calls.
- Domain logic is unit-testable outside HTTP handler context.

### WS3: Storage Boundary Partitioning
Goal:
- Split storage implementation by domain while preserving `IStorage` compatibility.

Sequence:
1. Create domain repository modules and internal composition.
2. Keep `IStorage` API stable during transition.
3. Migrate services to call domain repositories through composed storage boundary.

Acceptance:
- Reduced churn in a single `storage.ts` file.
- Domain repository tests can run without loading unrelated storage paths.

### WS4: Scheduler and Operational Boundary Hardening
Goal:
- Make operational loops easier to reason about and safer in deploy workflows.

Sequence:
1. Centralize scheduler startup wiring and guard conditions.
2. Normalize structured ops events for each scheduler path.
3. Add explicit operational checks to release gate evidence.

Acceptance:
- Scheduler startup behavior is deterministic and documented.
- Failure modes are observable in logs and ops summaries.

## Risk Controls
1. Keep all public API behavior backward-compatible.
2. Run `npm run check` and `npm run build` on each refactor increment.
3. Run focused smoke tests for touched domains before merge.
4. Use runtime flags for UI-facing behavior changes where applicable.

## Proposed Delivery Sequence
1. WS1 Route Domain Segmentation
2. WS2 Service Layer Introduction
3. WS3 Storage Boundary Partitioning
4. WS4 Scheduler Boundary Hardening

## Completion Criteria
1. Architecture baseline and ADRs are merged.
2. At least one high-risk domain flow moved to route -> service -> storage pattern.
3. Release gates and rollback path remain green through refactor increments.
4. No P0/P1 regressions introduced.
