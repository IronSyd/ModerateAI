# ModerateAI System Architecture

## 1. Purpose
This document describes the current production architecture of ModerateAI and the intended near-term target for incremental refactoring.

## 2. System Context
ModerateAI is a single deployable Node.js application that provides:
- Operator-facing web dashboard (React + Vite)
- HTTP API (Express + TypeScript)
- Background scheduler loops
- Platform bot integrations (Telegram and Discord)
- AI-assisted support and moderation workflows

External dependencies:
- PostgreSQL (primary persistent store)
- OpenAI API (generation and analysis workloads)
- Telegram Bot API
- Discord API
- Optional Redis (auth rate-limit backend)
- Optional SendGrid (email delivery)

## 3. Runtime Topology
Current runtime is a modular monolith:
- Entry point: `server/index.ts`
- API route registration: `server/routes.ts` + focused route modules under `server/routes/`
- Auth/session setup: `server/auth.ts`
- Data access layer: `server/storage.ts` through `IStorage`
- Schema and contracts: `shared/schema.ts`
- Background jobs and operational loops:
  - destination lock sweeps
  - admin-history backfill/analysis
  - KB URL sync
  - conversation retention sweep
- Frontend app: `client/src/*` served via Vite dev or static production bundle

## 4. Data and Domain Boundaries
Primary domain areas represented in schema and code:
- Identity and workspace: users, invitations, workspace settings
- Integrations and destinations: platforms, chat configurations, destination locks
- Conversation system: conversations, messages, corrections, training insights
- Knowledge system: knowledge bases, documents, URL sources, sync runs
- Moderation and analytics: moderation actions, audit events, ops events
- Commercial controls: plan/entitlement status, seat and destination limits

Current data-access shape:
- `IStorage` contract in `server/storage.ts` acts as the repository boundary.
- Postgres implementation is production path; memory implementation remains useful for some local/testing flows.

## 5. Request and Processing Flow
1. Browser or platform event enters application.
2. Express middleware applies auth/session, CORS, rate limits, and validation.
3. Route handlers orchestrate domain logic and storage access.
4. AI and platform adapters are called when required.
5. Persistence and audit/ops events are written.
6. Response is returned, with dashboard and scripts providing verification surface.

## 6. Non-Functional Controls (Current)
- Startup preflight validation in `server/runtime-preflight.ts`
- Health endpoint for deployment validation
- Session cookies with secure defaults and DB-backed session store
- Auth rate limiting with postgres/redis backend option
- Runtime canary controls for UI rollouts (`UI_V2_*`, `UI_WAVE1_REDO_*`)
- Scripted smoke and regression checks via `scripts/test-*.ts`

## 7. Key Architecture Risks
- Large `server/routes.ts` increases coupling and review complexity.
- `IStorage` surface is broad; domain ownership is diffuse.
- Background job scheduling lives in app process, which is sensitive to scaling model.
- Multiple concerns (billing, moderation, integrations, analytics) are mixed in shared route handlers.

## 8. Target Refactor Direction (Incremental)
ModerateAI will remain a modular monolith in this cycle. Refactor priority is boundary hardening, not service decomposition:
- Split route registration by bounded domain
- Introduce thin service modules between routes and storage
- Partition storage/repository responsibilities by domain
- Normalize operational hooks (audit/ops/metrics) as shared middleware utilities
- Preserve external contracts and runtime flags during migration

## 9. Compatibility Constraints
- No breaking API contract changes in this phase.
- No incompatible DB schema behavior changes without explicit migration docs.
- Existing release and rollback gates in `docs/internal/release-gates.md` remain authoritative.
