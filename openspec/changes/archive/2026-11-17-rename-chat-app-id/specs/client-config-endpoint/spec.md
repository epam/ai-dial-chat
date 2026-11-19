## MODIFIED Requirements

### Requirement: GET /api/v1/client-config returns client-safe configuration

The system SHALL expose `GET /api/v1/client-config` as a versioned business endpoint (version `'1'`). It SHALL accept a required `appId` query parameter that matches `^[a-z0-9][a-z0-9-]{0,62}$` and is one of the application identifiers the deployment serves (`CLIENT_CONFIG_APP_IDS`, default `ai-dial-chat`), and return all `visibility='client'` configuration values, including the new `dialCore.externalUrl` key added by the `config-registry-and-env-provider` capability.

**Authorization:** None required. The endpoint is public and MUST work before authentication.

**Caching:** In-memory cache via `@nestjs/cache-manager`. Cache key: `app-config:client:{encodedAppId}:user:{encodedUserId|anonymous}:roles:{sortedEncodedRoles|none}`, where each segment (and each role) is `encodeURIComponent`-encoded before joining. TTL: 60 seconds. Identity and roles MUST be included because role-gated flags can vary by caller. Future targeting dimensions MUST also be added to the cache key before they affect evaluation. When `MANAGED_CONFIG_MODE` is `active` and the `appId` is mapped to a Config Studio instance, the key SHALL end with `:managed:{encodedInstanceId}:{encodedRevisionId|none}:{state}`, so that a new revision and every change of managed state use a new entry. The TTL SHALL then be the smallest of 60 seconds, `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS` (so the request a tab sends at its hint is resolved again rather than answered with the cached hint), the time until the next `startsAt`/`endsAt` boundary of any active managed feature in the captured snapshot, and the time until that snapshot exceeds its maximum staleness, with a minimum of 1 second. In modes `off` and `shadow` the key and TTL SHALL be unchanged.

**operationId:** `getClientConfig` (handler method name on the controller).

**Feature flag:** Not gated.

**RTL impact:** None (backend-only).

**i18n impact:** None.

**Observability:** Latency and error rate captured by the existing `MetricsInterceptor`. Resolution debug log per key (key name + provider that resolved it). No config values in logs. Managed refresh and state metrics are defined by `managed-config-runtime-reader`.

#### Scenario: Happy path — ASR configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `ASR_MODEL=whisper-1`, `TRANSCRIBE_SIZE_LIMIT_BYTES=10485760` are set
- **THEN** the response is `200 OK` with body:
  ```json
  {
    "appId": "ai-dial-chat",
    "features": { "asrEnabled": true },
    "config": {
      "asrModelId": "whisper-1",
      "transcribeSizeLimitBytes": 10485760,
      "dialCoreExternalUrl": null
    },
    "metadata": {
      "resolvedAt": "<ISO timestamp>",
      "cacheTtlSeconds": 60
    }
  }
  ```

#### Scenario: Happy path — ASR not configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `ASR_MODEL` is not set
- **THEN** the response is `200 OK` with `features.asrEnabled=false`, `config.asrModelId=null`, `config.transcribeSizeLimitBytes=5242880`

#### Scenario: Happy path — DIAL Core external URL configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `DIAL_CORE_EXTERNAL_URL=https://dial.example.com` is set
- **THEN** the response is `200 OK` with `config.dialCoreExternalUrl="https://dial.example.com"`

#### Scenario: Happy path — DIAL Core external URL not configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `DIAL_CORE_EXTERNAL_URL` is not set
- **THEN** the response is `200 OK` with `config.dialCoreExternalUrl=null`

#### Scenario: External connection origins

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called with
  `ALLOWED_CONNECT_ORIGINS` configured
- **THEN** the `200 OK` JSON response includes `config.allowedConnectOrigins`
  as a string array preserving the configured exact origins and wildcard patterns
- **AND** an unset value resolves to `[]`; the field is optional in the generated
  response contract so clients can default to `[]` against an older backend
- **AND** the public endpoint, required `appId` query, `400` validation responses,
  private no-store HTTP header, and 60-second server cache remain unchanged

#### Scenario: Always returns 200 even on resolution failure

- **WHEN** all providers fail to resolve a non-critical key
- **THEN** the response is `200 OK` with the static default value for that key; no 500 is returned

#### Scenario: Missing appId returns 400

- **WHEN** `GET /api/v1/client-config` is called without `appId`
- **THEN** the response is `400 Bad Request` with a validation error message

#### Scenario: Unknown appId returns 400

- **WHEN** `GET /api/v1/client-config?appId=unknown-app` is called and `unknown-app` is not listed in `CLIENT_CONFIG_APP_IDS`
- **THEN** the response is `400 Bad Request`

#### Scenario: Malformed appId returns 400

- **WHEN** `appId` is `Chat_UI`, `-x`, a 64-character identifier, or is repeated in the query
- **THEN** the response is `400 Bad Request` with a validation message, before any configuration is resolved

#### Scenario: Another served application

- **WHEN** `CLIENT_CONFIG_APP_IDS=launchpad,ai-dial-chat` and `GET /api/v1/client-config?appId=launchpad` is called
- **THEN** the response is `200 OK` with `appId` `launchpad`, and its `features` and `config` equal those returned for `appId=ai-dial-chat` under the same environment, session and roles

#### Scenario: Responses are cached per application

- **WHEN** the same user requests `appId=launchpad` and then `appId=ai-dial-chat`
- **THEN** the two responses use different cache entries, each echoing its own `appId`

#### Scenario: Response does not contain server-only values

- **WHEN** the registry contains a `visibility='server'` key
- **THEN** that key MUST NOT appear anywhere in the `200 OK` response body

#### Scenario: Response does not contain secrets or context

