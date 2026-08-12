## ADDED Requirements

### Requirement: GET /api/v1/client-config returns client-safe configuration

The system SHALL expose `GET /api/v1/client-config` as a versioned business endpoint (version `'1'`). It SHALL accept a required `appId` query parameter, validate it against an allowlist, and return all `visibility='client'` configuration values, including the new `dialCore.externalUrl` key added by the `config-registry-and-env-provider` capability.

**Authorization:** None required. The endpoint is public and MUST work before authentication.

**Rate limiting:** `@Throttle({ default: { limit: 60, ttl: 60_000 } })` — 60 requests per minute per IP (stricter than the global 100/min default for public unauthenticated endpoints).

**Caching:** In-memory cache via `@nestjs/cache-manager`. Cache key: `app-config:client:{appId}:user:{userId|anonymous}:roles:{sortedRoles|none}`. TTL: 60 seconds. Identity and roles MUST be included because role-gated flags can vary by caller. Future targeting dimensions MUST also be added to the cache key before they affect evaluation.

**operationId:** `getClientConfig` (handler method name on the controller).

**Feature flag:** Not gated.

**RTL impact:** None (backend-only).

**i18n impact:** None.

**Observability:** Latency and error rate captured by the existing `MetricsInterceptor`. Resolution debug log per key (key name + provider that resolved it). No config values in logs.

#### Scenario: Happy path — ASR configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ASR_MODEL=whisper-1`, `TRANSCRIBE_SIZE_LIMIT_BYTES=10485760` are set
- **THEN** the response is `200 OK` with body:
  ```json
  {
    "appId": "chat-ui",
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

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ASR_MODEL` is not set
- **THEN** the response is `200 OK` with `features.asrEnabled=false`, `config.asrModelId=null`, `config.transcribeSizeLimitBytes=5242880`

#### Scenario: Happy path — DIAL Core external URL configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `DIAL_CORE_EXTERNAL_URL=https://dial.example.com` is set
- **THEN** the response is `200 OK` with `config.dialCoreExternalUrl="https://dial.example.com"`

#### Scenario: Happy path — DIAL Core external URL not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `DIAL_CORE_EXTERNAL_URL` is not set
- **THEN** the response is `200 OK` with `config.dialCoreExternalUrl=null`

#### Scenario: Always returns 200 even on resolution failure

- **WHEN** all providers fail to resolve a non-critical key
- **THEN** the response is `200 OK` with the static default value for that key; no 500 is returned

#### Scenario: Missing appId returns 400

- **WHEN** `GET /api/v1/client-config` is called without `appId`
- **THEN** the response is `400 Bad Request` with a validation error message

#### Scenario: Unknown appId returns 400

- **WHEN** `GET /api/v1/client-config?appId=unknown-app` is called
- **THEN** the response is `400 Bad Request`

#### Scenario: Rate limit exceeded returns 429

- **WHEN** more than 60 requests per minute from the same IP hit `GET /api/v1/client-config`
- **THEN** the 61st request receives `429 Too Many Requests`

#### Scenario: Response does not contain server-only values

- **WHEN** the registry contains a `visibility='server'` key
- **THEN** that key MUST NOT appear anywhere in the `200 OK` response body

#### Scenario: Response does not contain secrets or context

- **WHEN** a valid response is returned
- **THEN** the body MUST NOT contain env var names, provider credentials, user IDs, roles, or internal metadata beyond `resolvedAt` and `cacheTtlSeconds`

#### Scenario: Response never exposes the internal DIAL_CORE_URL value

- **WHEN** a valid response is returned
- **THEN** the body MUST NOT contain the value of the internal `DIAL_CORE_URL` environment variable under any key

---

### Requirement: Response DTO is fully annotated for Swagger and generated client

`ClientConfigResponseDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL use `@ApiProperty` on every field, including the new `config.dialCoreExternalUrl` field, so that the generated `@epam/chat-api-client` produces strongly-typed `AppConfigApi.getClientConfig()` with a concrete response type (not `void` or `any`).

**Generated client impact:**
- `operationId`: `getClientConfig`
- SDK method: `AppConfigApi.getClientConfig({ appId: 'chat-ui' })`
- Request DTO: `GetClientConfigDto` with `appId: string`
- Response DTO: `ClientConfigResponseDto` with `appId`, `features`, `config` (now including `dialCoreExternalUrl: string | null`), `metadata`
- Frontend callers use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Generated client method is typed

- **WHEN** `npm run openapi` is run after the endpoint is added
- **THEN** `libs/chat-api-client/src/generated/src/apis/AppConfigApi.ts` EXISTS
- **AND** the `getClientConfig` method has a return type of `Promise<ClientConfigResponse>` (not `Promise<void>` or `Promise<any>`)

#### Scenario: Generated response type includes the new field

- **WHEN** `npm run openapi` is run after the endpoint is added
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `dialCoreExternalUrl: string | null`

---

### Requirement: GET /api/v1/config is removed

The old `GET /api/v1/config` endpoint SHALL be removed in the same PR that introduces `GET /api/v1/client-config`. The `AppConfigDto` (two-field DTO) SHALL be deleted. `apps/chat/src/server-api/config.api.ts` SHALL be deleted and replaced by `apps/chat/src/server-api/app-config.api.ts`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Old endpoint no longer exists

- **WHEN** `GET /api/v1/config` is called after the migration
- **THEN** the response is `404 Not Found`

#### Scenario: New server-api wrapper uses generated client

- **WHEN** `getClientConfig()` is called from the frontend server-api layer
- **THEN** it uses `AppConfigApi` from `@epam/chat-api-client`, not the hand-rolled `base.ts` `get()` helper

---

### Requirement: client-config exposes overlay eligibility

`GET /api/v1/client-config` SHALL include two additional `visibility='client'` keys under `config`: `overlayEnabled: boolean` (sourced from `EnvironmentVariables.OVERLAY_ENABLED`, default `false`) and `overlayAllowedOrigins: string[]` (sourced from `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS`, default `[]`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add `@ApiProperty` fields for both keys so the generated `@epam/chat-api-client` types them concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Overlay disabled by default

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `OVERLAY_ENABLED` is unset
- **THEN** the response includes `config.overlayEnabled: false` and `config.overlayAllowedOrigins: []`

#### Scenario: Overlay enabled with configured origins

- **WHEN** `OVERLAY_ENABLED=true` and `ALLOWED_IFRAME_ORIGINS=https://partner.example.com` are set
- **THEN** the response includes `config.overlayEnabled: true` and `config.overlayAllowedOrigins: ["https://partner.example.com"]`

#### Scenario: Generated client type includes both fields

- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`

#### Scenario: overlayAllowedOrigins never leaks server-only origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` also happens to include an origin used for a purpose unrelated to overlay embedding
- **THEN** the response still returns the same allowlist verbatim — this key is defined as client-visible by design (the host page must know it is on the allowlist to self-diagnose), matching the existing `frame-src`/`frame-ancestors` use of this same variable, which is already effectively public (observable via the CSP response header)

