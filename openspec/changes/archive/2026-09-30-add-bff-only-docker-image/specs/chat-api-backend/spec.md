## MODIFIED Requirements

### Requirement: Health check endpoint

The application SHALL expose `GET /api/health` returning HTTP 200 with a JSON body containing at minimum `{ "status": "ok" }`. This endpoint SHALL be exempt from authentication.

The response body SHALL additionally include a `buildId` string field: a stable identifier for the running deployment, computed once when the application process starts (no dedicated deploy-time environment variable required). When the built frontend's `index.html` is available (the `ai-dial-chat` image), `buildId` SHALL be derived by hashing that file, so it changes whenever a new deployment replaces the served frontend static assets. When no built frontend is available (the BFF-only `ai-dial-chat-bff` image, or local development running only `chat-api`), `buildId` SHALL be derived by hashing the resolved app version, the same value reported as `version`, so it changes whenever a deployment with a different version replaces the running one. In both cases `buildId` SHALL stay constant across repeated calls against the same running process, and every pod serving the same deployed image with the same configuration SHALL report the same `buildId`. This field is the mechanism the frontend uses to detect that a newer build has been deployed while a tab is open (see the `frontend-new-version-reload` capability).

The response body SHALL additionally include a `version` string field carrying the same value as
the `config.appVersion` field of the client config response: the `CHAT_VERSION` environment
variable when it is set and non-blank, otherwise the `version` field of the workspace root
`package.json` (the only manifest the release pipeline stamps). Both surfaces SHALL derive it from the shared `resolveAppVersion`
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
- **THEN** `version` falls back to the `version` field of the workspace root `package.json` and is never
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

#### Scenario: No built frontend on disk derives the build identifier from the version

- **WHEN** the backend process starts without a built frontend `dist/index.html` available (the BFF-only image, or local development running only `chat-api`)
- **THEN** `buildId` is the 12-character hex prefix of the SHA-256 of the resolved app version, is non-empty, and stays the same for the lifetime of that process without requiring any additional configuration

#### Scenario: BFF-only build identifier changes with the version

- **WHEN** a BFF-only deployment reporting `version: "1.4.0"` is replaced by one reporting `version: "1.4.1"` (via the stamped root `package.json` or `CHAT_VERSION`)
- **THEN** the `buildId` returned after the replacement differs from the one returned before it
