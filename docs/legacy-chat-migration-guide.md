# Migrating from the Legacy DIAL Chat

This is the entry point for teams moving a deployment from the legacy DIAL Chat
(`epam/ai-dial-chat`, 0.x) to this application (1.0). It covers what changes for
an operator — configuration, authentication, feature flags, themes, embedding,
and existing user data — and links to the detailed guide for each area.

It does **not** cover moving data between DIAL Core instances. Both chats read
and write the same DIAL Core storage, so a migration in place keeps its data;
see [User data](#user-data) for what 1.0 does with it.

## What changed at a glance

| Area                 | Legacy chat                                                        | 1.0                                                                         |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Runtime              | Next.js app with API routes                                        | React SPA (`apps/chat`) + NestJS BFF (`apps/chat-api`)                      |
| Configuration        | Read by both server and browser, `NEXT_PUBLIC_*` baked in at build | Read only by `chat-api`, served to the browser at runtime                   |
| Authentication       | NextAuth in the Next.js app                                        | Server-side OIDC with an encrypted session cookie, no tokens in the browser |
| Storage              | DIAL Core                                                          | DIAL Core — unchanged                                                       |
| Conversation folders | Supported                                                          | Not yet — the list is flat; folders are planned                             |
| Marketplace          | `marketplace`                                                      | Catalog (`catalog`)                                                         |
| Overlay package      | `@epam/ai-dial-overlay`                                            | `@epam/ai-dial-chat-overlay`                                                |
| Themes               | `THEMES_CONFIG_HOST`, legacy token set, dark by default            | `THEMES_CONFIG_URL`, redesigned token set, light by default                 |

One operational consequence is worth stating on its own: **the frontend no
longer reads environment variables.** Everything is served by `chat-api` through
its client-configuration endpoint, so changing configuration is a restart of the
API, never a rebuild of the frontend image.

## Migration checklist

1. Stand up `chat-api` with DIAL Core access and at least one auth provider.
2. Port environment variables — see [Environment variables](#environment-variables).
3. Port UI feature flags — see [UI feature flags](#ui-feature-flags).
4. Port the themes configuration — see [Themes](#themes).
5. Port any embedded-overlay integration — see [Embedding](#embedding).
6. Point a non-production deployment at a copy of real storage and verify
   existing conversations — see [User data](#user-data).
7. Review the [capabilities not in 1.0 yet](#capabilities-not-in-10-yet) and
   decide what to do about the flows that depend on them.

## Environment variables

The full reference for the variables 1.0 accepts is
[`apps/chat-api/README.md`](../apps/chat-api/README.md#environment-variables),
alongside the annotated `apps/chat-api/.env.template`; the tables below only
describe what happens to a legacy deployment's variables. The source of truth is
`apps/chat-api/src/config/environment.config.ts`, validated at boot.

### Renamed or re-shaped

| Legacy                      | 1.0                                                        | Notes                                                                                  |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `DIAL_API_HOST`             | `DIAL_CORE_URL`                                            | Internal URL, never exposed to browsers.                                               |
| `NEXTAUTH_SECRET`           | `AUTH_SESSION_SECRET`                                      | Must be 64 hex characters (32 bytes) — generate a new one rather than reusing the old. |
| `NEXTAUTH_URL`              | `AUTH_CALLBACK_BASE_URL`                                   | Public base URL of the **API**, used to build OIDC redirect URIs.                      |
| `APP_BASE_ORIGIN`           | `CORS_ORIGIN`                                              | Origin of the browser application; also used by the CSRF origin check.                 |
| `IS_IFRAME`                 | `OVERLAY_ENABLED`                                          | `ALLOWED_IFRAME_ORIGINS` keeps its name and now also gates incoming `postMessage`.     |
| `ENABLED_FEATURES`          | `ENABLED_UI_FEATURES`                                      | Same replace semantics; several flag names changed — see below.                        |
| `THEMES_CONFIG_HOST`        | `THEMES_CONFIG_URL`                                        | Add `THEMES_SERVICE_TIMEOUT_MS` if 5 s is too tight.                                   |
| `DEFAULT_MODEL`             | `DEFAULT_DEPLOYMENT`                                       | Deployment id shown to users with no persisted selection.                              |
| `HIDDEN_ENTITY_TAG`         | `HIDDEN_ENTITY_TAGS`                                       | Now plural, comma-separated.                                                           |
| `PUBLICATION_FILTERS`       | `PUBLICATION_FILTER_SOURCES`                               | —                                                                                      |
| `ANNOUNCEMENT_HTML_MESSAGE` | kept, or `ANNOUNCEMENT_TITLE` + `ANNOUNCEMENT_DESCRIPTION` | The legacy variable still works; the structured form is opt-in.                        |

### Carried over unchanged

`DIAL_API_KEY`, `DIAL_API_VERSION`, `DIAL_CORE_EXTERNAL_URL`,
`ALLOWED_IFRAME_ORIGINS`, `CUSTOM_VISUALIZERS`, `ADMIN_ROLE_NAMES`,
`DIAL_ROLES_FIELD`, `FOOTER_HTML_MESSAGE`, `ASR_MODEL`, and every per-provider
`AUTH_{PROVIDER}_*` variable (Auth0, Azure AD, GitLab, Google, Keycloak, PingID,
Cognito, Okta) keep their names and meaning.

Two additions apply to all providers in 1.0: `AUTH_POST_LOGOUT_REDIRECT_URI` is
required once any provider is configured, and each provider can now override
roles handling with `AUTH_{PROVIDER}_ADMIN_ROLE_NAMES` and
`AUTH_{PROVIDER}_DIAL_ROLES_FIELD`. Azure B2C is newly supported.

### Dropped with no replacement

| Legacy variables                                                                                                                                                                                                                                                                    | Why                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT`, `NEXT_PUBLIC_DEFAULT_TEMPERATURE`, `NEXT_PUBLIC_RESOURCE_MAX_SEGMENT_BYTES`, `NEXT_PUBLIC_STAGE_CONTENT_LIMIT`, `APP_BASE_PATH`                                                                                        | The frontend reads no environment variables at all in 1.0.                                                                                                    |
| `AUTH_FORCE_STRICT`, `AUTH_ADDITIONAL_PARAMS`, `AUTH_TEST_TOKEN`, `ALLOW_TOKEN_IN_SESSION`, `SHOW_TOKEN_SUB`, `ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME`                                                                                                                                    | Auth moved server-side; the browser never holds a token. Same-window login in an iframe is now a per-provider overlay option instead of a global switch.      |
| `ALLOWED_IFRAME_SOURCES`, `ALLOWED_SCRIPT_SOURCES`                                                                                                                                                                                                                                  | CSP is managed by `helmet` in `chat-api`.                                                                                                                     |
| `STORAGE_TYPE`                                                                                                                                                                                                                                                                      | DIAL Core is the only storage backend.                                                                                                                        |
| `AVAILABLE_LOCALES`                                                                                                                                                                                                                                                                 | The locale set is not a deployment variable. English is the default, and adding a locale is a code change — locale JSON plus registration in the i18n config. |
| `THEME_DEFAULT_ID`                                                                                                                                                                                                                                                                  | The default is light, then the user's stored choice.                                                                                                          |
| `RECENT_MODELS_IDS`, `TOPICS`, `MAX_PROMPT_TOKENS_DEFAULT_PERCENT`, `MAX_PROMPT_TOKENS_DEFAULT_VALUE`, `ATTACHMENT_TYPES_EXPANDED`, `ATTACHMENT_TYPES_BORDERLESS`, `ATTACHMENT_TYPES_WITHOUT_TITLE`, `CODE_GENERATION_WARNING`, `CODE_EDITOR_PYTHON_VERSIONS`, `WIDGETS_SCHEMA_IDS` | The corresponding UI or behaviour has no successor yet. `FEATURED_MODEL_IDS` covers the catalog's featured list, which is not the same as recent models.      |
| `REPORT_ISSUE_CODE`, `REQUEST_API_KEY_CODE`, `TMS_URL`, `ISSUE_URL`, `AZURE_FUNCTIONS_API_HOST`                                                                                                                                                                                     | The report-an-issue and request-API-key dialogs were not migrated.                                                                                            |
| `QUICK_APPS_HOST`, `QUICK_APPS_MODEL`, `QUICK_APPS_SCHEMA_ID`, `EXTERNAL_APPS_SCHEMA_ID`, `CODE_APPS_ROLES`, `APPLICATION_VISUALIZERS`, `ALLOW_VISUALIZER_SEND_MESSAGES`                                                                                                            | Application authoring is configured differently; `DEV_QUICKAPPS_EDITOR_URL` is the only remaining QuickApps knob.                                             |

### Worth setting in 1.0

These have no legacy counterpart but change user-visible behaviour:
`AUTH_COOKIE_SECURE`, `OVERLAY_SANDBOX_ENABLED`, `RESPONSES_API_ENABLED`,
`SCHEDULED_TASKS_ENABLED` / `_ROLES`, `LIVE_CHAT_INTERACTION_ENABLED` / `_ROLES`,
`FILE_MANAGER_AVAILABLE_TABS`, `DEEP_RESEARCH_TOOL_ID`, `UTILITY_MODEL` with
`LLM_CONVERSATION_NAMING_ENABLED`, `ASR_ENABLED_ROLES`, `ANNOUNCEMENTS`,
`CHAT_VERSION`, and the `ARCHIVE_*` / `SKILL_*` transfer limits.

## Authentication

The provider variables mostly survive, but the mechanism is different: the
browser never receives a token, and `chat-api` holds the OIDC session in an
encrypted `HttpOnly` cookie, refreshing the access token transparently.
Practical consequences for a migration:

- Register the new redirect URI with every identity provider —
  `{AUTH_CALLBACK_BASE_URL}` now points at the API, not the web app.
- Existing sessions do not carry over. Users log in once after the switch.
- Provider configuration keeps the legacy shape: one set of discrete
  `AUTH_{PROVIDER}_*` variables per provider, registered when its `CLIENT_ID` is
  set. Per-provider tables with required fields, defaults, and issuer derivation
  are in `apps/chat-api/README.md` § "Auth provider environment variables".
- For a cross-site iframe deployment, set `AUTH_COOKIE_SECURE=true` so the
  session cookie is `SameSite=None; Secure`.

Design detail — cookie format, refresh, federated logout, `SessionGuard` — is in
[`docs/auth/`](./auth/).

## UI feature flags

`ENABLED_FEATURES` becomes `ENABLED_UI_FEATURES`, and the set of recognized
values changed: some flags were renamed (`marketplace` → `catalog`), some became
unconditional behaviour and are no longer accepted, and some have no successor
yet. Unrecognized entries are logged and dropped, so a legacy value silently
does nothing.

The authoritative tables — renamed, became unconditional, no successor, plus the
complete list of the 39 supported flags and which are on by default — are in the
[Chat Overlay Migration Guide § Migrate UI feature flags](chat-overlay-migration-guide.md#6-migrate-ui-feature-flags).
They apply to a plain deployment too, not only to embedded ones.

## Themes

The themes service and the `config.json` shape are unchanged, but the CSS
variable names the application reads were redesigned and the default palette is
now light. A legacy theme file loads without an error and applies almost
nothing — keys nothing reads are set silently, and every unset token falls back
to a light value.

[Theme Customization](theme-customization.md) has the configuration format, the
full token list, the legacy → new mapping, and the two capabilities with no
replacement (`additional_css` injection and the `custom-logo` flag).

## Embedding

Hosts embedding the chat replace `@epam/ai-dial-overlay` with
`@epam/ai-dial-chat-overlay`. The iframe + `postMessage` model is the same, but
the handshake, several method signatures, the message and conversation payload
shapes, and the feature-flag set all changed.

[Chat Overlay Migration Guide](chat-overlay-migration-guide.md) is the complete
path, and `apps/chat-overlay-sandbox` is a ready-made host page for verifying an
integration against a real deployment before touching your own.

## User data

Both chats store conversations in the same DIAL Core buckets, so a deployment
migrated in place keeps its data. What differs is how 1.0 presents it:

- **Conversations are listed recursively from the bucket root**, so items the
  legacy chat created inside folders still appear — as a flat list. Nothing is
  lost: the resources keep their paths, and folder support is planned, so the
  hierarchy is simply not rendered yet.
- **Playback and replay conversations have no UI yet.** The resources are
  untouched and nothing rewrites them; both modes are planned.
- **Publications and shares** continue to work through DIAL Core; the filter
  sources are configured with `PUBLICATION_FILTER_SOURCES`.

Validate against a copy of real storage before switching production over. A
conversation written by the legacy chat carries fields 1.0 does not read, and
the safest way to learn what that means for your content is to look at it.

## Capabilities not in 1.0 yet

Beyond the feature flags listed in the overlay guide, these legacy capabilities
are absent from 1.0 today. Most are planned — plan around their current absence,
not around their permanent loss.

| Capability                            | Status                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| Conversation folders                  | Planned — the conversation list is flat for now                     |
| Playback and replay                   | Planned                                                             |
| Compare mode                          | Planned                                                             |
| Report an issue / Request API key     | No successor planned                                                |
| Message custom buttons (overlay)      | No successor planned                                                |
| `additional_css` stylesheet injection | Replaced — restyle through theme tokens and the libs' styling props |

`additional_css` is the one with a deliberate replacement rather than a gap.
Deployment-wide colors belong in the theme configuration
([Theme Customization](theme-customization.md)); anything a token does not cover
is adjusted where the component is used, through each lib's
`styles={{ colors, typography }}` contract
([`openspec/lib-styling-guide.md`](../openspec/lib-styling-guide.md)). Both
survive an upgrade, which a stylesheet targeting generated class names does not.

Conversation import and export are available in 1.0 from the conversation panel,
though not through the overlay API.

## Related

- [Chat API](../apps/chat-api/README.md#environment-variables) — the full variable reference for 1.0
- [Chat Overlay Migration Guide](chat-overlay-migration-guide.md) — embedding and UI feature flags
- [Theme Customization](theme-customization.md) — theming and legacy theme migration
- [Architecture](architecture.md) — how 1.0 is put together
- [Auth subsystem](./auth/) — OIDC, session cookie, refresh, logout
