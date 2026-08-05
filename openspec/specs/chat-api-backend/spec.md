## Purpose

Define the Chat API application's bootstrap, security, validation, health, rate-limiting, and
theme-service requirements.

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

#### Scenario: Health check returns 200

- **WHEN** `GET /api/health` is called
- **THEN** the response is HTTP 200 with `{ "status": "ok" }`

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

`ThemeService.getThemes()` SHALL cache the result using `@nestjs/cache-manager` for a configurable TTL (default: 60 seconds). Subsequent calls within the TTL SHALL return the cached value without making a new external HTTP request.

#### Scenario: Second call returns cached result

- **WHEN** `GET /api/themes` is called twice within the cache TTL
- **THEN** the external themes service receives only one HTTP request
