## MODIFIED Requirements

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
