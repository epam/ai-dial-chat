## MODIFIED Requirements

---

### Requirement: Create application endpoint
The backend SHALL expose `POST /api/v1/applications` that creates an application — a Quick App
or a plain custom application — by proxying DIAL Core (`saveCustomApplication`) using the
caller's session access token. The full request/response contract and DIAL Core body mapping
are owned by the `application-create-api` capability; this requirement covers only the write
surface shared with update and delete. The request body
SHALL be validated via `CreateApplicationBodyDto`. On success, the per-user applications list
cache (`applications:list:<userSub>`) SHALL be invalidated, and the per-user deployments list
cache SHALL also be invalidated via `DeploymentsService.invalidateListCache(userSub)` (clearing
`deployments:list:<userSub>` and each `deployments:list:<userSub>:interface:<type>` entry),
mirroring `updateApplication`'s and `deleteApplication`'s cache invalidation — since the Catalog
UI's application list, and the application editor's own edit-mode deployment resolution, are
both read through `DeploymentsService.listDeployments`, not through the applications list cache.
Without this, a client that creates an application and then reloads (or otherwise re-fetches the
deployments list) within the prior cache TTL window would not see the new application at all,
losing its name and every other field wherever the deployments list drives display. DIAL Core
error statuses SHALL be mapped to typed HTTP responses. `CreateApplicationBodyDto` SHALL NOT
define an `intro` field — the `intro` field is removed from the request/response contract
entirely; a request body that still includes an `intro` property SHALL be rejected with a 400
(the global `ValidationPipe`'s `forbidNonWhitelisted` behavior applies to any property not
declared on the DTO).

#### Scenario: Successful create
- **WHEN** an authenticated user POSTs a valid application body
- **THEN** the service proxies the create to DIAL Core and returns the created application
  identifier

#### Scenario: Deployments list cache is cleared alongside the applications list cache on create
- **WHEN** a create succeeds and a client subsequently calls `GET /api/v1/deployments` (the
  endpoint backing the Catalog list and the application editor's edit-mode resolution) for the
  same user, within what would have been the prior cache TTL window
- **THEN** the response includes the newly created application, because
  `deployments:list:<userSub>` (and its `:interface:<type>` variants) were invalidated by the
  create, not served stale

#### Scenario: A cache-invalidation failure does not fail the create
- **WHEN** the DIAL Core save succeeds but clearing the applications list or deployments list
  cache throws
- **THEN** the endpoint still responds with the created application identifier, and the cache
  failure is only logged

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
- **AND** neither the applications list cache nor the deployments list cache is invalidated
