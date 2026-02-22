# Telegram Integration

## Purpose

Run AI support and moderation in Telegram groups using your workspace configuration.

## Setup Steps

1. Open `Integrations -> Telegram`.
2. Choose ownership mode:
   - `App-owned` (default): generate a one-time claim code.
   - `BYOB` (Pro): connect your own bot token.
3. In app-owned mode, click `Add Shared Telegram Bot` and add it to your group.
4. Run `/claim CODE` inside the target group.
5. Click `Check Claim Status`, then configure destination-specific chat settings in the `Groups` tab.

## Destination Behavior

- Destination limits are enforced per plan.
- When a new group exceeds allowed capacity, the bot replies once with an upgrade message.
- Claim codes are one-time and expire automatically.
- Group responses are controlled per group (no global group-mode toggle).
- `Private Chat Mode` is currently disabled in bot settings (Telegram direct-message replies are off in this release).
- Anti-spam heuristics are disabled globally; bots prioritize Q&A and engagement.
- Harmful-content moderation stays active through blocked keywords and advanced moderation automation.

## Admin-History Learning

- `History Learning` stores eligible incoming Telegram messages (only chats where the bot can respond).
- `Admin Learning Mode` uses Telegram group admin status (`administrator` / `creator`) to tag admin messages for learning.
- If Telegram admin lookup fails, the workspace fallback admin list is still supported.
- ModerateAI analyzes new admin messages automatically on a schedule (manual analysis remains available in `Manage Training`).
- Historical backfill runs best-effort after rollout to seed training history from prior conversations.

## Timed Locking

- Timed locking is available per configured Telegram destination.
- Lock/unlock can be done in-app (moderator/admin) or in-chat by Telegram group admins:
  - `/lock 15m optional reason`
  - `/unlock optional reason`
- Locks are read-only for non-admin members and are independent from the `Respond` toggle.
- Auto timed lock is optional per destination (default off) and now uses admin-defined schedules:
  - set timezone per destination
  - add one or more daily/weekly lock windows
  - if saved during an active window, lock applies immediately
  - manual lock/unlock pauses schedule until `Resume Schedule` is used in `Configure`
- `Unlock All` is available on the Telegram integration page.

## Monitoring

- Telegram destination usage appears in dashboard counters.
- Activity is visible in conversations and analytics views by plan entitlement.
