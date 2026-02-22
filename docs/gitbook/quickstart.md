# Quickstart

## 1. Create an Account

1. Go to the auth page.
2. Create your account with full name, email, and password.
3. Sign in with your credentials.

## 2. Choose Initial Access

- Free plan can be selected directly in-app.
- Standard and Pro are request-only and activated by support/admin after payment confirmation.

## 3. Open Your Dashboard

After access is active, use the dashboard to:

- Review destination counters (Telegram, Discord, Website).
- Review daily AI quota.
- Complete integration setup per platform.

## 4. Configure Integrations

- Telegram:
  - Default is app-owned ModerateAI bot.
  - Generate a claim code, add the shared bot to your group, run `/claim CODE`, then manage `Respond` per group in the `Groups` tab.
  - Pro can switch to BYOB (bring your own bot) per platform.
- Discord:
  - Default is app-owned ModerateAI bot.
  - Generate a claim code, invite the shared bot, run `/claim CODE` or `!claim CODE`, then enable servers/channels in the `Servers` tab.
  - Pro can switch to BYOB per platform.
- Website:
  - Install widget script and enable lead capture settings.
  - Assign a Knowledge Base per website domain in `Integrations -> Website` (`Domain Knowledge Base Routing`) so widget chats can respond.

## 5. Build Your Knowledge Base

Add knowledge from multiple sources:

- Manual text/FAQ/Q&A entries
- One-page URL snapshot import (`URL` tab)
- Managed URL Sync sources (`URL Sync` tab) for path-prefix crawling and scheduled refresh
- File uploads (server-side parsing): `.pdf`, `.docx`, `.xlsx`, `.pptx`, plus text formats

Notes:

- `.doc` (legacy Word) is not supported in this phase; convert to `.docx`.
- URL Sync uses static HTML extraction (JS-heavy pages may import incomplete content).

## 6. Invite Team Members

Use Team Management to invite members into your workspace under your plan seat limits.
