# ADR 0003: Storage Boundary and Domain Repositories

- Status: accepted
- Date: 2026-02-28

## Context
`server/storage.ts` currently holds a large `IStorage` contract and broad implementations spanning identity, integrations, conversations, knowledge, analytics, and operations. This centralization increases merge conflict risk and slows refactoring.

## Decision
Keep `IStorage` as the top-level boundary for backward compatibility, but introduce domain repository modules behind it:
- Identity/workspace repository
- Integrations/destination repository
- Conversation/knowledge repository
- Analytics/ops repository

Route handlers should consume service-layer functions rather than directly orchestrating many storage calls.

## Consequences
Positive:
- Preserves existing API contract while reducing internal coupling
- Enables incremental refactor without big-bang storage rewrite
- Improves test focus by domain

Tradeoffs:
- Transitional duplication while old and new access paths coexist
- Requires strict code review to prevent bypassing service/repository layers

## Follow-up
- Track extraction milestones in `docs/internal/phase2-refactor-plan.md`.
