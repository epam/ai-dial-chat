# Spec: org-units-api

## Purpose

BFF endpoint `GET /api/v1/org-units` that returns the DIAL Core org units visible to the session user as a flat, per-user-cached list, with org units turned off in Core reported as `enabled: false` rather than an error.

## Requirements

### Requirement: BFF lists the org units visible to the caller
`apps/chat-api` SHALL expose `GET /api/v1/org-units`, handled by `OrgUnitsController` in `apps/chat-api/src/org-units/` (`@Controller({ path: 'org-units', version: '1' })`, `@ApiTags('org-units')`). The handler SHALL call DIAL Core `GET /v1/user/role-assignments` through the shared SDK client (`dialClient.client.getUserRoleAssignments()`) with the caller's session access token as a bearer header, and SHALL return every unit in Core's `items` as one flat list, parents before children, in Core's order. The `public` root itself SHALL NOT appear in the list. The endpoint takes no request body and no query parameters. Any authenticated session may call it while the client-visible feature flag `features.orgUnitsEnabled` (env `ORG_UNITS_ENABLED`, off by default) is on: the controller carries `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.OrgUnitsEnabled)`, so with the flag off it answers 403 and DIAL Core is not called. The global session guard rejects an unauthenticated call with 401. Which units are returned is decided by Core: every unit for a DIAL admin, otherwise the units the caller sees plus the units they hold a role in but reach only by path (without the units above them).

Response DTO `OrgUnitsResponseDto` (class, `@ApiProperty` on every field):
- `enabled: boolean` — `false` when DIAL Core has org units turned off.
- `hasAdminAccess: boolean` — `true` when Core reports `adminAccess: "FULL"`; `false` for `"NONE"` or an absent value.
- `units: OrgUnitDto[]` — `OrgUnitDto` has `id: string`, `name: string`, `displayName: string` (falls back to `name` when Core omits it), `path: string` (decoded, e.g. `public/Acme/Risk`, no trailing slash), `folder: string` (exactly as Core returns it: url-encoded with a trailing slash, e.g. `public/Acme/US%20Risk/`) and `permissions: Record<string, string[]>`, Core's namespace-to-actions map (for example `{ "applications": ["read", "write"] }`; the Swagger schema declares `additionalProperties` as an array of strings so the generated type is not `object`). An absent `permissions` becomes `{}`. Core's `roles` are not returned: the client decides from `permissions`, never from role names, because Core lets a deployment replace or add roles. A Core item missing `id`, `name`, `path` or `folder` SHALL be dropped and logged at `warn` without the token. Items are typed by the SDK's `UserOrgUnitsUnit`; a body without an `items` array gives an empty list.

Generated-client impact: `operationId: listOrgUnits` is kept, so the generated `OrgUnitsApi.listOrgUnits()` returns the extended `OrgUnitsResponseDto`; frontend callers use the normal (non-`Raw`) method. There is no second endpoint and no second cache key.

Example request: `GET /api/v1/org-units` (session cookie).

Example response `200`:
```json
{
  "enabled": true,
  "hasAdminAccess": false,
  "units": [
    {
      "id": "u-acme",
      "name": "Acme",
      "displayName": "Acme Corp",
      "path": "public/Acme",
      "folder": "public/Acme/",
      "permissions": { "applications": ["read", "write"], "prompts": ["read"], "org-units": ["read"] }
    },
    {
      "id": "u-risk",
      "name": "US Risk",
      "displayName": "US Risk",
      "path": "public/Acme/US Risk",
      "folder": "public/Acme/US%20Risk/",
      "permissions": {}
    }
  ]
}
```

#### Scenario: Caller sees the units Core returns
- **WHEN** an authenticated user calls `GET /api/v1/org-units` and DIAL Core answers 200 with a flat `items` list
- **THEN** the response is `200` with `enabled: true` and `units` holding each item in Core's order, parents before children, with `folder` unchanged

#### Scenario: Editor in a unit
- **WHEN** an authenticated user calls `GET /api/v1/org-units` and DIAL Core answers 200 with `adminAccess: "NONE"` and one unit whose `permissions` hold `applications: ["read", "write"]`
- **THEN** the response is `200` with `enabled: true`, `hasAdminAccess: false` and that unit with its `permissions` unchanged