### Requirement: client-config exposes enabledUiFeatures

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `enabledUiFeatures: string[] | null` (sourced from `EnvironmentVariables.ENABLED_UI_FEATURES`, filtered to recognized `OverlayFeature` values per `config-registry-and-env-provider`, default `null`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `enabledUiFeatures: string[] | null` with `nullable: true` so the generated `@epam/chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `enabledUiFeatures: string[] | null`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: No baseline configured — null returned

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ENABLED_UI_FEATURES` is unset
- **THEN** the response includes `config.enabledUiFeatures: null`

#### Scenario: Baseline configured — array returned

- **WHEN** `ENABLED_UI_FEATURES=header,likes,hide-new-conversation` is set
- **THEN** the response includes `config.enabledUiFeatures: ["header", "likes", "hide-new-conversation"]`

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `enabledUiFeatures: string[] | null`

#### Scenario: Response never includes unrecognized entries

- **WHEN** `ENABLED_UI_FEATURES` includes a value that is not a member of `OverlayFeature`
- **THEN** the response's `config.enabledUiFeatures` array omits that value (filtered per `config-registry-and-env-provider`)

#### Scenario: All-unrecognized input returns null, not empty array

- **WHEN** `ENABLED_UI_FEATURES` contains only values not in `OverlayFeature`
- **THEN** `config.enabledUiFeatures` is `null` — the empty-set footgun (which would disable the entire UI) is prevented

---

### Requirement: client-config response includes the announcement message

`GET /api/v1/client-config` SHALL include an `announcementHtml` field of type `string | null` in the `config` object of its response, sourced from the `announcement.html` registry key. The field SHALL carry the operator-configured message when set and SHALL be `null` when `ANNOUNCEMENT_HTML_MESSAGE` is not configured. The `ClientConfigDto` response DTO SHALL declare this field with Swagger metadata so the generated `@epam/chat-api-client` exposes it.

#### Scenario: Announcement message configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is set to `Welcome to DIAL!`
- **THEN** the response is `200 OK` with `config.announcementHtml="Welcome to DIAL!"`

#### Scenario: Announcement message not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is not set
- **THEN** the response is `200 OK` with `config.announcementHtml=null`

---

### Requirement: client-config exposes publicationFilterSources

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `publicationFilterSources: string[]` (sourced from `EnvironmentVariables.PUBLICATION_FILTER_SOURCES` via the `publish.publicationFilterSources` registry entry, default `['title', 'role', 'dial_roles']`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `publicationFilterSources: string[]` so the generated `@epam/chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `publicationFilterSources: string[]`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None — values are raw claim/category strings, not localized copy.

#### Scenario: Default sources returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `PUBLICATION_FILTER_SOURCES` is unset
- **THEN** the response includes `config.publicationFilterSources: ["title", "role", "dial_roles"]`

#### Scenario: Operator-configured sources are returned

- **WHEN** `PUBLICATION_FILTER_SOURCES=roles,department` is set
- **THEN** the response includes `config.publicationFilterSources: ["roles", "department"]`

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `publicationFilterSources: string[]`

### Requirement: Frontend AppConfigContext exposes publicationFilterSources with a safe default

`AppConfigContext.tsx`'s `AppConfigState.config` SHALL gain `publicationFilterSources: string[]`, initialized in `INITIAL_STATE` and on fetch failure to a new `DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles']` constant (mirroring `DEFAULT_FILE_MANAGER_TABS`'s existing pattern), and populated in `loadConfig` from `response.config?.publicationFilterSources ?? DEFAULT_PUBLICATION_FILTER_SOURCES`. Consumers (`PublishConversationPanelContainer`, `CatalogView`) SHALL read this value via `useAppConfig().config.publicationFilterSources` to populate `ruleSourceOptions`, rather than hardcoding a list.

#### Scenario: Source list is available before the panel opens

- **WHEN** `AppConfigProvider` has resolved its initial fetch
- **THEN** `useAppConfig().config.publicationFilterSources` reflects the value returned by `GET /api/v1/client-config`

#### Scenario: Config fetch failure still yields a usable default

- **WHEN** `getClientConfig` rejects (network error)
- **THEN** `useAppConfig().config.publicationFilterSources` remains `DEFAULT_PUBLICATION_FILTER_SOURCES`, so the access-rules source picker is never left with zero options

---

### Requirement: client-config response includes the announcement title and description

`GET /api/v1/client-config` SHALL include `announcementTitle` and `announcementDescription`, both of type `string | null`, in the `config` object of its response, sourced from the `announcement.title` and `announcement.description` registry keys. Each SHALL be `null` when its environment variable is not configured or resolves to a blank string.

`announcementTitle` SHALL be returned as plain text — the service SHALL NOT interpret it as markup and SHALL NOT strip or escape its characters beyond trimming surrounding whitespace.

`announcementDescription` SHALL be sanitized server-side before it is returned, using the announcement allowlist: tags `a`, `b`, `strong`, `em`, `br`, `span`, and attributes `href`, `target`, `rel`. This allowlist SHALL match the client-side DOMPurify pass in `AnnouncementBanner` exactly, so the server never returns markup the client silently strips. It is deliberately narrower than the footer's allowlist, which additionally permits `u` and `p` — block-level and underline markup have no place on a single truncating line. Anchors whose `href` is not a hash link SHALL be rewritten to carry `target="_blank"` and `rel="noopener noreferrer"`, reusing the footer's anchor transform. If sanitization reduces the value to an empty string, the field SHALL be `null`.

The `ClientConfigDto` response DTO SHALL declare both fields with Swagger metadata so the generated `@epam/chat-api-client` exposes them.

#### Scenario: Title and description configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called with `ANNOUNCEMENT_TITLE="🎉 Welcome to DIAL! 🎉"` and `ANNOUNCEMENT_DESCRIPTION="Explore our AI offerings with your data."`
- **THEN** the response is `200 OK` with both fields populated with those values

#### Scenario: Title and description not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and neither variable is set
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

### Requirement: Announcement fields are independent of one another and of the legacy message

The service SHALL resolve `announcementTitle`, `announcementDescription`, and the existing `announcementHtml` independently. Configuring any subset SHALL be valid; the service SHALL NOT require that they be set together, SHALL NOT derive one from another, and SHALL NOT clear `announcementHtml` when the new fields are set. Choosing which content to render is the client's responsibility (see the `announcement-banner` capability).

#### Scenario: Only the title is configured

- **WHEN** `ANNOUNCEMENT_TITLE` is set and the description and legacy message are not
- **THEN** the response carries `config.announcementTitle` populated, `config.announcementDescription=null`, and `config.announcementHtml=null`

#### Scenario: Only the description is configured

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set and the title and legacy message are not
- **THEN** the response carries `config.announcementDescription` populated, `config.announcementTitle=null`, and `config.announcementHtml=null`

#### Scenario: Legacy message and new fields are both configured

- **WHEN** `ANNOUNCEMENT_HTML_MESSAGE` and `ANNOUNCEMENT_TITLE` are both set
- **THEN** the response carries both `config.announcementHtml` and `config.announcementTitle` populated, with neither suppressing the other

---

### Requirement: client-config response includes the validated announcements list

`GET /api/v1/client-config` SHALL include an `announcements` field of type `AnnouncementItemDto[]` in the `config` object of its response, sourced from the `announcement.items` registry key. The field SHALL be `[]` when `ANNOUNCEMENTS` is not configured. Entries SHALL be returned in configured order.

Each entry SHALL carry a `title: string`, a `description: string | null`, and a `link: AnnouncementLinkDto | null` whose link carries a `label: string` and an `href: string`.

The service SHALL include only entries that satisfy all of:

- `title` is a string that is non-blank after trimming;
- `link`, **when present**, has a non-blank string `label` and an `href` that parses as an absolute URL whose scheme is exactly `http:` or `https:`.

An entry with no `link` SHALL be included, rendering as an announcement without a call to action. An entry whose `link` is present but invalid SHALL be dropped entirely rather than returned without its link, so a broken call to action is never silently swallowed.

`description` SHALL be sanitized with the announcement allowlist (tags `a`, `b`, `strong`, `em`, `br`, `span`; attributes `href`, `target`, `rel`), with non-hash anchors rewritten to `target="_blank"` and `rel="noopener noreferrer"`. A description that is blank or sanitizes to an empty string SHALL be `null`. `title` and `link.label` SHALL be returned as plain text and SHALL NOT be interpreted as markup.

Every rejected entry SHALL be dropped and logged with a warning naming the entry and the reason. The service SHALL cap the returned list at the supported maximum, dropping and logging the excess. A malformed value (invalid JSON, or a JSON root that is not an array) SHALL result in `announcements: []` with a logged warning. Invalid announcements configuration SHALL NEVER cause the request to fail and SHALL NEVER suppress the banner's own announcement fields.

`AnnouncementItemDto` and `AnnouncementLinkDto` SHALL be declared as classes with `@ApiProperty` metadata on every field, so `@nestjs/swagger` emits runtime metadata and the generated client exposes the shape.

#### Scenario: A complete announcement is returned

- **WHEN** `ANNOUNCEMENTS` contains an entry with a title, a description, and an `https` link
- **THEN** the response is `200 OK` with that entry present, its description sanitized and its link intact

#### Scenario: Announcements not configured

- **WHEN** `ANNOUNCEMENTS` is not set
- **THEN** the response is `200 OK` with `config.announcements=[]`

#### Scenario: An entry without a link is kept

- **WHEN** an entry has a title but no `link` key
- **THEN** the entry is returned with `link: null`

#### Scenario: An entry with an invalid link href is dropped

- **WHEN** an entry's `link.href` is `javascript:alert(1)`, `data:text/html,x`, a relative path such as `/settings`, or an unparseable string
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: An entry with a blank link label is dropped

- **WHEN** an entry has a `link` whose `label` is blank or missing
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: An entry with a blank title is dropped

- **WHEN** an entry has a blank or missing `title`
- **THEN** that entry is absent from `config.announcements` and a warning is logged

#### Scenario: One bad entry does not discard the good ones

- **WHEN** `ANNOUNCEMENTS` contains one valid entry and one entry with a `javascript:` link href
- **THEN** `config.announcements` contains exactly the valid entry

#### Scenario: Descriptions are sanitized per entry

- **WHEN** an entry's description contains `<script>alert(1)</script>Hello`
- **THEN** the returned description contains no `<script>` element and retains `Hello`

#### Scenario: A description that sanitizes away becomes null

- **WHEN** an entry's description is `<script>alert(1)</script>`
- **THEN** the entry is returned with `description: null` rather than an empty string

#### Scenario: Titles are not treated as markup

- **WHEN** an entry's title is `Release <b>3.0</b>`
- **THEN** the returned title is the literal string `Release <b>3.0</b>`, unmodified

#### Scenario: Malformed JSON degrades to an empty list

- **WHEN** `ANNOUNCEMENTS` resolves to a value that is not an array
- **THEN** the response is `200 OK` with `config.announcements=[]`, a warning is logged, and the banner's `announcementTitle` / `announcementDescription` are still populated

#### Scenario: Excess entries are capped

- **WHEN** `ANNOUNCEMENTS` contains more entries than the supported maximum
- **THEN** `config.announcements` contains only the first N entries in configured order and a warning names the dropped ones
