## Why

The chat application version is currently only reachable if an operator hand-authors a
`FOOTER_HTML_MESSAGE` containing the `%%VERSION%%` token
(`apps/chat-api/src/app-config/app-config.service.ts:32`), and that token always resolves to
`apps/chat-api/package.json`'s `version` field
(`apps/chat-api/src/app-config/app-config.service.ts:24`). Two problems follow:

1. Deployments that build from a CI/CD pipeline cannot surface the *deployed* build version —
   the bundled `package.json` version is whatever was committed, not what shipped.
2. Support and QA cannot ask "what version are you on?" unless the operator happened to embed
   the token in their footer copy. On a deployment with no `FOOTER_HTML_MESSAGE` there is no
   version anywhere in the UI.

The design (see the attached screenshot) puts a small version label in the bottom inline-end
corner of the footer strip, independent of the operator's footer copy.

## What Changes

- **New env var `CHAT_VERSION`** on `apps/chat-api/src/config/environment.config.ts`
  (`@IsOptional() @IsString()`), letting operators/CI inject the deployed version string.
- **New config-registry entry `app.version`** in
  `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`
  (`type: 'config'`, `valueType: 'string'`, `visibility: 'client'`, `envVar: 'CHAT_VERSION'`),
  resolved by the existing generic `envVar` path in `EnvConfigProvider` — no new branch needed.
- **Fallback**: when `CHAT_VERSION` is unset or empty, `AppConfigService` falls back to the
  `APP_VERSION` constant it already derives from `packageJson.version`, so `appVersion` is
  always a non-empty string. The `%%VERSION%%` footer token keeps its current behaviour and
  starts resolving from the same source, so `CHAT_VERSION` also overrides the token.
- **New `appVersion` field** on `ClientConfigDto`
  (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) → regenerated into
  `libs/chat-api-client` via `npm run openapi`.
- **New `config.appVersion`** on `AppConfigState` in
  `apps/chat/src/context/AppConfigContext.tsx` (follows the existing `footerHtmlMessage`
  pattern at `AppConfigContext.tsx:95`).
- **`FooterMessage` renders the version label** at
  `apps/chat/src/components/FooterMessage/FooterMessage.tsx` — absolutely positioned in the
  inline-end corner of the footer `<section>`, with the operator's centered footer HTML
  unchanged in the normal flow.
- **Visibility decoupling**: `FooterMessage` currently returns `null` unless the `footer`
  feature flag is on *and* the sanitized HTML is non-empty. It will now render the section
  when *either* the footer message *or* the version label has something to show. The footer
  HTML itself stays gated on `useFeatureFlag('footer')` exactly as today; the version label is
  not gated.
- **New i18n key** `footerMessage.versionAriaLabel` in
  `apps/chat/src/i18n/locales/en.json` + a matching `FooterMessageI18nKeys` member.
- **Docs**: `apps/chat-api/.env.template` and `apps/chat-api/README.md` env tables.

Not breaking. `appVersion` is an additive response field; older frontends ignore it. Rollback
is removing the registry entry, the DTO field, and the JSX block — no data migration, no
persisted state.

**Alternatives considered.** (a) Keep using only `%%VERSION%%` inside `FOOTER_HTML_MESSAGE` —
rejected: it forces every operator to author HTML just to see a version, and CI still cannot
override the built-in `package.json` value. (b) Inject the version at build time via a Vite
`define`/`import.meta.env` constant in `apps/chat` — rejected: the version would be frozen
into the JS bundle, so a re-tagged image could not change it without a rebuild, and it would
bypass the config registry that every other operator-tunable value already flows through.
(c) A dedicated `GET /api/v1/version` endpoint — rejected as scope creep: `app-config` is
already fetched once at startup, already cached (60 s), and already the documented home for
client-visible config.

**Scope flags.** No `libs/*` change other than the *generated* `libs/chat-api-client`
regeneration (the documented OpenAPI-client exception). No global provider is added —
`AppConfigContext` already exists and simply gains one field. New user-visible string: one
`aria-label` only; the label text itself is a version string, not translated copy.

**Assumptions** (stated, not verified against an operator): `CHAT_VERSION` is a short opaque
string (e.g. `0.45.0`, `0.45.0-rc.3`, `2026.08.10-a1b2c3d`); it is rendered as text, never as
HTML, so no sanitization pipeline is needed beyond React's own escaping.

## Capabilities

### New Capabilities

- `chat-version-display`: sourcing the deployed chat version from the `CHAT_VERSION` env var
  through the app-config registry to the client, and rendering it as a version label in the
  footer strip.

### Modified Capabilities

- `footer-message`: the footer region is no longer hidden purely because the sanitized footer
  HTML is empty — it also renders when a version label is available, and the region now
  contains two children (centered message + end-corner version) instead of being a single
  `dangerouslySetInnerHTML` host.

## Impact

**Backend (`apps/chat-api`)**

- `src/config/environment.config.ts` — `CHAT_VERSION?: string`
- `src/app-config/config-registry/config-registry.constants.ts` — `app.version` definition
- `src/app-config/app-config.service.ts` — resolve `app.version`, fall back to `APP_VERSION`,
  use the resolved value for `%%VERSION%%` substitution
- `src/app-config/dto/client-config-response.dto.ts` — `appVersion!: string`
- `src/app-config/tests/app-config.service.spec.ts` — new cases
- `.env.template`, `README.md`

**Generated client (`libs/chat-api-client`)**

- `openapi.json` + `src/generated/**` regenerated by `npm run openapi`; verified with
  `npm run openapi:check`; then `npm exec nx build chat-api-client` + `nx lint chat-api-client`.
  No hand edits.

**Frontend (`apps/chat`)**

- `src/context/AppConfigContext.tsx` — `appVersion` on `AppConfigState['config']` + initial state
- `src/components/FooterMessage/FooterMessage.tsx` — layout restructure + version label
- `src/components/FooterMessage/tests/FooterMessage.spec.tsx` — updated + new cases
- `src/utils/footer-message.ts` — `formatAppVersion` helper (+ its spec)
- `src/constants/translation-keys.ts`, `src/i18n/locales/en.json` — one new key

**Not affected**: auth, routing, caching strategy (the existing 60 s `app-config` cache TTL and
its `app-config:client:<appId>:user:<userId>:roles:<roles>` key are reused unchanged),
`ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` (the version label is deliberately ungated).