- **WHEN** a valid response is returned
- **THEN** the body MUST NOT contain env var names, provider credentials, user IDs, roles, or internal metadata beyond `resolvedAt` and `cacheTtlSeconds`, and, in managed `active` mode, `nextRefreshAt` and `managed` (see "client-config carries optional managed fields")

#### Scenario: Response never exposes the internal DIAL_CORE_URL value

- **WHEN** a valid response is returned
- **THEN** the body MUST NOT contain the value of the internal `DIAL_CORE_URL` environment variable under any key

#### Scenario: A new managed revision uses a new cache entry

- **WHEN** the mode is `active`, `ai-dial-chat` is mapped to `chat-dev`, a user's response for revision `R1` is cached, and revision `R2` is accepted 10 s later
- **THEN** that user's next request misses the cache and reflects `R2`

#### Scenario: Cache entry never outlives a window boundary

- **WHEN** an active managed feature's `startsAt` is 20 s after the response is resolved
- **THEN** the entry's TTL is at most 20 s, and the first request after `startsAt` reflects the opened window

#### Scenario: Cache entry never outlives staleness

- **WHEN** the captured snapshot exceeds its maximum staleness 5 s after the response is resolved
- **THEN** the entry's TTL is at most 5 s, and the next response reports `metadata.managed.state` `stale`

#### Scenario: Cache key is unchanged outside active mode

- **WHEN** the mode is `off` or `shadow`
- **THEN** the cache key is `app-config:client:{appId}:user:{userId}:roles:{roles}` and the TTL is 60 s

### Requirement: Response DTO is fully annotated for Swagger and generated client

`ClientConfigResponseDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL use `@ApiProperty` on every field, including the new `config.dialCoreExternalUrl` field, so that the generated `@epam/ai-dial-chat-api-client` produces strongly-typed `AppConfigApi.getClientConfig()` with a concrete response type (not `void` or `any`).

**Generated client impact:**
- `operationId`: `getClientConfig`
- SDK method: `AppConfigApi.getClientConfig({ appId: 'ai-dial-chat' })`
- Request DTO: `GetClientConfigDto` with `appId: string`
- Response DTO: `ClientConfigResponseDto` with `appId`, `features`, `config` (now including `dialCoreExternalUrl: string | null`), `metadata`
- Frontend callers use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Generated client method is typed

- **WHEN** `npm run openapi` is run after the endpoint is added
- **THEN** `libs/chat-api-client/src/generated/src/apis/AppConfigApi.ts` EXISTS
- **AND** the `getClientConfig` method has a return type of `Promise<ClientConfigResponseDto>` (not `Promise<void>` or `Promise<any>`)

#### Scenario: Generated response type includes the new field

- **WHEN** `npm run openapi` is run after the endpoint is added
- **THEN** the generated `ClientConfigDto` type (the `config` property of `ClientConfigResponseDto`) includes `dialCoreExternalUrl: string | null`

---

### Requirement: client-config exposes overlay eligibility

`GET /api/v1/client-config` SHALL include two additional `visibility='client'` keys under `config`: `overlayEnabled: boolean` (sourced from `EnvironmentVariables.OVERLAY_ENABLED`, default `false`) and `overlayAllowedOrigins: string[]` (sourced from `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS`, default `[]`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add `@ApiProperty` fields for both keys so the generated `@epam/ai-dial-chat-api-client` types them concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Overlay disabled by default

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `OVERLAY_ENABLED` is unset
- **THEN** the response includes `config.overlayEnabled: false` and `config.overlayAllowedOrigins: []`

#### Scenario: Overlay enabled with configured origins

- **WHEN** `OVERLAY_ENABLED=true` and `ALLOWED_IFRAME_ORIGINS=https://partner.example.com` are set
- **THEN** the response includes `config.overlayEnabled: true` and `config.overlayAllowedOrigins: ["https://partner.example.com"]`

#### Scenario: Generated client type includes both fields

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type (the `config` property of `ClientConfigResponseDto`) includes `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`

#### Scenario: overlayAllowedOrigins never leaks server-only origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` also happens to include an origin used for a purpose unrelated to overlay embedding
- **THEN** the response still returns the same allowlist verbatim — this key is defined as client-visible by design (the host page must know it is on the allowlist to self-diagnose), matching the existing `frame-src`/`frame-ancestors` use of this same variable, which is already effectively public (observable via the CSP response header)

