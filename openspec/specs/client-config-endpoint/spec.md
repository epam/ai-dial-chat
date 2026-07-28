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

---

### Requirement: client-config response includes the announcement message

`GET /api/v1/client-config` SHALL include an `announcementHtml` field of type `string | null` in the `config` object of its response, sourced from the `announcement.html` registry key. The field SHALL carry the operator-configured message when set and SHALL be `null` when `ANNOUNCEMENT_HTML_MESSAGE` is not configured. The `ClientConfigDto` response DTO SHALL declare this field with Swagger metadata so the generated `@epam/chat-api-client` exposes it.

#### Scenario: Announcement message configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is set to `Welcome to DIAL!`
- **THEN** the response is `200 OK` with `config.announcementHtml="Welcome to DIAL!"`

#### Scenario: Announcement message not configured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ANNOUNCEMENT_HTML_MESSAGE` is not set
- **THEN** the response is `200 OK` with `config.announcementHtml=null`
