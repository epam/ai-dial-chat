## ADDED Requirements

### Requirement: GET /api/v1/client-config returns client-safe configuration

The system SHALL expose `GET /api/v1/client-config` as a versioned business endpoint (version `'1'`). It SHALL accept a required `appId` query parameter, validate it against an allowlist, and return all `visibility='client'` configuration values.

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
      "transcribeSizeLimitBytes": 10485760
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

---

### Requirement: Response DTO is fully annotated for Swagger and generated client

`ClientConfigResponseDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL use `@ApiProperty` on every field so that the generated `@epam/chat-api-client` produces strongly-typed `AppConfigApi.getClientConfig()` with a concrete response type (not `void` or `any`).

**Generated client impact:**
- `operationId`: `getClientConfig`
- SDK method: `AppConfigApi.getClientConfig({ appId: 'chat-ui' })`
- Request DTO: `GetClientConfigDto` with `appId: string`
- Response DTO: `ClientConfigResponseDto` with `appId`, `features`, `config`, `metadata`
- Frontend callers use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Generated client method is typed

- **WHEN** `npm run openapi` is run after the endpoint is added
- **THEN** `libs/chat-api-client/src/generated/src/apis/AppConfigApi.ts` EXISTS
- **AND** the `getClientConfig` method has a return type of `Promise<ClientConfigResponse>` (not `Promise<void>` or `Promise<any>`)

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
