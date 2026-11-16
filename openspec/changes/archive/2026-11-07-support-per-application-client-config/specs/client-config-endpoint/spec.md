## MODIFIED Requirements

### Requirement: GET /api/v1/client-config returns client-safe configuration

The system SHALL expose `GET /api/v1/client-config` as a versioned business endpoint (version `'1'`). It SHALL accept a required `appId` query parameter that matches `^[a-z0-9][a-z0-9-]{0,62}$` and is one of the application identifiers the deployment serves (`CLIENT_CONFIG_APP_IDS`, default `chat-ui`), and return all `visibility='client'` configuration values, including the new `dialCore.externalUrl` key added by the `config-registry-and-env-provider` capability.

**Authorization:** None required. The endpoint is public and MUST work before authentication.

**Caching:** In-memory cache via `@nestjs/cache-manager`. Cache key: `app-config:client:{encodedAppId}:user:{encodedUserId|anonymous}:roles:{sortedEncodedRoles|none}`, where each segment (and each role) is `encodeURIComponent`-encoded before joining. TTL: 60 seconds. Identity and roles MUST be included because role-gated flags can vary by caller. Future targeting dimensions MUST also be added to the cache key before they affect evaluation.

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
- **THEN** the body MUST NOT contain env var names, provider credentials, user IDs, roles, or internal metadata beyond `resolvedAt` and `cacheTtlSeconds`

#### Scenario: Response never exposes the internal DIAL_CORE_URL value

- **WHEN** a valid response is returned
- **THEN** the body MUST NOT contain the value of the internal `DIAL_CORE_URL` environment variable under any key


## ADDED Requirements

### Requirement: The deployment declares the application identifiers it serves

The backend SHALL read `CLIENT_CONFIG_APP_IDS`, a comma-separated list of application identifiers declared on `ClientUiEnv` in `apps/chat-api/src/config/env/client-ui.env.ts`. Entries SHALL be trimmed, de-duplicated preserving order, and each SHALL match `^[a-z0-9][a-z0-9-]{0,62}$`. A non-matching entry SHALL fail startup with an `Environment validation failed:` message naming the variable. An absent, empty or blank value SHALL mean `["chat-ui"]`. The list SHALL be at most 16 entries. Only `GET /api/v1/client-config` uses the list. Server-side feature evaluation (`FeatureGuard`, text refinement) SHALL keep evaluating with `appId` `chat-ui`, because those gates protect Chat BFF endpoints whichever frontend a deployment serves.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None. **Cache:** Unchanged key `app-config:client:<appId>:user:<userId>:roles:<roles>`, 60 s TTL; `appId` is already a segment.

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
