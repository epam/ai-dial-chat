## Why

The `announcement-banner-title-description` change delivered the banner line — a bold title and a description, truncated with an ellipsis. The same Figma frame (`-DIAL- Components 2.0`, node `467-1097`) shows the other half: a `+N announcements` pill between the description and the close control, opening a panel that lists individual announcements, each with its own title, description, and link.

Without it operators have exactly one announcement slot, and no way to surface a changelog entry, an event registration, and a release note at the same time — which is precisely what the design mocks up.

## What Changes

- Add an `ANNOUNCEMENTS` environment variable: a JSON array of `{ title, description?, link?: { label, href } }` entries.
- Add the `announcement.items` config-registry definition, an `EnvironmentVariables` entry, `AnnouncementItemDto` / `AnnouncementLinkDto`, and `announcements: AnnouncementItemDto[]` on `ClientConfigResponseDto`.
- Validate entries server-side with the same fail-soft contract the banner description uses: drop entries with a blank title, or with a link that is present but has a blank label or a non-`http(s)` href; sanitize each description with the existing announcement allowlist; log and drop rather than failing boot. Cap at 10 entries and log the excess.
- Extend `AppConfigContext` with `announcements: AnnouncementItem[]`, defaulting to `[]` while loading and on error, normalizing non-array values.
- Add a dedicated parse branch for `announcement.items` in `env-config.provider.ts`. The generic environment path performs no coercion for `valueType='json'`, so without it the raw string reaches the service and the array guard resolves it to an empty list — a valid config that silently produces no pill.
- Add `AnnouncementsPopover`: a count pill rendered in the banner between the text and the close control, built on the ui-kit `NeutralButton` with its ARIA state passed through, opening a popover list built on the ui-kit `Dropdown`. Closes on pill re-click, outside click, or `Escape` (returning focus to the pill).
- Render each row's link as a real anchor (`target="_blank"`, `rel="noopener noreferrer"`), since the ui-kit `Button` family renders `<button>` and cannot navigate.

## Open question — dismissal makes announcements unreachable

The pill lives inside the banner. The previous change deliberately kept **persistent** dismissal (`localStorage`, content-keyed) instead of the session-scoped behavior the Figma note describes. Together those mean a user who dismisses the banner loses the announcements list permanently, until an operator edits the content.

That tension is probably why the design specified session-scoped dismissal. This change implements the popover under the standing persistent-dismissal decision and surfaces the consequence rather than absorbing it. Three resolutions, for product:

1. Accept it — the banner is a teaser and announcements are not critical-path.
2. Switch the banner to session-scoped dismissal, matching the Figma note.
3. Keep persistent banner dismissal but surface the pill elsewhere once dismissed.

## Capabilities

### New Capabilities

- `announcements-popover`: the pill, the popover list, its interaction and accessibility contract, and the per-announcement row content model.

### Modified Capabilities

- `app-config-context`: `AppConfigState.config` gains `announcements: AnnouncementItem[]`.
- `client-config-endpoint`: `GET /api/v1/client-config` gains `announcements`, with entry validation and per-entry description sanitization.
- `config-registry-and-env-provider`: `CONFIG_DEFINITIONS` gains `announcement.items`, backed by `ANNOUNCEMENTS`.

The banner line gains a pill slot between the description and the close control, but that behaviour is specified inside the new `announcements-popover` capability (pill position, absence without announcements, absence in the legacy layout) rather than as a delta on `announcement-banner`. Keeping it in one place avoids two capabilities describing the same control.

## Impact

**Backend (`apps/chat-api`)** — `config/environment.config.ts`, `app-config/config-registry/config-registry.constants.ts`, new `app-config/dto/announcement-item.dto.ts`, `app-config/dto/client-config-response.dto.ts`, `app-config/app-config.service.ts` (reusing `html-sanitizer.ts` unchanged), plus service tests. OpenAPI regeneration and a `chat-api-client` rebuild.

**Frontend (`apps/chat`)** — new `models/announcement.ts`, new `components/AnnouncementsPopover/`, `context/AppConfigContext.tsx`, `components/AnnouncementBanner/AnnouncementBanner.tsx`, `constants/translation-keys.ts`, `i18n/locales/en.json`, and tests for each.

**Docs / ops** — `apps/chat-api/.env.template` and the deployment docs must document `ANNOUNCEMENTS`, its JSON shape, and the drop-and-log validation contract.

**Open item**

The Figma connector is still unauthorized, so popover width, row spacing, separators, pill styling, and the mobile presentation are reconstructed from screenshots. Structure and behavior are pinned; the visual tokens need the Figma pass.
