## Why

The announcement banner today renders a single operator-authored HTML string as one centered line of text. Operators who want to announce something substantial — a release, a new model, a maintenance window — have no way to separate a heading from the body copy, so they cram everything into one line of inline HTML.

The redesigned banner (Figma `-DIAL- Components 2.0`, node `467-1097`) splits the banner line into a bold title followed by supporting description text, start-aligned rather than centered, truncated with an ellipsis when it exceeds the available width. The backend and the app need matching configuration to feed those two fields.

## What Changes

- Add two operator-facing environment variables surfaced through the existing app-config pipeline:
  - `ANNOUNCEMENT_TITLE` — short bold banner heading (plain text, e.g. `🎉 Welcome to DIAL! 🎉`).
  - `ANNOUNCEMENT_DESCRIPTION` — supporting body copy (sanitized HTML, same allowlist as the existing message).
- Add matching `config-registry` definitions (`announcement.title`, `announcement.description`), `EnvironmentVariables` validation entries, and `ClientConfigResponseDto` fields (`announcementTitle`, `announcementDescription`), with the description sanitized server-side.
- Extend `AppConfigContext` to expose both fields with `null` defaults during loading and on error.
- Redesign `AnnouncementBanner` to render the title and description on one start-aligned line, truncating with an ellipsis when the text exceeds the available space, with the close control at the end — per the Figma frame, mobile-first and RTL-correct.
- **Keep `ANNOUNCEMENT_HTML_MESSAGE` working.** When neither new value is configured, the banner renders the centered single-line legacy layout, structurally unchanged though restyled onto the redesigned surface. No deployment breaks on upgrade; this is not a breaking change.
- Extend content-keyed dismissal to cover the title and description as well as the legacy message, so changing any part of the announcement re-shows the banner. A legacy-only announcement keeps producing the same stored value it does today, so existing dismissals survive the upgrade.

**Dismissal stays persistent.** The Figma note describes the banner returning on the next browser session; this change deliberately keeps today's shipped behavior — content-keyed `localStorage`, dismissed until the operator changes the text — rather than regressing users who dismissed a banner expecting it to stay gone. Revisit only if product explicitly wants the session-scoped behavior.

## Deferred to a follow-up change

The same Figma frame shows an **announcements popover**: a `+N announcements` pill between the description and the close control that opens a list of announcements, each with its own title, description, and link (`Changelog`, `Register`), closing on pill-click or outside-click. That is a separate feature with its own list-shaped configuration (`ANNOUNCEMENTS` JSON array), its own popover interaction model, and its own read/unread semantics. It is deliberately **not** in this change. The observed behavior is recorded in `design.md` so nothing is lost.

## Capabilities

### New Capabilities

None. This extends existing capabilities rather than introducing a new one.

### Modified Capabilities

- `announcement-banner`: banner content model gains a title and a description; layout changes from a single centered line to a start-aligned title + description line with ellipsis truncation; the legacy HTML message becomes a documented fallback; dismissal keys on the whole payload rather than the HTML string alone.
- `app-config-context`: `AppConfigState.config` gains `announcementTitle: string | null` and `announcementDescription: string | null` with loading/error defaults.
- `client-config-endpoint`: the `config` object of `GET /api/v1/client-config` gains the two new fields, with server-side sanitization of the description.
- `config-registry-and-env-provider`: `CONFIG_DEFINITIONS` gains `announcement.title` and `announcement.description`, backed by two new optional `EnvironmentVariables` entries.

## Impact

**Backend (`apps/chat-api`)**

- `src/config/environment.config.ts` — two new validated optional vars.
- `src/app-config/config-registry/config-registry.constants.ts` — two new client-visible definitions.
- `src/app-config/dto/client-config-response.dto.ts` — two new response fields.
- `src/app-config/app-config.service.ts` — resolution and description sanitization; the footer's `sanitize-html` pass gets extracted into a shared helper.
- `src/app-config/tests/app-config.service.spec.ts` — coverage for populated, blank, and unsafe values.
- OpenAPI contract changes → `npm run openapi`, `npm run openapi:check`, rebuild `chat-api-client`.

**Frontend (`apps/chat`)**

- `src/context/AppConfigContext.tsx` and its tests.
- `src/components/AnnouncementBanner/AnnouncementBanner.tsx` (+ `.module.scss`, tests).
- `src/hooks/useAnnouncementDismissal/useAnnouncementDismissal.ts` (+ tests) — payload-keyed dismissal.
- `src/constants/translation-keys.ts` + `src/i18n/locales/en.json` — aria labels for the new region structure.
- `src/utils/` — shared helper computing the dismissal signature.

**Docs / ops**

- Deployment docs and release notes must list the two new environment variables.

**Open item**

The Figma MCP connector was not authorized when these artifacts were written; the layout is reconstructed from screenshots of node `467-1097`, which fix the structure (bold title, inline description, start alignment, ellipsis truncation, trailing close control) but not the exact spacing, colors, typography tokens, or the mobile variant. Implementation must open the frame via the `figma` skill and reconcile those before the styling is final.