### Requirement: client-config exposes enabledUiFeatures

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `enabledUiFeatures: string[] | null` (sourced from `EnvironmentVariables.ENABLED_UI_FEATURES`, filtered to recognized `OverlayFeature` values per `config-registry-and-env-provider`, default `null`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `enabledUiFeatures: string[] | null` with `nullable: true` so the generated `@epam/ai-dial-chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `enabledUiFeatures: string[] | null`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: No baseline configured — null returned

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `ENABLED_UI_FEATURES` is unset
- **THEN** the response includes `config.enabledUiFeatures: null`

#### Scenario: Baseline configured — array returned

- **WHEN** `ENABLED_UI_FEATURES=header,likes,hide-new-conversation` is set
- **THEN** the response includes `config.enabledUiFeatures: ["header", "likes", "hide-new-conversation"]`

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type (the `config` property of `ClientConfigResponseDto`) includes `enabledUiFeatures: string[] | null`

#### Scenario: Response never includes unrecognized entries

- **WHEN** `ENABLED_UI_FEATURES` includes a value that is not a member of `OverlayFeature`
- **THEN** the response's `config.enabledUiFeatures` array omits that value (filtered per `config-registry-and-env-provider`)

#### Scenario: A deprecated entry is returned under its current name

- **WHEN** `ENABLED_UI_FEATURES` includes a deprecated value listed in `DEPRECATED_UI_FEATURE_ALIASES` (e.g. `custom-applications`)
- **THEN** the response's `config.enabledUiFeatures` carries its replacement (`schema-apps`) exactly once, a deprecation warning is logged, and the value is not duplicated when the replacement is also supplied

#### Scenario: All-unrecognized input returns null, not empty array

- **WHEN** `ENABLED_UI_FEATURES` contains only values not in `OverlayFeature`
- **THEN** `config.enabledUiFeatures` is `null` — the empty-set footgun (which would disable the entire UI) is prevented

---

### Requirement: client-config response includes the announcement message

`GET /api/v1/client-config` SHALL include an `announcementHtml` field of type `string | null` in the `config` object of its response, sourced from the `announcement.html` registry key. The field SHALL carry the operator-configured message when set and SHALL be `null` when `ANNOUNCEMENT_HTML_MESSAGE` is not configured. The `ClientConfigDto` response DTO SHALL declare this field with Swagger metadata so the generated `@epam/ai-dial-chat-api-client` exposes it.

#### Scenario: Announcement message configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `ANNOUNCEMENT_HTML_MESSAGE` is set to `Welcome to DIAL!`
- **THEN** the response is `200 OK` with `config.announcementHtml="Welcome to DIAL!"`

#### Scenario: Announcement message not configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `ANNOUNCEMENT_HTML_MESSAGE` is not set
- **THEN** the response is `200 OK` with `config.announcementHtml=null`

---

### Requirement: client-config exposes publicationFilterSources

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `publicationFilterSources: string[]` (sourced from `EnvironmentVariables.PUBLICATION_FILTER_SOURCES` via the `publish.publicationFilterSources` registry entry, default `['title', 'role', 'dial_roles']`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `publicationFilterSources: string[]` so the generated `@epam/ai-dial-chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `publicationFilterSources: string[]`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None — values are raw claim/category strings, not localized copy.

#### Scenario: Default sources returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `PUBLICATION_FILTER_SOURCES` is unset
- **THEN** the response includes `config.publicationFilterSources: ["title", "role", "dial_roles"]`

#### Scenario: Operator-configured sources are returned

- **WHEN** `PUBLICATION_FILTER_SOURCES=roles,department` is set
- **THEN** the response includes `config.publicationFilterSources: ["roles", "department"]`

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type (the `config` property of `ClientConfigResponseDto`) includes `publicationFilterSources: string[]`

### Requirement: client-config response includes the announcement title and description

`GET /api/v1/client-config` SHALL include `announcementTitle` and `announcementDescription`, both of type `string | null`, in the `config` object of its response, sourced from the `announcement.title` and `announcement.description` registry keys. Each SHALL be `null` when its environment variable is not configured or resolves to a blank string.

`announcementTitle` SHALL be returned as plain text — the service SHALL NOT interpret it as markup and SHALL NOT strip or escape its characters beyond trimming surrounding whitespace.

`announcementDescription` SHALL be sanitized server-side before it is returned, using the announcement allowlist: tags `a`, `b`, `strong`, `em`, `br`, `span`, and attributes `href`, `target`, `rel`. This allowlist SHALL match the client-side DOMPurify pass in `AnnouncementBanner` exactly, so the server never returns markup the client silently strips. It is deliberately narrower than the footer's allowlist, which additionally permits `u` and `p` — block-level and underline markup have no place on a single truncating line. Anchors whose `href` is not a hash link SHALL be rewritten to carry `target="_blank"` and `rel="noopener noreferrer"`, reusing the footer's anchor transform. If sanitization reduces the value to an empty string, the field SHALL be `null`.

The `ClientConfigDto` response DTO SHALL declare both fields with Swagger metadata so the generated `@epam/ai-dial-chat-api-client` exposes them.

#### Scenario: Title and description configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called with `ANNOUNCEMENT_TITLE="🎉 Welcome to DIAL! 🎉"` and `ANNOUNCEMENT_DESCRIPTION="Explore our AI offerings with your data."`
- **THEN** the response is `200 OK` with both fields populated with those values

#### Scenario: Title and description not configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and neither variable is set
- **THEN** the response is `200 OK` with `config.announcementTitle=null` and `config.announcementDescription=null`

#### Scenario: Blank values resolve to null

- **WHEN** either variable is set to an empty string or to whitespace only
- **THEN** the corresponding response field is `null` rather than an empty or whitespace string

#### Scenario: Safe description markup is preserved

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `Explore our <strong>AI offerings</strong>.`
- **THEN** the returned `config.announcementDescription` retains the `<strong>` element

#### Scenario: Description markup outside the allowlist is stripped

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `Hi<script>alert(1)</script><img src=x onerror="alert(1)">`
- **THEN** the returned `config.announcementDescription` contains no `<script>` element, no `<img>` element, and no inline event handler attribute

#### Scenario: Description links are forced to open safely

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` contains `<a href="https://dialx.ai">docs</a>`
- **THEN** the returned anchor carries `target="_blank"` and `rel="noopener noreferrer"`

#### Scenario: A description that sanitizes away becomes null

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to `<script>alert(1)</script>`
- **THEN** the returned `config.announcementDescription` is `null` rather than an empty string

#### Scenario: Title is not treated as markup

- **WHEN** `ANNOUNCEMENT_TITLE` is set to `Release <b>3.0</b>`
- **THEN** the returned `config.announcementTitle` is the literal string `Release <b>3.0</b>`, unmodified

---

### Requirement: client-config response includes the welcome-screen description

`GET /api/v1/client-config` SHALL include a `welcomeScreenDescription` field of type `string | null` in the `config` object of its response, sourced from the `welcomeScreen.description` registry key (env var `WELCOME_SCREEN_DESCRIPTION`). The field SHALL be `null` when the variable is not configured or resolves to a blank string.

`welcomeScreenDescription` SHALL be returned as plain text — the service SHALL NOT interpret it as markup and SHALL NOT strip or escape its characters beyond trimming surrounding whitespace, matching the `announcementTitle` treatment.

The `ClientConfigResponseDto` response DTO SHALL declare this field with Swagger metadata so the generated `@epam/ai-dial-chat-api-client` exposes it.

#### Scenario: Description configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `WELCOME_SCREEN_DESCRIPTION` is set to `Your secure, all-in-one AI assistant.`
- **THEN** the response is `200 OK` with `config.welcomeScreenDescription="Your secure, all-in-one AI assistant."`

#### Scenario: Description not configured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `WELCOME_SCREEN_DESCRIPTION` is not set
- **THEN** the response is `200 OK` with `config.welcomeScreenDescription=null`

#### Scenario: Blank value resolves to null

- **WHEN** `WELCOME_SCREEN_DESCRIPTION` is set to an empty string or to whitespace only
- **THEN** `config.welcomeScreenDescription` is `null` rather than an empty or whitespace string

#### Scenario: Value is not treated as markup

- **WHEN** `WELCOME_SCREEN_DESCRIPTION` is set to `Explore <b>everything</b> DIAL offers`
- **THEN** the returned `config.welcomeScreenDescription` is the literal string `Explore <b>everything</b> DIAL offers`, unmodified

### Requirement: client-config exposes maxAttachmentFileSizeBytes

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `maxAttachmentFileSizeBytes: number` (sourced from `EnvironmentVariables.FILE_UPLOAD_MAX_BYTES` via the `attachments.maxFileSizeBytes` registry entry, default `536870912`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `maxAttachmentFileSizeBytes: number` so the generated `@epam/ai-dial-chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `maxAttachmentFileSizeBytes: number`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None — a raw byte count, not localized copy.

#### Scenario: Default limit returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and `FILE_UPLOAD_MAX_BYTES` is unset
- **THEN** the response includes `config.maxAttachmentFileSizeBytes: 536870912`

#### Scenario: Operator-configured limit is returned

- **WHEN** `FILE_UPLOAD_MAX_BYTES=104857600` is set
- **THEN** the response includes `config.maxAttachmentFileSizeBytes: 104857600` — the same value that now also governs the `POST /api/v1/files` Multer limit, since both read the same environment variable

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type (the `config` property of `ClientConfigResponseDto`) includes `maxAttachmentFileSizeBytes: number`

### Requirement: client-config response assembly separates orchestration from field mapping

`AppConfigService.getClientConfig` SHALL own orchestration only. It SHALL handle the
cache lookup and write, resolve `app.version` in advance, resolve client-visible
definitions sequentially, apply `value ?? definition.defaultValue`, map `features.*`,
and produce `metadata`. The default value and conversion of each non-feature `config`
field SHALL be owned by a typed, app-local mapping module in
`apps/chat-api/src/app-config/`. That module SHALL have exactly one mapping entry per
client-visible non-feature registry key other than `app.version`. The module SHALL be a
pure module. It SHALL NOT be a Nest provider, and it SHALL hold no mutable module-level
response state.

The observable contract of `GET /api/v1/client-config` SHALL be unchanged by this
separation. That covers the HTTP method and path, the `appId` validation, the status
codes, the `ClientConfigResponseDto` shape, the OpenAPI `operationId` `getClientConfig`,
and the generated-client types. No regeneration of `libs/chat-api-client` and no change
to frontend callers SHALL be required. The endpoint SHALL remain ungated by any feature
flag. It SHALL introduce no user-visible strings and has no RTL impact.

**Caching:** unchanged. The key is
`app-config:client:{encodedAppId}:user:{encodedUserId|anonymous}:roles:{sortedEncodedRoles|none}`.
The TTL is 60 seconds, passed to the cache as `60000` milliseconds, and entries expire
by TTL only.

**Observability:** unchanged. There is still one resolution debug log per key, emitted
by `CompositeConfigProvider`, and the normalizer warnings are still logged under the
`AppConfigService` logger context. Unmapped keys SHALL NOT produce any new logs,
metrics, or exceptions.

#### Scenario: Every mapped field keeps its current value policy

- **WHEN** providers resolve any combination of absent, `null`, `false`, `0`, empty-string, whitespace-only, wrong-typed, or well-formed values for the client-visible keys
- **THEN** each `config` field equals what the pre-refactor service returned for the same inputs. For example, `transcribeSizeLimitBytes` returns `0` unchanged, a non-number falls back to `5242880`, and a whitespace-only `announcement.title` becomes `null`. An empty-string `announcement.html` stays `''`, and a non-string `footer.html` becomes `''`. `mcpAppTheme` becomes `null` for any value other than `light` or `dark`. A non-object or array `customVariables` becomes `{}`. A non-array `fileManagerTabs` becomes the four default tabs `['all', 'my_files', 'shared', 'organization']`

#### Scenario: Provider null falls back to the registry default before conversion

- **WHEN** a provider returns `null` for `fileManager.availableTabs`
- **THEN** the registry `defaultValue` `['all', 'my_files', 'shared', 'organization']` is converted and returned, exactly as before the refactor

#### Scenario: Response field set and order are unchanged

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called with all providers returning `undefined`
- **THEN** `Object.keys(response.config)` lists the same fields in the same order as before the refactor, starting with `aiTextRefinementAvailable`, `appVersion`, `activeEventId` and ending with `publicationFilterSources`, `maxAttachmentFileSizeBytes`

#### Scenario: app.version is resolved once, first

- **WHEN** the cache misses
- **THEN** the composite provider is called with `app.version` exactly once, before any other key. Each remaining client-visible definition is then resolved exactly once in `CONFIG_DEFINITIONS` order, sequentially, and every call receives the full evaluation context

#### Scenario: Footer and appVersion use the same resolved version

- **WHEN** `CHAT_VERSION` resolves to `2026.08.10-a1b2c3d` and `FOOTER_HTML_MESSAGE` contains `%%VERSION%%`
- **THEN** `config.appVersion` is `2026.08.10-a1b2c3d` and `config.footerHtmlMessage` contains that same string in place of the token

#### Scenario: Field-specific text policies stay distinct

- **WHEN** `announcement.html`, `announcement.title`, `announcement.description`, `welcomeScreen.description`, and `footer.html` each resolve to a string containing markup and surrounding whitespace
- **THEN** `announcementHtml` is passed through verbatim. `announcementTitle` and `welcomeScreenDescription` are trimmed plain text. `announcementDescription` is trimmed and then passed through the announcement sanitizer. `footerHtmlMessage` gets `%%VERSION%%` substitution and the footer sanitizer

#### Scenario: Normalizer warnings are unchanged

- **WHEN** `ENABLED_UI_FEATURES` contains a deprecated alias and an unrecognized entry, and `ANNOUNCEMENTS` contains a rejected entry
- **THEN** the same warning messages are logged in the same order and with the same count as before the refactor

#### Scenario: A cache hit has no resolution side effects

- **WHEN** a second request with the same app, user, and role set (in any role order) arrives within the TTL
- **THEN** the cached response is returned with its original `metadata.resolvedAt`, the composite provider is not called, and no normalizer warning is logged

#### Scenario: Per-call state is isolated across callers

- **WHEN** two requests with different role sets resolve different values for the same key, one after the other or concurrently
- **THEN** each response reflects only its own resolved values, and each response gets its own `config` object. A field that falls back because its value has the wrong shape gets a fresh copy of the mapping module's default. Provider-returned values, including registry `defaultValue` arrays and objects returned through `value ?? definition.defaultValue`, are still passed through by reference and never mutated, as before the refactor

#### Scenario: An unmapped non-feature key is ignored silently

- **WHEN** the mapping lookup receives a key that has no entry, including inherited property names such as `constructor` or `__proto__`
- **THEN** the accumulator is left unchanged and no exception or log is produced

### Requirement: client-config exposes resolved catalog creation permissions

`GET /api/v1/client-config?appId=ai-dial-chat` SHALL include required `config.catalogCreationPermissions` with required `allowedTypes` (an array of the five creation-type enum values) and `restrictedSchemaIds` (a string array). Evaluation follows `catalog-creation-role-restrictions`. Both arrays SHALL always be present, including when empty. The role maps and user roles SHALL never be serialized.

Request: existing required `GetClientConfigDto.appId`, allowlisted to `ai-dial-chat`, no body or new headers. Authorization SHALL stay `@Public()` plus `OptionalSessionGuard`; no role is required to read config, and anonymous callers receive evaluation with no roles. Response SHALL remain 200 for a valid request, 400 for missing/invalid appId. This change adds no auth, schema-lookup, upstream dependency, or new 401/403/404/502/503 outcome; existing unexpected failures retain the sanitized framework 500 response. A policy is validated at boot, not silently discarded during a request.

Example policy: `{"types":{"custom-app":["developers"]},"schemas":{"schema-A":["team-A"]}}`. Response to a user holding neither role (unrelated fields abbreviated):

```http
GET /api/v1/client-config?appId=ai-dial-chat
```

```json
{
  "appId": "ai-dial-chat",
  "features": { "asrEnabled": false },
  "config": {
    "enabledUiFeatures": null,
    "catalogCreationPermissions": {
      "allowedTypes": ["schema-app", "toolset", "prompt", "skill"],
      "restrictedSchemaIds": ["schema-A"]
    }
  },
  "metadata": { "resolvedAt": "2026-10-27T10:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

`ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL document the object through concrete Swagger types and a string enum for creation categories. Append the service-assembled field after the mapped config fields. Update the response key-order and mapper coverage tests.

**Generated client:** retain operationId/SDK method `getClientConfig`, existing request DTO `GetClientConfigDto` and `ClientConfigResponseDto`. Add a non-optional typed permission DTO field to `ClientConfigDto`; enum arrays MUST NOT degrade to `any` or untyped objects. Regenerate `libs/chat-api-client`; retain the normal, non-Raw method through `apps/chat/src/server-api/app-config.api.ts` and its existing singleton.

**Cache:** unchanged `app-config:client:<encodedAppId>:user:<encodedUserId>:roles:<sortedEncodedRoles>`, existing anonymous/no-role sentinels, TTL 60 seconds, expiry/restart invalidation, `Cache-Control: private, no-store`. **Observability:** existing endpoint metrics only, no raw rules/roles in logs. **RTL / i18n:** none at the endpoint.

#### Scenario: No rules returns all creation types
- **WHEN** the policy is absent
- **THEN** the object contains all five type values and `restrictedSchemaIds: []`

#### Scenario: Roles affect only the new permission field
- **WHEN** users with and without a required role request the same configured UI-feature baseline
- **THEN** their permission objects differ but `config.enabledUiFeatures` does not

#### Scenario: An explicit baseline is not filtered
- **WHEN** `ENABLED_UI_FEATURES=header,custom-apps` and custom-app creation is denied
- **THEN** `config.enabledUiFeatures` remains `["header", "custom-apps"]`

#### Scenario: The default baseline stays null
- **WHEN** `ENABLED_UI_FEATURES` is unset and creation is restricted
- **THEN** `config.enabledUiFeatures` remains null and only the new permission object carries creation restrictions

#### Scenario: No role map is disclosed
- **WHEN** any client-config response is serialized
- **THEN** it contains no policy role names or raw policy maps

#### Scenario: Generated client preserves the strong contract
- **WHEN** OpenAPI and the client are regenerated
- **THEN** the permission object and arrays are non-optional and typed, and `npm run openapi:check` passes

### Requirement: client-config exposes additionalContentLocales

`GET /api/v1/client-config` SHALL include one more `visibility='client'` field under `config`: `additionalContentLocales: string[]`. It is sourced from the `content.additionalLocales` registry entry (`ADDITIONAL_CONTENT_LOCALES`, falling back to the deprecated `AVAILABLE_LOCALES`), with default `[]`. The field is added to the response `client-config-endpoint` already returns. The endpoint's path, query parameters, authorization (none required) and cache key/TTL are unchanged, so the field is cached and invalidated together with the rest of the response.

`CLIENT_CONFIG_MAPPINGS` (`apps/chat-api/src/app-config/client-config.mapper.ts`) SHALL map `content.additionalLocales` to `additionalContentLocales`. An array value passes through, and anything else becomes `[]`. The empty default SHALL be added to the mapper's default config object. `ClientConfigResponseDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty({ type: [String] })` field `additionalContentLocales!: string[]`, so the generated `@epam/ai-dial-chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged, and its response type's `config` property gains `additionalContentLocales: string[]`. The request DTO is unchanged. Frontend callers keep using the normal (non-`Raw`) generated method.

**RTL impact:** none. **i18n impact:** none; values are locale codes.

Example response (abridged):

```json
GET /api/v1/client-config?appId=ai-dial-chat
200 OK
{
  "config": {
    "publicationFilterSources": ["title", "role", "dial_roles"],
    "additionalContentLocales": ["de", "fr-FR"]
  }
}
```

#### Scenario: Empty list returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called and neither `ADDITIONAL_CONTENT_LOCALES` nor `AVAILABLE_LOCALES` is set
- **THEN** the response includes `config.additionalContentLocales: []`

#### Scenario: Operator-configured locales are returned canonicalised

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=de,fr-fr` is set
- **THEN** the response includes `config.additionalContentLocales: ["de", "fr-FR"]`

#### Scenario: Registry-coverage test accepts the new key

- **WHEN** the client-config mapper coverage test (`apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`) runs
- **THEN** `content.additionalLocales` has exactly one mapping entry, and `additionalContentLocales` is written by no other entry

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type includes `additionalContentLocales: string[]`, and `npm run openapi:check` passes

### Requirement: client-config exposes model catalog availability

`GET /api/v1/client-config` SHALL include `config.modelCatalogAvailable: boolean`. It is `true` when `MODEL_CATALOG_API_KEY` is configured (non-blank after trimming) and `false` otherwise. A frontend can then decide whether to call `GET /api/v1/model-catalog` without probing it (see the `model-catalog` capability).

- `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`) SHALL assemble the field itself from `ConfigService`, as it does `aiTextRefinementAvailable`. The field is not a config-registry key and has no entry in the mapping module (`apps/chat-api/src/app-config/client-config.mapper.ts`). `MappedClientConfig` SHALL omit it, and the mapper spec's list of service-assembled fields SHALL include it.
- The service SHALL decide availability with the same key-resolution helper as the catalog service, so the flag and the route can never disagree.
- The field SHALL be emitted on every response. It SHALL be appended after `catalogCreationPermissions`, so every existing field keeps its position.
- `ClientConfigDto` SHALL declare it with `@ApiPropertyOptional({ type: Boolean })` and a description stating that a missing value means unavailable, so a client generated against this BFF tolerates an older BFF. The generated `ClientConfigDto` type in `@epam/ai-dial-chat-api-client` gains `modelCatalogAvailable?: boolean`. No frontend caller in `apps/chat` reads it.
- The value SHALL NOT vary by user, role or `appId`, and SHALL never carry the key. It is cached as part of the existing client-config entry (60-second TTL, unchanged key). The key is read at boot, so no invalidation is needed.
- No i18n string, UI, RTL impact or feature gate is introduced.

#### Scenario: Key configured

- **GIVEN** `MODEL_CATALOG_API_KEY=catalog-key`
- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** `response.config.modelCatalogAvailable` is `true` and no field of the response contains `catalog-key`

#### Scenario: Key unset or blank

- **GIVEN** `MODEL_CATALOG_API_KEY` is unset, or is `"  "`
- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** `response.config.modelCatalogAvailable` is `false`

#### Scenario: Field order keeps existing positions

- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called with all providers returning `undefined`
- **THEN** `Object.keys(response.config)` equals the previous list with `modelCatalogAvailable` appended after `catalogCreationPermissions`

#### Scenario: DIAL_API_KEY does not affect the flag

- **GIVEN** `DIAL_API_KEY` is set and `MODEL_CATALOG_API_KEY` is unset
- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** `response.config.modelCatalogAvailable` is `false`

### Requirement: client-config exposes the themes base URL

`GET /api/v1/client-config` SHALL include `config.themesBaseUrl: string` when `THEMES_PUBLIC_URL` is configured: the value trimmed, without trailing slashes. It SHALL be omitted when the variable is unset or blank. `THEMES_CONFIG_URL` SHALL never be exposed: it is the address `chat-api` fetches themes from and is often in-cluster (for example `http://dial-themes`), so it does not match the public host that absolute `icon_url` values name. DIAL can list one theme icon in two forms — a theme-relative name (`gpt4.svg`) and an absolute URL on the themes host — and a browser fetches each URL separately, so the frontend uses this value to load both forms through one `GET /api/themes/icon` URL.

- `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`) SHALL assemble the field itself from `ConfigService`, as it does `modelCatalogAvailable`. `MappedClientConfig` SHALL omit it, and the mapper spec's list of service-assembled fields SHALL include it. It is appended last, so every existing field keeps its position, and a response without it keeps the previous key list.
- `ClientConfigDto` SHALL declare it with `@ApiPropertyOptional({ type: String })`. The generated `ClientConfigDto` in `@epam/ai-dial-chat-api-client` gains `themesBaseUrl?: string`.
- The value SHALL NOT vary by user, role or `appId`. It is cached as part of the existing client-config entry (60-second TTL, unchanged key).
- In `apps/chat`, `resolveCatalogIconUrl` (`apps/chat/src/utils/icon-path.ts`) SHALL map an absolute icon URL of the form `<themesBaseUrl>/<name>`, where `<name>` matches the icon proxy's `^[a-zA-Z0-9_.-]+$`, to `/api/themes/icon?iconName=<name>`. Every other absolute URL, and every URL while the base URL is unknown, is returned unchanged. Deployment, toolset, conversation and usage icons resolve through `useResolveCatalogIconUrl` (`apps/chat/src/hooks/catalog/useResolveCatalogIconUrl.ts`) or the catalog mapper's `themesBaseUrl` option. Only the displayed URL changes; the stored `icon_url` and the value an editor saves are untouched.
- No i18n string, UI, RTL impact or feature gate is introduced.

