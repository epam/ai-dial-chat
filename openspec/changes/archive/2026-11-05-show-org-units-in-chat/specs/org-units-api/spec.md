## ADDED Requirements

### Requirement: BFF lists the org units visible to the caller
`apps/chat-api` SHALL expose `GET /api/v1/org-units`, handled by `OrgUnitsController` in `apps/chat-api/src/org-units/` (`@Controller({ path: 'org-units', version: '1' })`, `@ApiTags('org-units')`). The handler SHALL call DIAL Core `GET /v1/org-units/public?recursive=true` through the shared SDK client (`dialClient.client.getOrgUnit('public', { params: { query: { recursive: true } } })`) with the caller's session access token as a bearer header, and SHALL return every unit in Core's `items` as one flat list, parents before children, in Core's order. The `public` root itself SHALL NOT appear in the list. The endpoint takes no request body and no query parameters. Any authenticated session may call it; the global session guard rejects an unauthenticated call with 401. Which units are returned is decided by Core: every unit for a DIAL admin, only the units visible to the caller otherwise.

Response DTO `OrgUnitsResponseDto` (class, `@ApiProperty` on every field):
- `enabled: boolean` — `false` when DIAL Core has org units turned off.
- `units: OrgUnitDto[]` — `OrgUnitDto` has `id: string`, `name: string`, `displayName: string` (falls back to `name` when Core omits it), `path: string` (decoded, e.g. `public/Acme/Risk`, no trailing slash) and `folder: string` (exactly as Core returns it: url-encoded with a trailing slash, e.g. `public/Acme/US%20Risk/`). A Core item missing `id`, `name`, `path` or `folder` SHALL be dropped and logged at `warn`.

Generated-client impact: `operationId: listOrgUnits`, generated `OrgUnitsApi.listOrgUnits()` returning `OrgUnitsResponseDto`; frontend callers use the normal (non-`Raw`) method.

Example request: `GET /api/v1/org-units` (session cookie).

Example response `200`:
```json
{
  "enabled": true,
  "units": [
    { "id": "u-acme", "name": "Acme", "displayName": "Acme Corp", "path": "public/Acme", "folder": "public/Acme/" },
    { "id": "u-risk", "name": "US Risk", "displayName": "US Risk", "path": "public/Acme/US Risk", "folder": "public/Acme/US%20Risk/" }
  ]
}
```

#### Scenario: Caller sees the units Core returns
- **WHEN** an authenticated user calls `GET /api/v1/org-units` and DIAL Core answers 200 with a nested `items` list
- **THEN** the response is `200` with `enabled: true` and `units` holding each item flattened, parents before children, with `folder` unchanged

#### Scenario: Missing display name falls back to the unit name
- **WHEN** a Core item has `name: "Risk"` and no `displayName`
- **THEN** the returned unit has `displayName: "Risk"`

#### Scenario: Malformed Core item is dropped
- **WHEN** a Core item has no `folder`
- **THEN** it is left out of `units`, the other units are returned, and a warning is logged without the token

#### Scenario: Unauthenticated call is rejected
- **WHEN** `GET /api/v1/org-units` is called without a valid session
- **THEN** the response is `401` and DIAL Core is not called

### Requirement: Org units turned off in Core is a normal result, not an error
When DIAL Core answers the org-units read with `404`, the endpoint SHALL respond `200` with `{ "enabled": false, "units": [] }` and SHALL NOT throw. Other Core failures SHALL map through `mapDialHttpStatus` like every other domain: `401` → 401, `403` → 403, `5xx` → 502, a timeout or network error → 503. Each status SHALL be declared with `@ApiResponse` (200, 401, 403, 502, 503) plus `@ApiDialCoreErrors()`.

#### Scenario: Core answers 404
- **WHEN** DIAL Core answers `GET /v1/org-units/public` with 404
- **THEN** the BFF answers `200` with `{ "enabled": false, "units": [] }`

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
