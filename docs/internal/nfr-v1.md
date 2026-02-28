# ModerateAI NFR v1

## Availability and Reliability
1. Single-instance Render deployment remains the operating model for this cycle.
2. `/api/health` must stay green after every deploy.
3. Startup must fail fast when required secrets are missing.
4. Background schedulers must run once per instance and avoid duplicate processing loops.

## Performance
1. `npm run build` artifacts must remain deployable within Render limits.
2. UI v2 effects must remain subtle and respect `prefers-reduced-motion`.
3. No significant degradation in route transition or initial dashboard load under normal usage.

## Security
1. No secrets committed to repo.
2. Existing SSRF and auth controls must remain intact.
3. UI rollout controls must not leak sensitive allowlist data to clients.
4. Dependency risk items must be tracked with explicit owner and review date.

## Compatibility
1. Existing API routes and payload compatibility must be preserved.
2. Existing DB schema behavior must remain stable unless explicitly migrated.
3. Public routes (`/`, `/privacy-policy`, `/terms-of-service`) remain accessible.

## Accessibility
1. WCAG AA contrast target for updated UI tokens.
2. Keyboard focus visibility must be preserved on primary controls.
3. Motion effects must be reduced/disabled for reduced-motion users.

## Operability
1. Every release includes rollback notes.
2. Every release includes smoke-test evidence for core workflows.
3. Runtime flags must support safe canary by route and user segment.
