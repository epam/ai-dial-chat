## MODIFIED Requirements

### Requirement: Create application endpoint
The backend SHALL expose `POST /api/v1/applications` that creates a Quick App by proxying
DIAL Core (`saveCustomApplication`) using the caller's session access token. The request body
SHALL be validated via `CreateApplicationBodyDto`. The per-user applications list cache SHALL
be invalidated on success, and DIAL Core error statuses SHALL be mapped to typed HTTP
responses. `CreateApplicationBodyDto` SHALL NOT define an `intro` field — the `intro` field is
removed from the request/response contract entirely; a request body that still includes an
`intro` property SHALL be rejected with a 400 (the global `ValidationPipe`'s
`forbidNonWhitelisted` behavior applies to any property not declared on the DTO).

#### Scenario: Successful create
- **WHEN** an authenticated user POSTs a valid application body
- **THEN** the service proxies the create to DIAL Core and returns the created application
  identifier

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation (for example, `name` is missing)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Request body still includes intro
- **WHEN** an authenticated user POSTs an application body that includes an `intro` property
- **THEN** the endpoint responds with a 400 validation error (unknown property) and does not
  call DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Endpoint is versioned, rate-limited, and documented
The create-application endpoint SHALL be URI-versioned at `/api/v1/applications`, SHALL
declare a `@Throttle` rate limit, and SHALL document every response status via
`@ApiResponse`. The Swagger schema for `CreateApplicationBodyDto` SHALL NOT reference an
`intro` field.

#### Scenario: OpenAPI contract regenerated after intro removal
- **WHEN** the `intro` field is removed from `CreateApplicationBodyDto`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` `CreateApplicationBodyDto` type no longer includes `intro`

#### Scenario: Authentication required
- **WHEN** a request to the create endpoint has no valid session cookie
- **THEN** the endpoint responds with 401

### Requirement: Update application endpoint

The backend SHALL expose `PATCH /api/v1/applications/:applicationName` that updates the
General-step fields (`name`, `description`, `iconUrl`, `topics`) of an existing
Quick App for the authenticated session user. The `applicationName` path parameter SHALL
be validated the same way as the delete endpoint's `GetApplicationDto`. The request body
SHALL be validated via `UpdateApplicationBodyDto`, which carries the same field
constraints as `CreateApplicationBodyDto` minus `type` and `version` (immutable on
update). `UpdateApplicationBodyDto` SHALL NOT define an `intro` field. The service SHALL
resolve the existing DIAL Core application resource (bucket + path) the same way
`deleteApplication` does, fetch the current stored application via DIAL Core
(`getCustomApplication`), merge only the supplied General-step fields into it —
preserving `application_type_schema_id`, `displayVersion`, and `application_properties`
(including orchestrator/tool set settings) untouched — and persist the merged result via
`saveCustomApplication` at the same resource path. On success, the per-user applications
list cache and deployments list cache SHALL both be invalidated, mirroring
`deleteApplication`'s cache invalidation. DIAL Core error statuses SHALL be mapped to
typed HTTP responses.

The endpoint SHALL be URI-versioned at `/api/v1/applications/:applicationName`,
rate-limited via `@Throttle({ default: { limit: 10, ttl: 60000 } })` (same limit as
create/delete), and documented via `@nestjs/swagger` (`@ApiOperation` with
`operationId: 'updateApplication'`, `@ApiResponse` for every status below). Authorization
matches `deleteApplication`: any authenticated user may update their own application, no
additional role restriction.

#### Scenario: Successful update
- **WHEN** an authenticated user PATCHes `/api/v1/applications/applications%2Fusers%2Fu-123%2Fmy-app__1.0.0`
  with updated `name`, `description`, `iconUrl`, and `topics` for an application
  they own
- **THEN** the service fetches the existing stored application, merges in only the
  supplied General-step fields, persists it at the same resource path, invalidates the
  applications and deployments list caches, and responds `200 OK` with the updated
  application identifier

#### Scenario: Settings-step configuration is preserved
- **WHEN** the update request omits `applicationProperties`/orchestrator or tool set data
  (the update endpoint does not accept those fields at all)
- **THEN** the existing `application_properties`, `application_type_schema_id`, and
  `displayVersion` already stored for that application are carried through unchanged in
  the merged body sent to DIAL Core

#### Scenario: Invalid update body
- **WHEN** the request body fails DTO validation (for example, `name` contains disallowed
  characters, or the body includes an unknown `intro` property)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Invalid application name
- **WHEN** the `applicationName` path parameter contains characters disallowed by
  `DEPLOYMENT_ID_PATTERN`
- **THEN** the endpoint responds `400 Bad Request` and does not call DIAL Core

#### Scenario: Not authenticated
- **WHEN** the request has no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Application not found
- **WHEN** DIAL Core reports the resolved application path does not exist
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: Rate limit exceeded
- **WHEN** the caller exceeds 10 update requests within 60 seconds
- **THEN** the endpoint responds `429 Too Many Requests`

#### Scenario: DIAL Core error
- **WHEN** DIAL Core returns an error status while fetching or saving the application
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. `502`/`503`)

#### Scenario: OpenAPI contract regenerated
- **WHEN** `UpdateApplicationBodyDto` and the `updateApplication` operation no longer
  include `intro`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` exposes `ApplicationsApi.updateApplication(...)` with
  an `UpdateApplicationBodyDto` type that has no `intro` field