#### Scenario: Themes URL configured

- **GIVEN** `THEMES_CONFIG_URL=http://dial-themes` and `THEMES_PUBLIC_URL=https://themes.example.com/`
- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** `response.config.themesBaseUrl` is `https://themes.example.com` and no field of the response contains `dial-themes`

#### Scenario: Themes URL unset or blank

- **GIVEN** `THEMES_PUBLIC_URL` is unset, or is `"  "`, whatever `THEMES_CONFIG_URL` is
- **WHEN** `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** `response.config` has no `themesBaseUrl` key

#### Scenario: Both forms of one icon load from one URL

- **GIVEN** `themesBaseUrl` is `https://themes.example.com`, one model lists `icon_url: gpt4.svg` and another `icon_url: https://themes.example.com/gpt4.svg`
- **WHEN** the catalog renders both
- **THEN** both icons use `/api/themes/icon?iconName=gpt4.svg`

### Requirement: The deployment declares the application identifiers it serves

The backend SHALL read `CLIENT_CONFIG_APP_IDS`, a comma-separated list of application identifiers declared on `ClientUiEnv` in `apps/chat-api/src/config/env/client-ui.env.ts`. Entries SHALL be trimmed, de-duplicated preserving order, and each SHALL match `^[a-z0-9][a-z0-9-]{0,62}$`. A non-matching entry SHALL fail startup with an `Environment validation failed:` message naming the variable. An absent, empty or blank value SHALL mean `["ai-dial-chat"]`. The list SHALL be at most 16 entries. Only `GET /api/v1/client-config` uses the list. Server-side feature evaluation (`FeatureGuard`, text refinement) SHALL keep evaluating with `appId` `ai-dial-chat`, because those gates protect Chat BFF endpoints whichever frontend a deployment serves.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None. **Cache:** Defined by "GET /api/v1/client-config returns client-safe configuration"; `appId` is always a segment, and a mapped `appId` in managed `active` mode also adds its instance, revision and state. A served identifier MAY additionally be mapped to a Config Studio instance (`MANAGED_CONFIG_INSTANCES`, see `managed-config-runtime-reader`); a mapping for an identifier this list does not serve SHALL fail startup.