#### Scenario: DIAL admin
- **WHEN** Core answers with `adminAccess: "FULL"`
- **THEN** the response has `hasAdminAccess: true`

#### Scenario: Unit seen only through its parent
- **WHEN** a Core item has `roles: []` and no `permissions`
- **THEN** the unit is returned with `permissions: {}`

#### Scenario: Missing display name falls back to the unit name
- **WHEN** a Core item has `name: "Risk"` and no `displayName`
- **THEN** the returned unit has `displayName: "Risk"`

#### Scenario: Malformed Core item is dropped
- **WHEN** a Core item has no `folder`
- **THEN** it is left out of `units`, the other units are returned, and a warning is logged without the token

#### Scenario: Feature flag off
- **WHEN** `features.orgUnitsEnabled` is off and an authenticated user calls `GET /api/v1/org-units`
- **THEN** the response is `403` and DIAL Core is not called

#### Scenario: Unauthenticated call is rejected
- **WHEN** `GET /api/v1/org-units` is called without a valid session
- **THEN** the response is `401` and DIAL Core is not called

### Requirement: Org units turned off in Core is a normal result, not an error
When DIAL Core answers the role-assignments read with `404`, the endpoint SHALL respond `200` with `{ "enabled": false, "hasAdminAccess": false, "units": [] }` and SHALL NOT throw. Other Core failures SHALL map through `mapDialHttpStatus` like every other domain: `401` → 401, `403` → 403, `5xx` → 502, a timeout or network error → 503. Each status SHALL be declared with `@ApiResponse` (200, 401, 403, 502, 503) plus `@ApiDialCoreErrors()`. A Core that has no such route also answers 404, so the chat reads it as "org units off"; the admin panel already uses the route, so supported deployments have it.

#### Scenario: Core answers 404
- **WHEN** DIAL Core answers `GET /v1/user/role-assignments` with 404
- **THEN** the BFF answers `200` with `{ "enabled": false, "hasAdminAccess": false, "units": [] }`

#### Scenario: Core answers 500
- **WHEN** DIAL Core answers with 500
- **THEN** the BFF answers `502` and the result is not cached

#### Scenario: Core is unreachable
- **WHEN** the SDK call times out or the connection fails
- **THEN** the BFF answers `503`

### Requirement: Org-unit list is cached per user for 60 seconds
The service SHALL wrap the Core read in `withCachedDialRequest` with cache key `org-units:list:<userSub>` and a TTL of 60 seconds. Both the `enabled: true` and the `enabled: false` result SHALL be cached; an error SHALL NOT be. Invalidation is TTL-only: the chat never creates or changes units, so no chat event clears the entry, and an admin change appears in the chat within 60 seconds.

#### Scenario: Second call within the TTL is served from cache
- **WHEN** the same user calls the endpoint twice within 60 seconds
- **THEN** DIAL Core is called once

#### Scenario: Users do not share entries
- **WHEN** two users call the endpoint
- **THEN** each result is cached under that user's own `org-units:list:<userSub>` key

### Requirement: Endpoint emits no new telemetry
The endpoint SHALL rely on the existing request metrics (`MetricsInterceptor`) and Core error logging. No new metric, event or analytics call is added. It SHALL never log the access token, cookies or the full Core body at a level above `debug`.

#### Scenario: Error path logs without secrets
- **WHEN** Core answers 500
- **THEN** the warning names the status and the context `list org units` and contains no token

### Requirement: An own catalog entity can be copied into an org-unit folder
`POST /api/v1/catalog/:entityType/:entityId/copy-to-org-unit` (`operationId: copyCatalogEntityToOrgUnit`, in the publish module, versioned like its siblings) SHALL copy the caller's own entity into `folderPath` of the `public` bucket under the same name (or, when `version` is given, under the name a publication of that version would use), without a publication request, and answer `200` with `{ id }`, the id of the copy. The body is `{ folderPath, version? }`: `folderPath` is plain text, non-empty (the public root is never a target), validated like the publish `folderPath`; `version` is optional, validated like the publish `version`, and replaces for an application or a toolset the `__{version}` suffix of the stored name exactly as the publish endpoint derives its target (the same name is used for the application's `.{application}.deps` folder), so a check of the publish target and this copy address the same path. Without `version` the stored name is kept and the request behaves as before (the Save panel sends none). The endpoint SHALL be gated by `features.orgUnitsEnabled` and answer `403` while it is off, without calling DIAL Core. `entityType` SHALL be one of `application`, `toolset`, `prompt` and `skill`; any other type SHALL answer `400`. The entity SHALL lie in the caller's own bucket, checked against the bucket of the session user before any Core call, otherwise `403`. `entityId` is a bare name or a full id for applications and toolsets, and the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers `400`). The BFF SHALL add no right or per-type rule of its own for a toolset, prompt or skill: DIAL Core's `403` (no `write`, or a Core rule) and `409` reach the caller through `mapDialHttpStatus`, and a copy that would replace an existing target SHALL answer `409`, never overwrite. After a successful copy the caches the write made stale (applications, toolsets) SHALL be cleared, and a failure of that clearing SHALL NOT fail the response.

