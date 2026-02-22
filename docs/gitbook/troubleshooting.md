# Troubleshooting

## Login Issues

- If login fails with temporary-password expiry, request a new temporary password from admin.
- If forced reset is active, complete reset at `/reset-password` before other app pages.

## Plan Activation Issues

- Standard/Pro remain unavailable until admin/owner activates after payment confirmation.
- If a user cannot access expected features, verify plan and plan status in Admin -> Users.

## Integration Limits

- Destination overflow is blocked per plan entitlements.
- Check dashboard destination counters for Telegram/Discord/Website usage.

## Telegram / Discord Claim and Setup Issues

- If app-owned claim does not complete, confirm:
  - the claim code is still active (not expired/revoked/used)
  - you ran `/claim CODE` (Telegram/Discord app-owned) or `!claim CODE` (Discord text command)
  - you are a platform admin/moderator with the required permissions
- `Groups` / `Servers` tabs are available before claim, but may show an empty-state guide until a destination is claimed/enabled.
- `Settings` / `Analytics` tabs may stay disabled until at least one destination is active.

## Widget Knowledge Base Routing (Blocked Replies)

- Website widget chats are blocked when the domain is not mapped to a valid Knowledge Base.
- In `Integrations -> Website`, check `Domain Knowledge Base Routing`:
  - domain row exists
  - `Knowledge Base` is assigned
  - assigned KB still exists and has documents
- Widget blocked replies are expected until routing is configured.

## URL Sync (Knowledge Base) Issues

- URL Sync is path-prefix and same-host only (it will not crawl external domains).
- URL Sync uses static HTML extraction only; JS-rendered pages may import partial or empty content.
- Removed pages are marked `Stale` and kept until you review/delete them manually.
- If a sync run is `partial`, check storage quota limits and run details/errors.

## File Upload Parsing Limits (Knowledge Base)

- Supported server-side parsed formats include `.pdf`, `.docx`, `.xlsx`, `.pptx` and text formats.
- `.doc` (legacy Word) is not supported in this phase; convert to `.docx`.
- PDF/PowerPoint/Excel extraction is text-focused and may flatten layout/tables.

## Quota and Rate Limits

- Daily AI response quota is enforced by plan.
- Widget and auth routes have configured rate limits.
- Ask admin to review account state if access is suspended or restricted.

## Docs Availability

- If Help pages show docs unavailable, configure `VITE_DOCS_BASE_URL` in frontend environment.
