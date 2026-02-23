# Discord Integration

## Purpose

Run AI support and moderation in Discord servers from the same workspace.

## Setup Steps

1. Open `Integrations -> Discord`.
2. Choose ownership mode:
   - `App-owned` (default): generate a one-time claim code.
   - `BYOB` (Pro): connect your own bot token.
3. In app-owned mode, click `Add Shared Discord Bot` and invite it to your server.
4. Run `/claim CODE` or `!claim CODE` in any server channel.
5. Click `Check Claim Status`, then configure response behavior in the `Servers` tab.
6. BYOB mode requires enabling servers from the `Servers` tab before the bot responds, then enabling channels inside each server config.

## Destination Behavior

- Destination limits are enforced per plan.
- On overflow destinations, bot behavior follows current limit policy with upgrade messaging.
- Claim codes are one-time and expire automatically.
- Server responses are controlled per server (no global server-mode toggle).
- `Private Chat Mode` is currently disabled in bot settings (Discord direct-message replies are off in this release).
- Anti-spam heuristics are disabled globally; bots prioritize Q&A and engagement.
- Harmful-content moderation stays active through blocked keywords and advanced moderation automation.

## Admin-History Learning

- `History Learning` stores eligible incoming Discord messages only from channels/servers where the bot can respond.
- Discord moderators with `ManageMessages` (plus `ManageGuild` / `Administrator`) are treated as admin learning sources.
- If Discord member permission lookup fails, the workspace fallback admin list is still supported.
- ModerateAI analyzes new admin messages automatically on a schedule (manual analysis remains available in `Manage Training`).
- Historical backfill runs best-effort after rollout to seed training history from prior conversations.

## Timed Locking

- Timed locking is available per configured Discord destination.
- Lock/unlock can be done in-app (moderator/admin) or in-chat by Discord server admins:
  - `!lock 15m optional reason` (also supports `/lock` text command)
  - `!unlock optional reason` (also supports `/unlock` text command)
  - App-owned bot also supports slash commands: `/lock` and `/unlock`.
- Locks apply only to currently enabled channels (`enabledChannels=true`) and are independent from the `Respond` toggle.
- Auto timed lock is optional per destination (default off) and now uses admin-defined schedules:
  - set timezone per destination
  - add one or more daily/weekly lock windows
  - if saved during an active window, lock applies immediately
  - manual lock/unlock pauses schedule until `Resume Schedule` is used in `Configure`
- `Unlock All` is available on the Discord integration page.

## Monitoring

- Discord destination usage appears in dashboard counters.
- Conversation and moderation activity is available according to plan features.
