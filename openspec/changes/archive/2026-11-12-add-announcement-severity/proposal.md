## Why

Entries of the `ANNOUNCEMENTS` environment variable (`config.announcements` in `GET /api/v1/client-config`) carry only `title`, `description` and `link`, so a client cannot tell a maintenance or outage notice from an ordinary news item. The AI DIAL Launchpad home page design shows "Upcoming maintenance: DIAL 1.49" with a warning icon, and Launchpad cannot render it without guessing from the title text ([#9715](https://github.com/epam/ai-dial-chat/issues/9715)).

## Problem

There is no structured signal for how urgent an announcement is. `normalizeAnnouncements` (`apps/chat-api/src/app-config/announcements.normalizer.ts:77`) destructures only `title`, `description` and `link`, and `AnnouncementItemDto` (`apps/chat-api/src/app-config/dto/announcement-item.dto.ts`) declares nothing else, so any extra key an operator writes is silently discarded.

## What Changes

- `ANNOUNCEMENTS` entries accept an optional `severity` key with the values `info` (default) and `warning`. The value set is a string enum, so `error` can be added later without changing the field's shape.
- `normalizeAnnouncements` resolves the severity of every accepted entry:
  - absent or `null` → `info`, no warning;
  - `info` / `warning` (surrounding whitespace and letter case ignored) → that value;
  - anything else (unknown string, number, object) → `info` with exactly one warning naming the entry and the rejected value. The entry is **kept** — a typo must never hide an announcement, unlike an invalid `link`, which drops the entry.
- `AnnouncementItemDto` gains a required `severity` field declared with `enum` + `enumName: 'AnnouncementSeverity'`, so the generated `@epam/ai-dial-chat-api-client` exposes an `AnnouncementSeverity` const and `AnnouncementItemDto.severity`. The OpenAPI document and generated client are regenerated, not hand-edited.
- `@epam/ai-dial-chat-hooks` adds a string enum `AnnouncementSeverity` (`Info = 'info'`, `Warning = 'warning'`), an optional `severity?: AnnouncementSeverity` on `AnnouncementListItem`, and a pure `mapAnnouncementSeverity` adapter from the generated DTO union to the lib enum (follows `mapProjectSource` in `libs/chat-hooks/src/project/project-mapping.ts:27-35`).
- `AppConfigContext` maps each `config.announcements` entry's severity through that adapter, because a TS string enum is not assignable from the generated string-literal union.
- `buildAnnouncementSignature` keeps signing only `title`, `description` and `link` per entry. Chat does not render severity, and signing it would change the stored dismissal signature of every deployment that configures `ANNOUNCEMENTS`, re-showing banners users already closed.
- Docs: `apps/chat-api/README.md` `ANNOUNCEMENTS` row, `apps/chat-api/.env.template` example, `libs/chat-hooks/README.md` announcement-helpers section.

Not breaking: `severity` is additive on the response, optional on the lib type, and existing `ANNOUNCEMENTS` values keep working and are returned as `info`.

## Non-goals

- Rendering severity in Chat. The popover (`apps/chat/src/components/AnnouncementsPopover/AnnouncementsPopover.tsx`) stays unchanged; rendering is each client's decision. No new user-visible strings, so no i18n impact.
- An `error` value now — only reserved by the enum shape.
- Severity for the single-banner fields (`ANNOUNCEMENT_TITLE` / `ANNOUNCEMENT_DESCRIPTION` / `ANNOUNCEMENT_HTML_MESSAGE`).
- Changes to the env admission step (`apps/chat-api/src/app-config/env-admission/announcements.admission.ts`), which only parses the JSON array; entry validation stays in the normalizer.

## Alternatives considered

- **Drop entries with an unknown severity** (consistent with invalid `link`) — rejected: the issue explicitly wants a typo to never hide an announcement, and severity is decoration, not a call to action that would be silently lost.
- **Return `severity` only when set (optional/nullable in the DTO)** — rejected: every client would need its own `?? 'info'` default; the server normalizing to a required value is the contract the acceptance criteria describe.
- **Free-form string instead of an enum** — rejected: clients could not exhaustively switch on it, and the issue asks for a string enum in the lib.
- **Sign severity in the dismissal signature** — rejected for now (see What Changes); revisit if Chat starts rendering it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `client-config-endpoint`: the validated announcements list requirement gains per-entry `severity` resolution (default, accepted values, unknown-value fallback with a warning) and the DTO enum metadata.
- `app-config-context`: the announcements list requirement states that each entry's severity is mapped onto the `AnnouncementSeverity` lib enum.
- `announcement-banner`: the dismissal-signature requirement states explicitly that an entry's `severity` is not part of the signature.

## Acceptance criteria

- Existing `ANNOUNCEMENTS` values without `severity` keep working unchanged and every entry is returned with `severity: "info"`.
- `"severity": "warning"` is returned as `warning` for that entry in `config.announcements`.
- An unknown severity is logged once per entry and returned as `info`; the entry is still present.
- The generated client exposes `AnnouncementSeverity` and `AnnouncementItemDto.severity`; `npm run openapi:check` passes.
- `@epam/ai-dial-chat-hooks` exports `AnnouncementSeverity` and `mapAnnouncementSeverity`; `AnnouncementListItem.severity` is optional.
- Existing stored dismissal signatures still match after deploy (signature unchanged for unchanged content).
- Unit tests cover absent, valid (incl. case/whitespace), and unknown values in the normalizer, the lib mapper, and the context mapping.
- `npm run validate:docs` and `npm run validate:specs` pass.

## Rollback / compatibility

Additive and backward-compatible in both directions: older clients ignore the extra response field, and an operator value with `severity` deployed on an older backend is simply discarded as today. Revert is a plain code revert plus OpenAPI regeneration; no data or storage migration.

## Impact

- **Backend (`apps/chat-api`)**: `announcements.normalizer.ts`, `dto/announcement-item.dto.ts`, a new `dto/announcement-severity.enum.ts`, `tests/announcements.normalizer.spec.ts`; `README.md`, `.env.template`.
- **Generated client (`libs/chat-api-client`)**: regenerated `openapi.json` and models.
- **Lib (`libs/chat-hooks`)**: `src/conversation/announcement-message.ts`, its tests, `README.md`. Scope note: this touches a shared lib, but only with a type, an enum and a pure mapper. The lib still learns nothing about the endpoint, env variable or app config — the app passes the already-fetched DTO value to `mapAnnouncementSeverity`, which the `chat-hooks` isolation exception already permits (generated-client types only).
- **App (`apps/chat`)**: `src/context/AppConfigContext.tsx` mapping and its tests. No new context, provider or UI.
