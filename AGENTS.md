# Codex SDLC Enforcement Policy

Policy-Version: 1.0.0

## Skills
Installed skills are discovered from local `~/.codex/skills` and injected automatically.

### Available skills
- api-contracts-and-versioning: Define and review API contracts, compatibility rules, and versioning strategy. Use when creating new endpoints, changing request/response schemas, or planning deprecations. (file: C:/Users/Michael Alkali/.codex/skills/api-contracts-and-versioning/SKILL.md)
- database-schema-and-migrations: Plan database schema evolution, migration rollout, backfills, and rollback. Use when introducing schema changes, data transformations, or compatibility-sensitive DB updates. (file: C:/Users/Michael Alkali/.codex/skills/database-schema-and-migrations/SKILL.md)
- doc: Use when the task involves reading, creating, or editing `.docx` documents, especially when formatting or layout fidelity matters; prefer `python-docx` plus the bundled `scripts/render_docx.py` for visual checks. (file: C:/Users/Michael Alkali/.codex/skills/doc/SKILL.md)
- figma-implement-design: Translate Figma nodes into production-ready code with 1:1 visual fidelity using the Figma MCP workflow (design context, screenshots, assets, and project-convention translation). Trigger when the user provides Figma URLs or node IDs, or asks to implement designs or components that must match Figma specs. Requires a working Figma MCP server connection. (file: C:/Users/Michael Alkali/.codex/skills/figma-implement-design/SKILL.md)
- gh-address-comments: Help address review/issue comments on the open GitHub PR for the current branch using gh CLI; verify gh auth first and prompt the user to authenticate if not logged in. (file: C:/Users/Michael Alkali/.codex/skills/gh-address-comments/SKILL.md)
- gh-fix-ci: Use when a user asks to debug or fix failing GitHub PR checks that run in GitHub Actions; use `gh` to inspect checks and logs, summarize failure context, draft a fix plan, and implement only after explicit approval. Treat external providers (for example Buildkite) as out of scope and report only the details URL. (file: C:/Users/Michael Alkali/.codex/skills/gh-fix-ci/SKILL.md)
- imagegen: Use when the user asks to generate or edit images via the OpenAI Image API (for example: generate image, edit/inpaint/mask, background removal or replacement, transparent background, product shots, concept art, covers, or batch variants); run the bundled CLI (`scripts/image_gen.py`) and require `OPENAI_API_KEY` for live calls. (file: C:/Users/Michael Alkali/.codex/skills/imagegen/SKILL.md)
- incident-and-postmortem: Run incident response and produce actionable postmortems. Use when triaging outages, coordinating mitigation, documenting root cause, and assigning follow-up actions. (file: C:/Users/Michael Alkali/.codex/skills/incident-and-postmortem/SKILL.md)
- linear: Manage issues, projects & team workflows in Linear. Use when the user wants to read, create or updates tickets in Linear. (file: C:/Users/Michael Alkali/.codex/skills/linear/SKILL.md)
- notion-knowledge-capture: Capture conversations and decisions into structured Notion pages; use when turning chats/notes into wiki entries, how-tos, decisions, or FAQs with proper linking. (file: C:/Users/Michael Alkali/.codex/skills/notion-knowledge-capture/SKILL.md)
- notion-meeting-intelligence: Prepare meeting materials with Notion context and Codex research; use when gathering context, drafting agendas/pre-reads, and tailoring materials to attendees. (file: C:/Users/Michael Alkali/.codex/skills/notion-meeting-intelligence/SKILL.md)
- notion-research-documentation: Research across Notion and synthesize into structured documentation; use when gathering info from multiple Notion sources to produce briefs, comparisons, or reports with citations. (file: C:/Users/Michael Alkali/.codex/skills/notion-research-documentation/SKILL.md)
- notion-spec-to-implementation: Turn Notion specs into implementation plans, tasks, and progress tracking; use when implementing PRDs/feature specs and creating Notion plans + tasks from them. (file: C:/Users/Michael Alkali/.codex/skills/notion-spec-to-implementation/SKILL.md)
- openai-docs: Use when the user asks how to build with OpenAI products or APIs and needs up-to-date official documentation with citations (for example: Codex, Responses API, Chat Completions, Apps SDK, Agents SDK, Realtime, model capabilities or limits); prioritize OpenAI docs MCP tools and restrict any fallback browsing to official OpenAI domains. (file: C:/Users/Michael Alkali/.codex/skills/openai-docs/SKILL.md)
- playwright: Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script. (file: C:/Users/Michael Alkali/.codex/skills/playwright/SKILL.md)
- prd-scope-and-acceptance: Define product requirement documents, scope boundaries, acceptance criteria, and non-goals. Use when starting a new feature, planning a roadmap item, or turning ideas into implementation-ready specs. (file: C:/Users/Michael Alkali/.codex/skills/prd-scope-and-acceptance/SKILL.md)
- project-specification: Force decision-complete planning before any mutating implementation work. Use for all coding tasks that could modify files, schemas, configs, migrations, infrastructure, deployments, or runtime behavior. (file: C:/Users/Michael Alkali/.codex/skills/project-specification/SKILL.md)
- release-and-rollback-runbook: Build release plans and rollback runbooks for production changes. Use when preparing deployments, approving go-live, or reducing release risk for critical updates. (file: C:/Users/Michael Alkali/.codex/skills/release-and-rollback-runbook/SKILL.md)
- render-deploy: Deploy applications to Render by analyzing codebases, generating render.yaml Blueprints, and providing Dashboard deeplinks. Use when the user wants to deploy, host, publish, or set up their application on Render's cloud platform. (file: C:/Users/Michael Alkali/.codex/skills/render-deploy/SKILL.md)
- screenshot: Use when the user explicitly asks for a desktop or system screenshot (full screen, specific app or window, or a pixel region), or when tool-specific capture capabilities are unavailable and an OS-level capture is needed. (file: C:/Users/Michael Alkali/.codex/skills/screenshot/SKILL.md)
- security-best-practices: Perform language and framework specific security best-practice reviews and suggest improvements. Trigger only when the user explicitly requests security best practices guidance, a security review/report, or secure-by-default coding help. Trigger only for supported languages (python, javascript/typescript, go). Do not trigger for general code review, debugging, or non-security tasks. (file: C:/Users/Michael Alkali/.codex/skills/security-best-practices/SKILL.md)
- security-threat-model: Repository-grounded threat modeling that enumerates trust boundaries, assets, attacker capabilities, abuse paths, and mitigations, and writes a concise Markdown threat model. Trigger only when the user explicitly asks to threat model a codebase or path, enumerate threats/abuse paths, or perform AppSec threat modeling. Do not trigger for general architecture summaries, code review, or non-security design work. (file: C:/Users/Michael Alkali/.codex/skills/security-threat-model/SKILL.md)
- sentry: Use when the user asks to inspect Sentry issues or events, summarize recent production errors, or pull basic Sentry health data via the Sentry API; perform read-only queries with the bundled script and require `SENTRY_AUTH_TOKEN`. (file: C:/Users/Michael Alkali/.codex/skills/sentry/SKILL.md)
- system-architecture-and-adrs: Design system architecture and create ADRs for critical technical decisions. Use when introducing new services, changing system boundaries, selecting infrastructure patterns, or documenting high-impact tradeoffs. (file: C:/Users/Michael Alkali/.codex/skills/system-architecture-and-adrs/SKILL.md)
- test-strategy-unit-integration-e2e: Define risk-based testing strategy across unit, integration, and end-to-end layers. Use when planning quality gates for new features, refactors, releases, or CI policy changes. (file: C:/Users/Michael Alkali/.codex/skills/test-strategy-unit-integration-e2e/SKILL.md)

## Hard Gate: Plan Before Mutation
For any task that changes repo-tracked files, Codex must produce a complete, decision-complete plan before any mutating action.

Mutating actions include (non-exhaustive):
- editing/writing files
- apply_patch operations
- format/lint commands that rewrite files
- migrations/codegen that update tracked files
- deployment or infrastructure commands with side effects

## Mandatory Skill Usage
Always invoke the `project-specification` skill for implementation requests.

## Context Grounding Rule
Before planning, inspect repository context at minimum:
- README and architecture docs
- package/dependency manifests
- application entrypoints
- schema/migration files
- test configuration and key test files
- deployment/runtime config

Do not ask questions that can be answered by local repository inspection.

## Execution Sequencing
1. Explore and gather facts.
2. Produce decision-complete plan.
3. Resolve remaining high-impact ambiguities.
4. Execute implementation only after plan lock.

## Testing Minimums
After implementation, run check/build/tests relevant to changed surfaces and report results.

## Non-Mutating Exception
Read-only analysis and planning-only tasks may proceed without implementation.

