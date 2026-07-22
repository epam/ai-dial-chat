# applications-write-api Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.

## Requirements

### Requirement: Create application endpoint
The backend SHALL expose `POST /api/v1/applications` that creates a Quick App by proxying
DIAL Core (`saveCustomApplication`) using the caller's session access token. The request body
SHALL be validated via `CreateApplicationBodyDto`, including an optional `intro` string field
limited to 90 characters. When `intro` is provided, it SHALL be forwarded to DIAL Core as part
of the create request body. The per-user applications list cache SHALL be invalidated on
success, and DIAL Core error statuses SHALL be mapped to typed HTTP responses.

#### Scenario: Successful create with intro
- **WHEN** an authenticated user POSTs a valid application body including an `intro` of 90
  characters or fewer
- **THEN** the service includes `intro` in the DIAL Core create request and returns the
  created application identifier

#### Scenario: Successful create without intro
- **WHEN** an authenticated user POSTs a valid application body with `intro` omitted or empty
- **THEN** the create succeeds and no `intro` value is sent to DIAL Core

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation (for example, `name` is missing)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Intro exceeds the character limit
- **WHEN** an authenticated user POSTs an application body with `intro` longer than 90
  characters
- **THEN** the endpoint responds with a 400 validation error and does not call DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Endpoint is versioned, rate-limited, and documented
The create-application endpoint SHALL be URI-versioned at `/api/v1/applications`, SHALL
declare a `@Throttle` rate limit, and SHALL document every response status via
`@ApiResponse`, including the `intro` field's `maxLength: 90` constraint in the Swagger
schema for `CreateApplicationBodyDto`.

#### Scenario: OpenAPI contract regenerated
- **WHEN** the `intro` field is added to `CreateApplicationBodyDto`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` `CreateApplicationBodyDto` type includes `intro`

#### Scenario: Authentication required
- **WHEN** a request to the create endpoint has no valid session cookie
- **THEN** the endpoint responds with 401

### Requirement: Update application endpoint

The backend SHALL expose `PATCH /api/v1/applications/:applicationName` that updates the
General-step fields (`name`, `description`, `iconUrl`, `topics`, `intro`) of an existing
Quick App for the authenticated session user. The `applicationName` path parameter SHALL
be validated the same way as the delete endpoint's `GetApplicationDto`. The request body
SHALL be validated via `UpdateApplicationBodyDto`, which carries the same field
constraints as `CreateApplicationBodyDto` minus `type` and `version` (immutable on
update). The service SHALL resolve the existing DIAL Core application resource (bucket +
path) the same way `deleteApplication` does, fetch the current stored application via
DIAL Core (`getCustomApplication`), merge only the supplied General-step fields into it —
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
  with updated `name`, `description`, `iconUrl`, `topics`, and `intro` for an application
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
- **WHEN** the request body fails DTO validation (for example, `intro` exceeds 90
  characters, or `name` contains disallowed characters)
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
- **WHEN** `UpdateApplicationBodyDto` and the `updateApplication` operation are added
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` exposes `ApplicationsApi.updateApplication(...)` with
  an `UpdateApplicationBodyDto` type

### Requirement: Delete application endpoint

The backend SHALL expose `DELETE /api/v1/applications/:applicationName` that deletes an
application for the authenticated session user by proxying DIAL Core
(`deleteCustomApplication`), using the caller's session access token. The
`applicationName` path parameter SHALL be validated with the same allowlist pattern used
by `GetToolsetDto.toolsetName` (`DEPLOYMENT_ID_PATTERN`/`DEPLOYMENT_ID_VALIDATION_MESSAGE`),
via a new `GetApplicationDto`. The bucket/path SHALL be resolved by parsing an
`applications/{bucket}/{path}` id when present, falling back to the caller's own bucket
plus the encoded name otherwise (mirroring `ToolsetsService.resolveToolsetResource`). On
success, the per-user applications list cache (`applications:list:${userSub}`) SHALL be
invalidated, and the per-user deployments list cache SHALL also be invalidated via
`DeploymentsService.invalidateListCache(userSub)` (clearing `deployments:list:${userSub}`
and each `deployments:list:${userSub}:interface:<type>` entry), since the Catalog UI's
application list is read through `DeploymentsService.listDeployments`, not through the
applications list cache. DIAL Core error statuses SHALL be mapped to typed HTTP responses.

The endpoint SHALL be URI-versioned at `/api/v1/applications/:applicationName`, rate-limited
via `@Throttle({ default: { limit: 10, ttl: 60000 } })` (same limit as
`createToolset`/`deleteToolset`), documented via `@nestjs/swagger` (`@ApiOperation` with
`operationId: 'deleteApplication'`, `@ApiResponse` for every status below), and requires an
authenticated session (no additional role restriction — any authenticated user may delete
their own application, matching `deleteToolset`'s authorization model).

**Generated-client impact**: none — this change only alters server-side cache invalidation
side effects. The endpoint's request/response shape, `operationId`, and generated
`ApplicationsApi.deleteApplication({ applicationName })` method signature are unchanged; no
`npm run openapi` regeneration is required.

**Module wiring**: `ApplicationsModule` SHALL import `DeploymentsModule` (mirroring
`ToolsetsModule`) so `ApplicationsService` can constructor-inject `DeploymentsService`.

#### Scenario: Successful delete
- **WHEN** an authenticated user sends `DELETE /api/v1/applications/my-app__1.0`
  for an application they own
- **THEN** the service resolves the caller's bucket/path, proxies the delete to DIAL
  Core's `deleteCustomApplication`, invalidates `applications:list:${userSub}` and
  `deployments:list:${userSub}` (plus its per-interface variants), and responds with
  `204 No Content`

#### Scenario: Deployments list cache is cleared alongside the applications list cache
- **WHEN** a delete succeeds and a client subsequently calls `GET /api/v1/deployments`
  (the endpoint backing the Catalog list) for the same user, within what would have been
  the prior cache TTL window
- **THEN** the response no longer includes the deleted application, because
  `deployments:list:${userSub}` (and its `:interface:<type>` variants) were invalidated by
  the delete, not served stale

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
- **WHEN** the caller exceeds 10 delete requests within 60 seconds
- **THEN** the endpoint responds `429 Too Many Requests`

#### Scenario: DIAL Core error
- **WHEN** DIAL Core returns an error status while deleting
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. `502`/`503`)

Example request/response:

```
DELETE /api/v1/applications/applications%2Fusers%2Fu-123%2Fmy-app__1.0.0 HTTP/1.1
Cookie: session=...

HTTP/1.1 204 No Content
```