#### Scenario: Default serves only Chat

- **WHEN** `CLIENT_CONFIG_APP_IDS` is unset
- **THEN** `appId=ai-dial-chat` is accepted and `appId=launchpad` is `400 Bad Request`

#### Scenario: Invalid entry fails startup

- **WHEN** `CLIENT_CONFIG_APP_IDS=ai-dial-chat,Bad_Id`
- **THEN** environment validation fails and names `CLIENT_CONFIG_APP_IDS` without printing other environment values

#### Scenario: Transitional list

- **WHEN** a Launchpad deployment sets `CLIENT_CONFIG_APP_IDS=launchpad,ai-dial-chat` while older Launchpad builds still send the legacy `chat-ui`
- **THEN** both the old and the new builds receive `200 OK`

#### Scenario: Server-side gates keep the Chat contract

- **WHEN** a deployment sets `CLIENT_CONFIG_APP_IDS=launchpad` and a request reaches an endpoint protected by `FeatureGuard`
- **THEN** the feature is evaluated with `appId` `ai-dial-chat`, Chat's own identifier

### Requirement: client-config carries optional managed fields

In `MANAGED_CONFIG_MODE=active`, the response of `GET /api/v1/client-config` for an `appId` mapped to a Config Studio instance SHALL add these optional fields. Every existing field, its type, and its order SHALL be unchanged, and so SHALL `Cache-Control: private, no-store`. The added fields:

