## Why

The original AI DIAL Chat (Next.js `development` branch) shows a full-width **announcement banner** at the top of the app for operator-authored notices (e.g. a welcome message or a service notice). The chat 2.0 rewrite (`development-1.0`) has no equivalent, so operators have no way to surface a global message. GitHub issue [#7335](https://github.com/epam/ai-dial-chat/issues/7335) ("[AI DIAL Chat Next Generation] Banner — Add Banner for application (env var or Feature)", milestone `first-release`) asks to bring this behavior back.

## What Changes

- Add an operator-set environment variable `ANNOUNCEMENT_HTML_MESSAGE` in `apps/chat-api`, surfaced to the SPA as a new client-config value `announcement.html` (`config.announcementHtml`) through the existing app-config pipeline — mirroring how `dialCore.externalUrl` was added.
- Add a full-width **announcement banner** pinned to the top of the app chrome that renders the operator message when it is non-empty.
- **Content-keyed dismissal:** the banner has a close button; the exact dismissed message text is persisted in `localStorage`. The banner stays hidden only while the current message equals the stored one, so changing the message text automatically re-shows the banner (no version counter needed). Unset/empty message = banner off.
- **Sanitized HTML:** the message keeps HTML authoring (as in the old app) but is sanitized with DOMPurify (already a dependency) in the app before rendering, closing the XSS vector the old implementation left open (inline handlers, `javascript:` URLs).
- Presentational banner component lives in `libs/chat-shared` (props only — no config/storage/i18n knowledge); a thin container in `apps/chat` wires config, dismissal, i18n labels, and sanitization (library-isolation rule).

## Capabilities

### New Capabilities
- `announcement-banner`: Full-width, top-of-app banner that renders an operator-configured message, is dismissible with content-keyed persistence, sanitizes HTML content, and is RTL/AAA-accessible. Covers the presentational lib component and the app-level wiring/dismissal.

### Modified Capabilities
- `config-registry-and-env-provider`: registry gains an `announcement.html` entry (`type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `envVar='ANNOUNCEMENT_HTML_MESSAGE'`).
- `client-config-endpoint`: `GET /api/v1/client-config` response `config` gains an `announcementHtml: string | null` field.
- `app-config-context`: `AppConfigState.config` gains `announcementHtml: string | null`, populated from the client-config response (defaults to `null`).

## Impact

- **Backend (`apps/chat-api`):** `config/environment.config.ts` (new env var), `app-config/config-registry/config-registry.constants.ts` (new definition), `app-config/app-config.service.ts` (resolve + include in response), `app-config/dto/client-config-response.dto.ts` (`ClientConfigDto` field). Requires OpenAPI regeneration of `@epam/chat-api-client`.
- **Frontend (`apps/chat`):** `context/AppConfigContext.tsx` (new config field), `types/storage-key.ts` (`TextOfClosedAnnouncement` key), new `hooks/useAnnouncementDismissal/`, new `components/AnnouncementBanner/` container, `app/app.tsx` (mount at top of chrome, wrap root in a column), `constants/translation-keys.ts` + `i18n/locales/en.json` (aria-label keys).
- **Shared lib (`libs/chat-shared`):** new presentational `components/AnnouncementBanner/` + barrel export.
- **Dependencies:** none added — DOMPurify `3.4.11` is already installed at the repo root.
- **Config/ops:** operators gain `ANNOUNCEMENT_HTML_MESSAGE`; documented alongside other `chat-api` env vars.
