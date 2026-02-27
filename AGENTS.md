# Codex SDLC Enforcement Policy

Policy-Version: 1.0.0

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