- `metadata.managed`, with:
  - `instanceId`;
  - `state`, one of `fresh`, `degraded`, `stale`, `unavailable`, `not_published`;
  - when the state is `fresh` or `degraded`, also `revisionId`, `schemaVersion`, and `publishedAt`.
- `metadata.nextRefreshAt`: an ISO instant. It SHALL be the earliest of the resolution time plus `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS`, the next window boundary of an active managed feature, and the snapshot's staleness expiry.
- `appConfig`, only for an `appId` other than `ai-dial-chat` with a usable snapshot (see `managed-config-activation`). It is `{ schemaVersion, schemaSha256, revisionId, publishedAt, payload }`, where `payload` is an arbitrary JSON object.

In modes `off` and `shadow`, and for an unmapped `appId`, none of these fields SHALL be present. The fields SHALL NOT carry operator identities, publication reasons, revision hashes other than `schemaSha256` in `appConfig`, roles, policy definitions of features, or credentials.

Example request and response (`active`, `ai-dial-chat` → `chat-dev`, `welcomeScreen.description` active):

```http
GET /api/v1/client-config?appId=ai-dial-chat
200 OK
Cache-Control: private, no-store

{
  "appId": "ai-dial-chat",
  "features": { "usageLimitsControl": false },
  "config": { "welcomeScreenDescription": "Welcome", "...": "unchanged fields" },
  "metadata": {
    "resolvedAt": "2026-11-20T10:00:00.000Z",
    "cacheTtlSeconds": 60,
    "nextRefreshAt": "2026-11-20T10:02:00.000Z",
    "managed": {
      "instanceId": "chat-dev",
      "state": "fresh",
      "revisionId": "20261120T095500000Z-0123456789abcdef",
      "schemaVersion": "1.0.0",
      "publishedAt": "2026-11-20T09:55:00.000Z"
    }
  }
}
```

