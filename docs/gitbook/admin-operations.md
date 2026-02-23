# Admin Operations

## User Control Actions

From `Admin -> Users`, owner/admin operators can manage account access:

- Allow
- Suspend
- Deactivate
- Ban
- Delete

Manage-target rules still apply (for example owner protections and admin scope limits).

## Billing and Plan Operations

Current in-app admin flow supports:

- Upgrade and mark paid in one action.
- Downgrade to Free.
- Controlled subscription duration handling.
- Automatic billing suspension when period ends and not marked paid.

## Password Recovery (No Email)

Password recovery is admin-issued temporary password:

1. Admin issues temporary password from Users page.
2. User signs in with temporary password.
3. User is forced to complete password reset on dedicated page.
4. Access resumes after reset completion.

Security characteristics:

- Temporary password has TTL.
- Session invalidation is applied on issuance.
- Reset completion clears forced-reset flags.

## AI Training Operations (Telegram / Discord)

- `History Learning` + `Admin Learning Mode` together enable ongoing admin-history learning for each destination.
- Admin-history analysis now runs automatically on a schedule when enough new admin messages exist.
- Manual `Analyze Chat History` remains available in the destination training dialog for immediate refresh.
- Historical chat-history backfill runs best-effort after rollout and may skip ambiguous legacy records.

## Learning Ops (Admin Debug / Operations)

Use `Admin -> Learning Ops` to monitor and operate the learning pipelines:

- Backfill progress and destination summaries
- Auto-analysis runs and per-destination outcomes
- Filters/search for platform, status, and destination IDs
- Manual `Run Backfill Now` and `Force Re-run` controls (admin-only)

Backfill is best-effort and idempotent (duplicates are skipped).

## Conversation Review and AI Corrections

Use `Conversations -> View` to open a thread review dialog:

- Viewer: can read thread messages and any internal corrections
- Moderator/Admin/Owner: can create or edit AI message corrections (`draft`)
- Moderator/Admin/Owner: can `Approve for Learning` to feed the correction into destination-scoped training insights

Correction behavior:

- Original AI message remains immutable
- Corrected content is internal-only (not posted back to Telegram/Discord)
- Editing an approved correction resets it to `draft` and requires re-approval