For an application the endpoint SHALL also copy its first-level private dependencies and its icon, as `org-unit-application-dependencies` defines. It SHALL check, before the first copy, that the caller holds `write` in the folder's unit on the namespace of the application and of every dependency it is about to copy, and answer `403` naming the missing namespaces otherwise; these are the only rights the BFF decides itself, and the check is skipped when the caller's rights cannot be read. The operation id and the success response SHALL NOT change; the request DTO gains the optional `version`, and the documented `403` description gains the dependency case. The `publications` right is not checked here: it only decides which mode the Publish panel offers, and DIAL Core does not enforce it on a copy. A `409` for an existing target SHALL carry the machine-readable code of the publish endpoint's taken target (`TargetExists`) when the BFF itself found the target (its check before the first copy) or when a read of the target after a `409` from DIAL Core confirms it exists; any other `409` from Core, for example a skill or project named like a unit folder, keeps no code. The code is added for every caller; status and message do not change. Cache clearing after the write SHALL cover the application and every dependency of type application or toolset that was copied.

#### Scenario: Writer copies an own application into a unit folder
- **WHEN** the flag is on and a user calls the endpoint for their own application with `folderPath` `Delivery/Teams` and Core accepts the copy
- **THEN** the response is `200` with the id of the copy in the public bucket

#### Scenario: Application with private dependencies
- **WHEN** the application refers to private skills in the caller's bucket and the user may write `applications` and `skills` in the unit
- **THEN** the skills are copied with the application and the response is `200` with the application's id

#### Scenario: Missing namespace for a dependency
- **WHEN** the application refers to a private toolset and the user may not write `toolsets` in the unit
- **THEN** the response is `403` naming `toolsets` and DIAL Core is not asked to copy anything

#### Scenario: Copy named like a publication
- **WHEN** the caller sends `version` `2.0` for the own application `applications/{bucket}/Helper__1.0` with `folderPath` `Delivery/Teams`
- **THEN** the copy lands at `applications/public/Delivery/Teams/Helper__2.0` and the response carries that id

#### Scenario: Version on a name without a version suffix
- **WHEN** the caller sends `version` `2.0` for a prompt or for an application whose stored name has no `__` suffix
- **THEN** the copy keeps the stored name, as a publication would

#### Scenario: Taken target after a racing copy
- **WHEN** another resource appears at the target between the check and the copy, and a read of the target confirms it
- **THEN** the response is `409` with the taken-target code

#### Scenario: Core conflict that is not a taken target
- **WHEN** DIAL Core answers `409` for a skill named like a unit folder and the target does not exist
- **THEN** the response is `409` without the taken-target code

#### Scenario: Flag off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** the response is `403` and DIAL Core is not called

#### Scenario: Entity in another bucket
- **WHEN** `entityId` names a resource in another user's bucket
- **THEN** the response is `403` and DIAL Core is not called

#### Scenario: Same name already in the folder
- **WHEN** the folder already holds an entity with this name
- **THEN** the response is `409` and nothing is overwritten

#### Scenario: Core refuses the write
- **WHEN** DIAL Core answers the copy with `403`
- **THEN** the BFF answers `403`

#### Scenario: Type without a copy
- **WHEN** `entityType` is `project` or `model`
- **THEN** the response is `400` and DIAL Core is not called

#### Scenario: Prompt or skill given by a bare name
- **WHEN** `entityType` is `prompt` or `skill` and `entityId` is not a full resource path
- **THEN** the response is `400`