Foreign application (`launchpad` → `launchpad-dev`):

```json
{
  "appId": "launchpad",
  "features": { "...": "ai-dial-chat environment values" },
  "config": { "...": "ai-dial-chat environment values" },
  "appConfig": {
    "schemaVersion": "2.0.0",
    "schemaSha256": "4f1c…",
    "revisionId": "20261120T090000000Z-fedcba9876543210",
    "publishedAt": "2026-11-20T09:00:00.000Z",
    "payload": { "blocks": [{ "id": "news" }] }
  },
  "metadata": {
    "resolvedAt": "…",
    "cacheTtlSeconds": 60,
    "nextRefreshAt": "…",
    "managed": { "instanceId": "launchpad-dev", "state": "fresh", "revisionId": "…", "schemaVersion": "2.0.0", "publishedAt": "…" }
  }
}
```

Errors are unchanged: `400` for a missing, malformed, repeated, or unserved `appId` or an undeclared query parameter. Managed failures never produce a 4xx or 5xx; they are reported through `metadata.managed.state`.

**Authorization:** Unchanged: public, works before authentication. **Generated-client impact:** `operationId` `getClientConfig` and the normal generated method are unchanged. `ClientConfigMetadataDto` gains optional `nextRefreshAt` and `managed` (`ClientConfigManagedMetadataDto`, with a string enum `ManagedConfigState`). `ClientConfigResponseDto` gains optional `appConfig` (`ClientAppConfigDto`, with `payload` typed as a free-form object). They are regenerated in `libs/chat-api-client/openapi.json`. **Feature flag:** Not gated through `ENABLED_FEATURES`. **RTL impact:** None. **i18n impact:** None. **Cache:** As in "GET /api/v1/client-config returns client-safe configuration".

