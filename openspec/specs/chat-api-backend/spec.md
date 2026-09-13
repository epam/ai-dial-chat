## Purpose

Define the Chat API application's bootstrap, security, validation, health, rate-limiting,
shared in-memory cache, and theme-service requirements.

## Requirements

---

### Requirement: Environment variable validation at startup

The application SHALL validate required environment variables at bootstrap using a `class-validator`-decorated `EnvironmentVariables` class passed to `ConfigModule.forRoot({ validate })`. The application SHALL fail fast with a clear error if `DIAL_CORE_URL`, `DIAL_API_KEY`, or `THEMES_CONFIG_URL` are missing or invalid.

#### Scenario: Valid environment starts the application

- **WHEN** all required environment variables are present and valid
- **THEN** the application bootstraps successfully

#### Scenario: Missing required variable prevents startup

- **WHEN** a required environment variable is absent
- **THEN** the application throws a validation error and exits before accepting requests

---

### Requirement: Icon name input validation

`GET /api/themes/icon` SHALL validate the `iconName` query parameter via a DTO decorated with `@Matches(/^[a-zA-Z0-9_-]+$/)`. Requests with unsafe characters (e.g. path traversal sequences) SHALL return HTTP 400.

#### Scenario: Valid icon name returns SVG

- **WHEN** `iconName` contains only alphanumeric characters, dashes, and underscores
- **THEN** the endpoint returns the SVG content with status 200

#### Scenario: Path traversal attempt returns 400

- **WHEN** `iconName` contains `../` or other unsafe characters
- **THEN** the endpoint returns HTTP 400

#### Scenario: Missing iconName returns 400

- **WHEN** the `iconName` query parameter is absent
- **THEN** the endpoint returns HTTP 400

---

### Requirement: Proper HTTP error codes from ThemeService

`ThemeService` SHALL throw typed NestJS HTTP exceptions rather than returning `null`:
- `NotFoundException` (404) when a requested icon is not found at the external service
- `ServiceUnavailableException` (503) when the external themes service is unreachable
- `BadGatewayException` (502) when the external service returns an invalid response

#### Scenario: Icon not found returns 404

- **WHEN** the external themes service returns a 404 for the requested icon
- **THEN** `GET /api/themes/icon` returns HTTP 404 to the client

#### Scenario: Themes service unavailable returns 503

- **WHEN** the external themes service is unreachable (network error or timeout)
- **THEN** `GET /api/themes` and `GET /api/themes/icon` return HTTP 503

---

### Requirement: NestJS Logger in ThemeService

`ThemeService` SHALL use an injected `Logger` instance for all log output. `console.log` calls SHALL be replaced with structured logger calls at the appropriate log level (`debug`, `log`, `warn`, `error`).

#### Scenario: Theme fetch logged at debug level

- **WHEN** `getThemeIcon` is called
- **THEN** the fetch attempt is logged via `this.logger.debug()`, not `console.log`

---

### Requirement: Health check endpoint

The application SHALL expose `GET /api/health` returning HTTP 200 with a JSON body containing at minimum `{ "status": "ok" }`. This endpoint SHALL be exempt from rate limiting and authentication.

The response body SHALL additionally include a `buildId` string field: a stable identifier for the currently served frontend deployment, derived by hashing the built frontend's `index.html` once when the application process starts (no dedicated deploy-time environment variable required). `buildId` SHALL change whenever a new deployment replaces the served frontend static assets, and SHALL stay constant across repeated calls against the same running process. Because every pod serving the same deployed image bundles an identical `index.html`, all pods behind a load balancer report the same `buildId` for a given deployment. This field is the mechanism the frontend uses to detect that a newer build has been deployed while a tab is open (see the `frontend-new-version-reload` capability).

The response body SHALL additionally include a `version` string field carrying the same value as
the `config.appVersion` field of the client config response: the `CHAT_VERSION` environment
variable when it is set and non-blank, otherwise the `version` field of
`apps/chat-api/package.json`. Both surfaces SHALL derive it from the shared `resolveAppVersion`
helper (`apps/chat-api/src/common/utils/app-version.ts`, see the `chat-version-display`
capability), so one deployment can never report two different versions on two endpoints.

#### Scenario: Health check returns 200

- **WHEN** `GET /api/health` is called
- **THEN** the response is HTTP 200 with `{ "status": "ok" }`

#### Scenario: Health check version matches the client config version

- **WHEN** `CHAT_VERSION=2026.08.10-a1b2c3d` is set and `GET /api/health` is called
- **THEN** the response `version` is `"2026.08.10-a1b2c3d"`, the same value `GET /api/v1/app-config`
  reports as `config.appVersion`
- **AND WHEN** `CHAT_VERSION` is unset or blank
- **THEN** `version` falls back to the `version` field of `apps/chat-api/package.json` and is never
  an empty string or a placeholder

#### Scenario: Health check includes a stable build identifier

