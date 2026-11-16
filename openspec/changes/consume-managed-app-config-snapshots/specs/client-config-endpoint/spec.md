## MODIFIED Requirements

### Requirement: GET /api/v1/client-config returns client-safe configuration

The system SHALL expose `GET /api/v1/client-config` as a versioned business endpoint (version `'1'`). It SHALL accept a required `appId` query parameter that matches `^[a-z0-9][a-z0-9-]{0,62}$` and is one of the application identifiers the deployment serves (`CLIENT_CONFIG_APP_IDS`, default `chat-ui`), and return all `visibility='client'` configuration values, including the new `dialCore.externalUrl` key added by the `config-registry-and-env-provider` capability.

**Authorization:** None required. The endpoint is public and MUST work before authentication.

**Caching:** In-memory cache via `@nestjs/cache-manager`. Cache key: `app-config:client:{encodedAppId}:user:{encodedUserId|anonymous}:roles:{sortedEncodedRoles|none}`, where each segment (and each role) is `encodeURIComponent`-encoded before joining. TTL: 60 seconds. Identity and roles MUST be included because role-gated flags can vary by caller. Future targeting dimensions MUST also be added to the cache key before they affect evaluation. When `MANAGED_CONFIG_MODE` is `active` and the `appId` is mapped to a Config Studio instance, the key SHALL end with `:managed:{encodedInstanceId}:{encodedRevisionId|none}:{state}`, so that a new revision and every change of managed state use a new entry. The TTL SHALL then be the smallest of 60 seconds, `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS` (so the request a tab sends at its hint is resolved again rather than answered with the cached hint), the time until the next `startsAt`/`endsAt` boundary of any active managed feature in the captured snapshot, and the time until that snapshot exceeds its maximum staleness, with a minimum of 1 second. In modes `off` and `shadow` the key and TTL SHALL be unchanged.

**operationId:** `getClientConfig` (handler method name on the controller).

**Feature flag:** Not gated.

**RTL impact:** None (backend-only).

**i18n impact:** None.

**Observability:** Latency and error rate captured by the existing `MetricsInterceptor`. Resolution debug log per key (key name + provider that resolved it). No config values in logs. Managed refresh and state metrics are defined by `managed-config-runtime-reader`.

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

#### Scenario: External connection origins

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called with
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

- **WHEN** `CLIENT_CONFIG_APP_IDS=launchpad,chat-ui` and `GET /api/v1/client-config?appId=launchpad` is called
- **THEN** the response is `200 OK` with `appId` `launchpad`, and its `features` and `config` equal those returned for `appId=chat-ui` under the same environment, session and roles

#### Scenario: Responses are cached per application

- **WHEN** the same user requests `appId=launchpad` and then `appId=chat-ui`
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

- **WHEN** the mode is `active`, `chat-ui` is mapped to `chat-dev`, a user's response for revision `R1` is cached, and revision `R2` is accepted 10 s later
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

### Requirement: The deployment declares the application identifiers it serves

The backend SHALL read `CLIENT_CONFIG_APP_IDS`, a comma-separated list of application identifiers declared on `ClientUiEnv` in `apps/chat-api/src/config/env/client-ui.env.ts`. Entries SHALL be trimmed, de-duplicated preserving order, and each SHALL match `^[a-z0-9][a-z0-9-]{0,62}$`. A non-matching entry SHALL fail startup with an `Environment validation failed:` message naming the variable. An absent, empty or blank value SHALL mean `["chat-ui"]`. The list SHALL be at most 16 entries. Only `GET /api/v1/client-config` uses the list. Server-side feature evaluation (`FeatureGuard`, text refinement) SHALL keep evaluating with `appId` `chat-ui`, because those gates protect Chat BFF endpoints whichever frontend a deployment serves.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None. **Cache:** Defined by "GET /api/v1/client-config returns client-safe configuration"; `appId` is always a segment, and a mapped `appId` in managed `active` mode also adds its instance, revision and state. A served identifier MAY additionally be mapped to a Config Studio instance (`MANAGED_CONFIG_INSTANCES`, see `managed-config-runtime-reader`); a mapping for an identifier this list does not serve SHALL fail startup.

#### Scenario: Default serves only Chat

- **WHEN** `CLIENT_CONFIG_APP_IDS` is unset
- **THEN** `appId=chat-ui` is accepted and `appId=launchpad` is `400 Bad Request`

#### Scenario: Invalid entry fails startup

- **WHEN** `CLIENT_CONFIG_APP_IDS=chat-ui,Bad_Id`
- **THEN** environment validation fails and names `CLIENT_CONFIG_APP_IDS` without printing other environment values

#### Scenario: Transitional list

- **WHEN** a Launchpad deployment sets `CLIENT_CONFIG_APP_IDS=launchpad,chat-ui` while older Launchpad builds still send `chat-ui`
- **THEN** both the old and the new builds receive `200 OK`

#### Scenario: Server-side gates keep the Chat contract

- **WHEN** a deployment sets `CLIENT_CONFIG_APP_IDS=launchpad` and a request reaches an endpoint protected by `FeatureGuard`
- **THEN** the feature is evaluated with `appId` `chat-ui`, exactly as before this change

## ADDED Requirements

### Requirement: client-config carries optional managed fields

In `MANAGED_CONFIG_MODE=active`, the response of `GET /api/v1/client-config` for an `appId` mapped to a Config Studio instance SHALL add these optional fields. Every existing field, its type, and its order SHALL be unchanged, and so SHALL `Cache-Control: private, no-store`. The added fields:

- `metadata.managed`, with:
  - `instanceId`;
  - `state`, one of `fresh`, `degraded`, `stale`, `unavailable`, `not_published`;
  - when the state is `fresh` or `degraded`, also `revisionId`, `schemaVersion`, and `publishedAt`.
- `metadata.nextRefreshAt`: an ISO instant. It SHALL be the earliest of the resolution time plus `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS`, the next window boundary of an active managed feature, and the snapshot's staleness expiry.
- `appConfig`, only for an `appId` other than `chat-ui` with a usable snapshot (see `managed-config-activation`). It is `{ schemaVersion, schemaSha256, revisionId, publishedAt, payload }`, where `payload` is an arbitrary JSON object.

In modes `off` and `shadow`, and for an unmapped `appId`, none of these fields SHALL be present. The fields SHALL NOT carry operator identities, publication reasons, revision hashes other than `schemaSha256` in `appConfig`, roles, policy definitions of features, or credentials.

Example request and response (`active`, `chat-ui` → `chat-dev`, `welcomeScreen.description` active):

```http
GET /api/v1/client-config?appId=chat-ui
200 OK
Cache-Control: private, no-store

{
  "appId": "chat-ui",
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
  "features": { "...": "chat-ui environment values" },
  "config": { "...": "chat-ui environment values" },
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

- **WHEN** `appId=chat-ui` is served from a fresh snapshot
- **THEN** the response has no `appConfig`

#### Scenario: Refresh hint follows the next boundary

- **WHEN** `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS=120` and an active managed feature's `endsAt` is 45 s after resolution
- **THEN** `metadata.nextRefreshAt` is the `endsAt` instant

#### Scenario: Generated client exposes the optional fields

- **WHEN** `npm run openapi` runs
- **THEN** the generated `ClientConfigResponseDto` has optional `appConfig`, and `ClientConfigMetadataDto` has optional `nextRefreshAt` and `managed`