#### Scenario: Off mode has no managed fields

- **WHEN** `MANAGED_CONFIG_MODE` is unset
- **THEN** the response contains neither `metadata.managed`, `metadata.nextRefreshAt`, nor `appConfig`

#### Scenario: Unusable state carries no revision

- **WHEN** the mode is `active` and the mapped instance is `unavailable`
- **THEN** `metadata.managed` is `{ "instanceId": "chat-dev", "state": "unavailable" }`

#### Scenario: Chat never receives appConfig

- **WHEN** `appId=ai-dial-chat` is served from a fresh snapshot
- **THEN** the response has no `appConfig`

#### Scenario: Refresh hint follows the next boundary

- **WHEN** `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS=120` and an active managed feature's `endsAt` is 45 s after resolution
- **THEN** `metadata.nextRefreshAt` is the `endsAt` instant

#### Scenario: Generated client exposes the optional fields

- **WHEN** `npm run openapi` runs
- **THEN** the generated `ClientConfigResponseDto` has optional `appConfig`, and `ClientConfigMetadataDto` has optional `nextRefreshAt` and `managed`

## ADDED Requirements

### Requirement: The legacy chat-ui identifier is an alias of ai-dial-chat

`ai-dial-chat` SHALL be Chat's application identifier, defined once as `CHAT_APP_ID` in `apps/chat-api/src/config/env/app-ids.ts`. The former identifier `chat-ui` (`LEGACY_CHAT_APP_ID`) SHALL be a deprecated alias. Wherever an application identifier is read, `chat-ui` SHALL be replaced with `ai-dial-chat` before any other check:

- the `appId` query parameter of `GET /api/v1/client-config`, before the served-identifier check, the cache key, and the managed view;
- each entry of `CLIENT_CONFIG_APP_IDS`, before de-duplication;
- the application side of each `MANAGED_CONFIG_INSTANCES` pair, before the cross-variable checks.

A response to either identifier SHALL be identical and SHALL carry `"appId": "ai-dial-chat"`. Listing both identifiers in `CLIENT_CONFIG_APP_IDS` SHALL serve one identifier. Mapping both in `MANAGED_CONFIG_INSTANCES` SHALL fail startup with the existing duplicate-mapping message. The alias SHALL NOT apply to a Config Studio snapshot: a snapshot whose `appId` is `chat-ui`, read for `ai-dial-chat`, SHALL be rejected with `identity_mismatch`. No other identifier has an alias.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None. **Generated client:** unchanged operations and types (`getClientConfig`); only the OpenAPI examples change.

#### Scenario: Legacy request

- **WHEN** a caller requests `GET /api/v1/client-config?appId=chat-ui` with default settings
- **THEN** the response is `200 OK` with `"appId": "ai-dial-chat"` and the same body as `appId=ai-dial-chat` for the same identity and roles

#### Scenario: Legacy list entry

- **WHEN** `CLIENT_CONFIG_APP_IDS=launchpad,chat-ui`
- **THEN** the deployment serves `launchpad` and `ai-dial-chat`, and `appId=chat-ui` is accepted

#### Scenario: Both spellings listed

- **WHEN** `CLIENT_CONFIG_APP_IDS=chat-ui,ai-dial-chat`
- **THEN** the deployment serves exactly one identifier, `ai-dial-chat`

#### Scenario: Both spellings mapped

- **WHEN** `MANAGED_CONFIG_MODE=shadow` and `MANAGED_CONFIG_INSTANCES=chat-ui=chat-dev,ai-dial-chat=chat-prod`
- **THEN** startup fails with "MANAGED_CONFIG_INSTANCES maps an application identifier twice"

#### Scenario: Legacy mapping

- **WHEN** `MANAGED_CONFIG_INSTANCES=chat-ui=ai-dial-chat` in mode `shadow`
- **THEN** the instance `ai-dial-chat` is read for the identifier `ai-dial-chat`

#### Scenario: Snapshot with the legacy identifier

- **WHEN** the mapped instance returns a snapshot whose `appId` is `chat-ui`
- **THEN** the snapshot is rejected with `identity_mismatch` and the previous snapshot, if any, is kept