- **WHEN** `GET /api/health` is called twice against the same running deployment
- **THEN** both responses include the same non-empty `buildId` string, for example:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-05-07T20:00:00.000Z",
    "version": "1.0.0",
    "buildId": "3f9a1c2b8e7d"
  }
  ```

#### Scenario: Build identifier changes across deployments

- **WHEN** a new version of the application is deployed with a rebuilt frontend `index.html`
- **THEN** subsequent calls to `GET /api/health` return a `buildId` different from the one returned by the previous deployment

#### Scenario: No built frontend on disk falls back to a per-process value

- **WHEN** the backend process starts without a built frontend `dist/index.html` available (e.g. local development running only `chat-api`)
- **THEN** `buildId` still resolves to a stable, non-empty value for the lifetime of that process, computed without requiring any additional configuration

---

### Requirement: Security headers via Helmet

The application SHALL apply `helmet()` middleware in `main.ts` to set standard HTTP security
headers (CSP, HSTS, X-Frame-Options, etc.) on all responses. The configured
Cross-Origin-Opener-Policy SHALL be `same-origin-allow-popups` so cross-origin OAuth provider
navigation does not sever the initiating Chat tab's popup reference; OAuth popups SHALL
independently clear their own `window.opener` before external navigation to retain
reverse-tabnabbing protection.

#### Scenario: Security headers present on API responses

- **WHEN** any API endpoint is called
- **THEN** the response includes `X-Content-Type-Options: nosniff` and `X-Frame-Options`

#### Scenario: OAuth-compatible opener policy

- **WHEN** any Chat page is served through the API application
- **THEN** its `Cross-Origin-Opener-Policy` response header is
  `same-origin-allow-popups`

---

### Requirement: Rate limiting on public endpoints

The application SHALL configure `@nestjs/throttler` globally. Theme endpoints (`/api/themes`, `/api/themes/icon`) SHALL be subject to the default throttle limit. Requests exceeding the limit SHALL return HTTP 429.

#### Scenario: Excessive requests return 429

- **WHEN** a client exceeds the configured request rate for a theme endpoint
- **THEN** the endpoint returns HTTP 429 Too Many Requests

---

### Requirement: In-memory caching for theme configuration

`ThemeService.getThemes()` SHALL cache the result under `themes:config` using the shared
`@nestjs/cache-manager` cache and its default TTL of 5 minutes. Subsequent calls while the
entry remains present and unexpired SHALL return the cached value without making a new
external HTTP request. Expiration, capacity eviction, or explicit invalidation SHALL cause
the next call to fetch and cache a fresh result.

#### Scenario: Second call returns cached result

- **WHEN** `GET /api/themes` is called again after the first call completes, within the cache TTL
- **AND** the cached entry has not been evicted or explicitly invalidated
- **THEN** the external themes service receives only one HTTP request

#### Scenario: Evicted theme configuration is fetched again

- **WHEN** `themes:config` is evicted because the shared cache reaches its capacity
- **AND** `GET /api/themes` is called again before the original TTL would have expired
- **THEN** the external themes service receives a new HTTP request
- **AND** the successful result is cached under `themes:config`

---

### Requirement: Bounded shared application cache

`AppModule` SHALL own one global in-memory cache shared by backend services in each
application process. The cache SHALL retain at most 100 entries across all service keys
and SHALL evict the least recently used entry when adding a new entry at capacity.
Successful reads SHALL refresh an entry's recency for eviction. This limit SHALL apply
to the number of entries, regardless of their individual byte sizes.

The cache SHALL use a default TTL of 300,000 milliseconds and SHALL honor per-entry TTL
overrides in milliseconds. A TTL of zero SHALL disable time-based expiration while
leaving the entry subject to capacity eviction and explicit invalidation. Expired
entries SHALL return a cache miss on reads. A background sweep SHALL run every 60
seconds and physically remove expired entries even when their keys are never read again.

The cache SHALL preserve object references and `Buffer` values without cloning or
serialization. Explicit deletion SHALL remove the selected key, and clearing SHALL
remove all entries. When the Nest application module is destroyed, the cache SHALL
stop its cleanup timer and release its retained entries.

#### Scenario: Least recently used entry is evicted at capacity

- **WHEN** 100 distinct unexpired entries have been cached
- **AND** the oldest entry is read successfully before a 101st distinct entry is written
- **THEN** the least recently used entry is evicted and the recently read entry remains
- **AND** the new entry is present and the stored entry count is 100

#### Scenario: Expired entries are removed without further reads

- **WHEN** a cached entry expires and its key is never read again
- **THEN** the next background sweep physically removes the entry
- **AND** unexpired entries remain cached

#### Scenario: Repeated unique keys do not accumulate indefinitely

- **WHEN** successive batches of 1,000 distinct keys are written with a 20-millisecond TTL
- **THEN** the stored entry count is at most 100 after each write
- **AND** after each batch expires and a background sweep runs, none of its entries remain

#### Scenario: Default TTL and per-entry overrides are honored

- **WHEN** entries are written with no TTL override, a 30,000-millisecond TTL, and a
  600,000-millisecond TTL, respectively, without subsequent eviction or invalidation
- **THEN** reads after 30 seconds return a miss for the short-lived entry
- **AND** the default entry remains readable until its 5-minute TTL expires
- **AND** the entry with the longer override remains readable until its 10-minute TTL expires

#### Scenario: Zero TTL disables expiration

- **WHEN** an entry is written with a TTL of zero
- **THEN** elapsed time and background sweeps do not expire it
- **AND** it remains subject to capacity eviction and explicit invalidation

#### Scenario: Binary values and object references are preserved

- **WHEN** a `Buffer` containing binary icon data and a configuration object are cached
- **THEN** reads before expiration or eviction return the original `Buffer` and object references
- **AND** the binary bytes remain unchanged

#### Scenario: Explicit deletion and clearing release entries

- **WHEN** a service deletes a cached key
- **THEN** that key is physically removed and other entries remain
- **WHEN** the cache is cleared
- **THEN** no entries remain

#### Scenario: Application shutdown releases cache resources

- **WHEN** the Nest application module is destroyed
- **THEN** the background cleanup timer is stopped
- **AND** all entries retained by the cache are cleared
