# ADR 0001: Modular Monolith Boundaries

- Status: accepted
- Date: 2026-02-28

## Context
The application runs as a single deployable process with shared route, storage, and integration modules. This has enabled fast iteration but has created high coupling in `server/routes.ts` and broad cross-domain dependencies.

## Decision
Retain a modular monolith for this release cycle and enforce stronger internal boundaries:
- Domain-oriented route modules
- Service-layer orchestration between routes and storage
- Shared middleware/utilities for audit, ops, and validation concerns

No service split or multi-repo decomposition is part of this phase.

## Consequences
Positive:
- Lower operational risk than service decomposition
- Clearer ownership and review boundaries
- Better testability of domain logic

Tradeoffs:
- Single process remains a scaling constraint
- Strong discipline is required to avoid boundary erosion

## Follow-up
- Implement domain route extraction and service modules as defined in `docs/internal/phase2-refactor-plan.md`.
