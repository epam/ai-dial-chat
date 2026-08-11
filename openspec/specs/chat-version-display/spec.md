# chat-version-display Specification

## Purpose
Surface the deployed chat version to users and support staff. The version is sourced from the `CHAT_VERSION` environment variable, flows through the app-config client response and context, and renders as a label in the footer strip.

## Requirements
### Requirement: Chat version is sourced from the CHAT_VERSION environment variable

The NestJS `app-config` module SHALL accept an optional `CHAT_VERSION` environment variable,
declared on `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) as
`@IsOptional() @IsString() CHAT_VERSION?: string`. It SHALL be registered in
`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`)
as:

| field | value |
| --- | --- |
| `key` | `app.version` |
| `type` | `config` |
| `valueType` | `string` |
| `visibility` | `client` |
| `defaultValue` | `null` |
| `critical` | `false` |
| `envVar` | `CHAT_VERSION` |
| `owner` | `chat-team` |

The value SHALL be resolved by the existing generic `envVar` branch of `EnvConfigProvider` — no
key-specific branch SHALL be added. It SHALL NOT be role-gated (`allowedRolesEnvVar` is absent),
and it SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

`AppConfigService.getClientConfig` SHALL resolve `app.version` and coalesce it: a resolved
string that is non-empty after trimming is used as-is (trimmed); otherwise the `APP_VERSION`
constant derived from `packageJson.version` is used. The result is therefore always a non-empty
string.

- **State ownership**: server-side only — `AppConfigService`; no new NestJS provider or module
- **Cache**: reuses the existing `app-config` response cache — key
  `app-config:client:<appId>:user:<userId>:roles:<roles>`, TTL 60 s, invalidated by TTL expiry
  and by process restart (deploy). No new cache entry and no new invalidation trigger.
- **Rate limiting**: none added — served by the existing `GET /api/v1/app-config` route under
  its current throttle configuration
- **Authorization**: same as the rest of the client config — any caller that may read
  `GET /api/v1/app-config`; the value is non-sensitive build metadata
- **Observability**: none — no new metric or log line; the version is not logged

#### Scenario: CHAT_VERSION is set

- **WHEN** `CHAT_VERSION=2026.08.10-a1b2c3d` is set in the environment
- **THEN** `GET /api/v1/app-config` returns `config.appVersion` equal to `"2026.08.10-a1b2c3d"`

#### Scenario: CHAT_VERSION is unset

- **WHEN** `CHAT_VERSION` is not present in the environment
- **THEN** `config.appVersion` equals the `version` field of `apps/chat-api/package.json`

#### Scenario: CHAT_VERSION is blank

- **WHEN** `CHAT_VERSION` is set to `""` or to whitespace only
- **THEN** `config.appVersion` falls back to `packageJson.version` rather than returning an
  empty or whitespace string

#### Scenario: CHAT_VERSION has surrounding whitespace

- **WHEN** `CHAT_VERSION=" 0.45.0 "` is set
- **THEN** `config.appVersion` equals `"0.45.0"`

#### Scenario: Version is not role-restricted

- **WHEN** a user with no roles and a user with role `admin` each request the client config
- **THEN** both receive the same non-empty `config.appVersion` value

---

### Requirement: Client config response exposes appVersion

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL
declare a required `appVersion!: string` property annotated with `@ApiProperty` (`type: String`,
non-nullable, with a description stating it is sourced from `CHAT_VERSION` and falls back to the
application's `package.json` version, and an example such as `0.45.0`). The field SHALL be
regenerated into `libs/chat-api-client` by `npm run openapi` and verified with
`npm run openapi:check`; generated files SHALL NOT be hand-edited.

Generated-client impact:

| aspect | value |
| --- | --- |
| operationId / SDK method | `getClientConfig` (unchanged — no new endpoint) |
| request DTO | none (GET, no body) |
| response DTO | `ClientConfigResponseDto` → `ClientConfigDto.appVersion: string` |
| frontend caller style | normal (non-`Raw`) generated method, via the existing
  `apps/chat/src/server-api/app-config.api.ts` wrapper |

Example response fragment for `GET /api/v1/app-config`:

```json
{
  "appId": "chat-ui",
  "features": { "footer": true },
  "config": {
    "appVersion": "0.45.0",
    "footerHtmlMessage": "<p>Need help? <a href=\"https://support.example.com\" target=\"_blank\" rel=\"noopener noreferrer\">Contact support</a>.</p>",
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880
  },
  "metadata": { "resolvedAt": "2026-08-10T09:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

Error codes are unchanged from the existing endpoint (`401` when the session is missing or
invalid, `500` on an unexpected resolution failure); this change introduces no new error path.

#### Scenario: appVersion present in the response payload

- **WHEN** `GET /api/v1/app-config` succeeds
- **THEN** the response body contains `config.appVersion` as a non-empty string

#### Scenario: OpenAPI artifact stays in sync

- **WHEN** `npm run openapi:check` runs after the DTO change and regeneration
- **THEN** it reports no drift between `apps/chat-api` Swagger metadata and
  `libs/chat-api-client/openapi.json`

---

### Requirement: App config context exposes appVersion to the frontend

`AppConfigState['config']` in `apps/chat/src/context/AppConfigContext.tsx` SHALL include
`appVersion: string`. `INITIAL_STATE` SHALL set it to `''`, and `loadConfig` SHALL read it as
`response.config?.appVersion ?? ''`, mirroring the existing `footerHtmlMessage` handling.

- **State ownership**: `AppConfigContext` — no new context or hook is introduced
- **Memoisation**: none added — the context value is already `useMemo`-wrapped; `appVersion` is
  a primitive string and requires no `useMemo`/`useCallback` at consumers
- **i18n keys**: none for this requirement (the value is a version string, not translated copy)
- **RTL impact**: none — this requirement is data-only
- **Feature flag**: none — not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`

#### Scenario: Version available after config loads

- **WHEN** the client config request resolves with `config.appVersion` set to `"0.45.0"`
- **THEN** `useAppConfig().config.appVersion` returns `"0.45.0"` and
  `useAppConfig().status` is `UserConfigStatus.Ready`

#### Scenario: Version empty while loading

- **WHEN** the client config request has not yet resolved
- **THEN** `useAppConfig().config.appVersion` is `''`

#### Scenario: Version empty when config fails

- **WHEN** the client config request fails and `status` becomes `UserConfigStatus.Error`
- **THEN** `useAppConfig().config.appVersion` remains `''`

---

### Requirement: Version label renders in the footer strip

`FooterMessage` (`apps/chat/src/components/FooterMessage/FooterMessage.tsx`) SHALL render the
chat version as a text label at the inline-end of the footer region whenever
`useAppConfig().status` is `UserConfigStatus.Ready` and `config.appVersion` is a non-empty
string after trimming. The label SHALL NOT depend on the `footer` feature flag or on
`footerHtmlMessage`. A `config.appVersion` that is absent or blank SHALL hide the label, never
raise — `FooterMessage` renders on every conversation route, so cosmetic chrome must not be
able to crash it.

The label SHALL be a non-interactive block element that:

- carries `text-end` and `pointer-events-none`, so it can never intercept clicks on the footer
  message's links;
- is absolutely positioned within the footer `<section>` (which becomes `relative`) using the
  logical inset utility `end-*` **only when the footer message is also rendering**. With no
  message the section has no in-flow child, its box collapses to its own padding, and an
  absolutely positioned label would paint outside it — so in that case the label renders in
  normal flow instead;
- **inherits page direction** — it MUST NOT carry a `dir` attribute. CSS logical insets resolve
  against the element's own direction, so a `dir="ltr"` here would compute `end-*` to `right`
  and defeat the RTL corner flip;
- contains two children: an `sr-only` span carrying the translated, interpolated version string,
  and an `aria-hidden` span carrying the visible `formatAppVersion(version)` glyph run with
  `dir="ltr"` so the bidi algorithm cannot reorder it under an RTL ancestor.

The operator's sanitized footer HTML SHALL move from the `<section>` root into a child element,
so that message and version are siblings and the message keeps its full-width `text-center`
alignment unshifted by the label's width.

- **State ownership**: `AppConfigContext` (read-only consumption); no local state added
- **i18n keys**: `footerMessage.versionAriaLabel` — English value
  `"Application version {{version}}"`, declared as `FooterMessageI18nKeys.VersionAriaLabel` in
  `apps/chat/src/constants/translation-keys.ts` and added to
  `apps/chat/src/i18n/locales/en.json`. The visible glyph run is not translated.
- **RTL impact**: required — position uses the logical `end-*` utility (never `right-*`) on an
  element that inherits direction; only the inner glyph span sets `dir="ltr"`; no directional
  icon is involved, so no mirroring
- **Memoisation**: `FooterMessage` stays wrapped in `memo`; the existing `useMemo` over
  `sanitizeFooterHtml` is unchanged. No new memoisation is required for the label.
- **Accessibility**: the accessible name is carried by real `sr-only` text rather than an
  `aria-label` on the visible run — ARIA prohibits naming the implicit `generic` role of a bare
  `<span>`. No `aria-live` region (the value never changes within a session); contrast inherits
  the strip's existing secondary/muted treatment
- **Feature flag**: none — deliberately ungated
- **Observability**: none

#### Scenario: Version renders with no footer message configured

- **WHEN** `config.appVersion` is `"0.45.0"`, `footerHtmlMessage` is `''`, and the `footer`
  feature flag is off
- **THEN** the footer region renders and contains the text `v0.45.0`

#### Scenario: Version renders alongside a footer message

- **WHEN** `config.appVersion` is `"0.45.0"`, the `footer` flag is on, and `footerHtmlMessage`
  is non-empty
- **THEN** the footer region contains both the sanitized message content and the text `v0.45.0`

#### Scenario: Nothing renders when there is neither message nor version

- **WHEN** `config.appVersion` is `''` and `footerHtmlMessage` is `''`
- **THEN** `FooterMessage` renders `null`

#### Scenario: Nothing renders while config is loading

- **WHEN** `useAppConfig().status` is `UserConfigStatus.Loading`
- **THEN** `FooterMessage` renders `null` regardless of `appVersion`

#### Scenario: Blank version is treated as absent

- **WHEN** `config.appVersion` is whitespace only and `footerHtmlMessage` is `''`
- **THEN** `FooterMessage` renders `null`

#### Scenario: Screen reader announces the version meaningfully

- **WHEN** the version label renders with `appVersion` `"0.45.0"`
- **THEN** the translated `footerMessage.versionAriaLabel` string with `version` interpolated as
  `0.45.0` is present as readable text, and the abbreviated glyph run `v0.45.0` is `aria-hidden`

#### Scenario: Label does not block footer links

- **WHEN** the version label renders over the footer message area
- **THEN** the label element carries `pointer-events-none`, leaving the message's anchors clickable

#### Scenario: Label stays inside the footer region with no message

- **WHEN** the version label renders and no footer message is rendering
- **THEN** the label is in normal flow (not absolutely positioned), so it paints inside the
  section's own box rather than above its collapsed height

#### Scenario: Label pins to the inline-end corner in both directions

- **WHEN** the version label renders alongside a footer message
- **THEN** under `dir="ltr"` its glyphs sit against the section's inline-end (right) padding
  edge, and under `dir="rtl"` they sit against the section's inline-end (left) padding edge,
  with the glyph order unchanged in both

---

### Requirement: Version string is normalised for display

`apps/chat/src/utils/footer-message.ts` SHALL export a `formatAppVersion` arrow function that
trims the input and prefixes it with a lowercase `v` unless the trimmed value already begins
with `v` or `V`. It SHALL be used by `FooterMessage` for the visible glyph run. The unprefixed
(trimmed) version value SHALL be used for the screen-reader text interpolation.

#### Scenario: Bare version gets a v prefix

- **WHEN** `formatAppVersion('0.45.0')` is called
- **THEN** it returns `'v0.45.0'`

#### Scenario: Already-prefixed version is not double-prefixed

- **WHEN** `formatAppVersion('v0.45.0')` or `formatAppVersion('V0.45.0')` is called
- **THEN** it returns the input unchanged (`'v0.45.0'` / `'V0.45.0'`)

#### Scenario: Surrounding whitespace is trimmed

- **WHEN** `formatAppVersion('  0.45.0  ')` is called
- **THEN** it returns `'v0.45.0'`

#### Scenario: Pre-release and build-stamped versions pass through

- **WHEN** `formatAppVersion('2026.08.10-a1b2c3d')` is called
- **THEN** it returns `'v2026.08.10-a1b2c3d'` with no parsing or validation applied
