# deployment-route-proxy Specification

## Purpose
TBD - created by archiving change add-deployment-route-proxy. Update Purpose after archive.
## Requirements
### Requirement: Generic route proxy endpoint

The BFF SHALL expose `GET`, `POST`, `PUT` and `DELETE` on `/api/v1/deployment-route/:id/*path` (URI version `v1`), implemented by `DeploymentRouteController` in `apps/chat-api/src/deployment-route/deployment-route.controller.ts`. `:id` is the DIAL deployment ID, which MAY contain slashes (for example `applications/public/name__1.0.0`) and SHALL be sent URL-encoded as a single segment. `*path` is the route path inside the application (for example `v1/items/ITEM1/details`). The endpoint SHALL contain no application-specific logic: any deployment ID and any path SHALL be forwarded the same way. Any other method (`HEAD`, `PATCH`, …) SHALL be answered 405 without a Core call.

#### Scenario: A route of any application is reached
- **WHEN** an authenticated user calls `GET /api/v1/deployment-route/applications%2Fpublic%2Fdemo-service__1.0.0/v1/items/ITEM1`
- **THEN** the BFF sends `GET {DIAL_CORE_URL}/v1/deployments/applications/public/demo-service__1.0.0/route/v1/items/ITEM1` to Core

#### Scenario: Another application needs no code change
- **WHEN** the same endpoint is called with a different deployment ID and path
- **THEN** it is forwarded to that deployment's route in the same way, with no BFF configuration or code change

#### Scenario: Unsupported method
- **WHEN** a `PATCH` or `HEAD` request is sent to the endpoint
- **THEN** the BFF answers 405 and sends nothing to Core

### Requirement: Caller identity

The proxy SHALL authenticate the call with the caller's own session access token as `Authorization: Bearer <token>`, and SHALL NOT use a service credential, forward the browser's cookies, or return the token to the client. The endpoint SHALL sit behind the global session and CSRF guards, so an unauthenticated call is refused before any Core call and a write needs a valid CSRF token. Core SHALL remain the authority for route `userRoles`, permissions and rate limits; the proxy SHALL add no authorization of its own.

#### Scenario: The user's token is used
- **WHEN** a signed-in user calls the proxy
- **THEN** the request to Core carries that user's access token and no other credential

#### Scenario: No session
- **WHEN** a request has no valid session
- **THEN** it is refused by the global guard and Core is not called

#### Scenario: Core refuses the caller
- **WHEN** Core answers 401 or 403 for the route
- **THEN** that status and body are relayed to the caller unchanged

### Requirement: Request forwarding

The proxy SHALL forward the query string unchanged. For `POST`, `PUT` and `DELETE` it SHALL forward a non-empty JSON request body as `application/json` and send no body otherwise. It SHALL percent-encode each segment of the deployment ID and of the path, keeping the slashes between segments, and SHALL send the request to the host configured by `DIAL_CORE_URL` only, never to a host taken from the request. It SHALL NOT follow redirects, and SHALL abort a Core call that exceeds 60 seconds.

#### Scenario: Query and body pass through
- **WHEN** a caller sends `POST …/v1/items?dryRun=true` with JSON `{ "name": "n1" }`
- **THEN** Core receives the same query string and that JSON body with `Content-Type: application/json`

#### Scenario: Bodyless call
- **WHEN** a caller sends a `GET` or a `DELETE` without a body
- **THEN** Core receives no body

### Requirement: Faithful response relay

The proxy SHALL answer with Core's status code and body bytes unchanged, including error statuses and their bodies (for example 409 and 422 with a JSON error envelope), SHALL relay the upstream `Content-Type`, and SHALL set `Cache-Control: private, no-store`. It SHALL NOT wrap the body in an envelope or filter its fields.

#### Scenario: An upstream error reaches the caller intact
- **WHEN** the upstream service answers 422 with `{ "error": "validation_failed", "issues": [...] }`
- **THEN** the caller receives status 422 and that exact JSON body

### Requirement: Path safety

The proxy SHALL refuse with 400, before any Core call, a deployment ID or path that contains a `.` or `..` segment after decoding, so a request cannot step outside `/v1/deployments/{id}/route/`.

#### Scenario: Dot segment in the path
- **WHEN** a raw request is sent for `…/v1/%2E%2E/admin`
- **THEN** the BFF answers 400 and sends nothing to Core

#### Scenario: Dot segment in the deployment ID
- **WHEN** the encoded deployment ID decodes to `a/../b`
- **THEN** the BFF answers 400 and sends nothing to Core

### Requirement: Core failures

When Core cannot be reached the proxy SHALL answer 503, and when the 60-second deadline passes it SHALL answer 504, each without exposing internal error text. Unexpected failures SHALL be logged with the method, deployment ID and path, never the token or request body.

#### Scenario: Core unreachable
- **WHEN** the call to Core fails with a network error
- **THEN** the BFF answers 503

#### Scenario: Core too slow
- **WHEN** the call to Core is aborted by the deadline
- **THEN** the BFF answers 504

### Requirement: Not part of the generated API client

The endpoint SHALL be excluded from the OpenAPI document (`@ApiExcludeEndpoint`) because a pass-through has no business schema. The generated-client impact is none: no operationId, request DTO or response DTO is added, and frontend callers SHALL reach it through a thin hand-written wrapper rather than a generated method. Feature gating: none (no `ENABLED_FEATURES` key); observability: the global metrics interceptor applies, with no custom metric.

#### Scenario: Hidden from OpenAPI
- **WHEN** the OpenAPI document is generated
- **THEN** it contains no `deployment-route` path

