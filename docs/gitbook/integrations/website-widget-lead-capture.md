# Website Widget + Lead Capture

The website integration is both a support channel and a lead generation channel.

## What It Does

- Adds AI chat to your website.
- Captures Leads directly into your workspace.
- Supports configurable lead capture behavior (enabled/disabled, prompts, required email).

## Typical Setup

1. Open `Integrations -> Website`.
2. Complete widget setup and copy embed code.
3. Install snippet on your website.
4. Assign a Knowledge Base per domain in `Domain Knowledge Base Routing`.
5. Enable lead capture controls for your preferred flow.

## Domain Knowledge Base Routing (Required for Responses)

- Widget chats are routed by website domain (`website_domain` destination rows).
- Each domain should be assigned a specific Knowledge Base.
- If a domain is unmapped, has no KB assigned, or the assigned KB is unavailable/empty, the widget returns an explicit setup message instead of answering.
- This avoids accidental fallback to the wrong workspace knowledge when multiple sites/destinations exist.

## Lead Flow

1. Visitor starts chat in widget.
2. AI responds first, then evaluates intent and answer completion.
3. If eligible, the widget shows a compact lead CTA first (`Share details` / `No thanks`).
4. If strong intent and strong completion are detected, the lead form can appear directly.
5. Lead details are captured into workspace records for follow-up.

## Prompt Controls

Manage these in `Integrations -> Website`:

- `Minimum user messages before lead prompt eligibility`
- `Lead intent preset`: Conservative, Balanced, Aggressive
- `Lead intent scope`: Commercial only, or Commercial + escalation

## Session Dismiss Behavior

- Clicking `No thanks` suppresses lead prompts for the rest of that widget session.
- If the visitor ignores the CTA and sends another message, prompts are also suppressed for that session.
- Existing captured leads are not re-prompted in the same session.

## Session and Domain Binding

- Widget sessions are now scoped by `token + domain + session`.
- The widget bootstrap call issues a short-lived signed `sessionToken`.
- Chat and lead requests can use that signed token for host-bound validation.
- In strict rollout mode, unsigned or invalid session tokens are rejected.

## Lead Deduplication

- Lead submissions are deduplicated within a configurable time window.
- Primary key: `platform + sessionId`.
- Compatibility fallback: `platform + email` when session context is missing.
- Deduplicated submissions return the existing lead record with `deduplicated: true`.

## Browser Storage Fallback

- If `localStorage` is blocked by browser privacy settings, the widget falls back to in-memory state.
- In fallback mode, session continuity is preserved only for the current tab lifecycle.

## Limits

Website destination counts are enforced by plan entitlement.

## Knowledge Base Content Sources (Recommended)

You can populate the website KB using:

- manual text/FAQ/Q&A entries
- one-page URL snapshot imports (`URL` tab)
- managed `URL Sync` sources for path-prefix crawling and scheduled refresh
- file uploads (`.pdf`, `.docx`, `.xlsx`, `.pptx`, plus text formats)
