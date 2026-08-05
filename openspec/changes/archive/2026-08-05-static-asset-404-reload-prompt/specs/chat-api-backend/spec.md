## MODIFIED Requirements

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
