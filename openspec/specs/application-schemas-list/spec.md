# Capability: application-schemas-list

## Purpose

Endpoint that lists every DIAL Core application type schema visible to the authenticated session user, with per-user caching.

---

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/application-schemas` |
| Auth | Session cookie required (authenticated user) |
| operationId | `listApplicationSchemas` |

## Request

No request body. No query parameters.

## Response — 200 OK

```json
{
  "schemas": [
    {
      "id": "https://example.com/schemas/quick-app",
      "displayName": "Quick App",
      "viewerUrl": "https://example.com/viewer",
      "editorUrl": "https://example.com/editor",
      "schemaEndpoint": "https://example.com/schema",
      "iconUrl": "https://example.com/icon.png"
    }
  ]
}
```

Response DTO: `ApplicationSchemasResponseDto`

```
ApplicationSchemasResponseDto {
  schemas: ApplicationSchemaSummaryDto[]
}

ApplicationSchemaSummaryDto {
  id?:             string
  displayName?:    string
  viewerUrl?:      string
  editorUrl?:      string
  schemaEndpoint?: string
  iconUrl?:        string
}
```

Field mapping (all optional per upstream contract):

| DTO field       | Upstream DIAL Core field                  |
|-----------------|-------------------------------------------|
| `id`            | `$id`                                     |
| `displayName`   | `dial:applicationTypeDisplayName`         |
| `viewerUrl`     | `dial:applicationTypeViewerUrl`           |
| `editorUrl`     | `dial:applicationTypeEditorUrl` — overridden with `DEV_QUICKAPPS_EDITOR_URL` when `isQuickAppSchema(id)` is true and that env var is set (see below) |
| `schemaEndpoint`| `dial:applicationTypeSchemaEndpoint`      |
| `iconUrl`       | `dial:applicationTypeIconUrl`             |

### Dev override for the QuickApps 2.0 editor URL

`apps/chat-api/src/config/environment.config.ts` (`EnvironmentVariables`) SHALL define an optional `DEV_QUICKAPPS_EDITOR_URL?: string` (`@IsOptional() @IsUrl({ require_tld: false })`).

When building each `ApplicationSchemaSummaryDto`, the service SHALL:
- Determine `isQuickApp` from the shared `isQuickAppSchema(schema.id)` helper (`apps/chat-api/src/common/utils/application-schema.ts`).
- Set `editorUrl` to `DEV_QUICKAPPS_EDITOR_URL` when `isQuickApp` is true and the env var is set; otherwise use `dial:applicationTypeEditorUrl` unchanged.

*TODO: `isQuickAppSchema` matches on a schema id substring because DIAL Core does not yet expose a stable capability/type field. Replace with a proper identifier once one is available.*

This override exists to let developers point the QuickApps 2.0 editor iframe at a local dev server without editing the upstream schema. It has no effect when `DEV_QUICKAPPS_EDITOR_URL` is unset, and no effect on non-QuickApps schemas.

## Error Responses

| Status | Condition |
|---|---|
| 401 | No valid session cookie / upstream returns 401 |
| 403 | Caller lacks permission to list schemas |
| 429 | Rate limit exceeded (60 req/60 s per user) |
| 502 | DIAL Core returned a non-OK status |
| 503 | DIAL Core is unreachable or timed out |

## Rate Limiting

`@Throttle({ default: { limit: 60, ttl: 60000 } })` — same as `GET /api/v1/applications`.

## Caching

- Cache key: `application-schemas:list:<userSub>`
- TTL: 60 seconds
- Scope: per authenticated user
- On cache hit: upstream SDK is not called; cached `ApplicationSchemasResponseDto` is returned directly.

## Generated Client

After OpenAPI regeneration, `ApplicationsApi` (or a new `ApplicationSchemasApi` depending on Swagger tag) exposes:

```ts
applicationsApi.listApplicationSchemas(): Promise<ApplicationSchemasResponseDto>
```

Frontend server-api wrapper: `apps/chat/src/server-api/application-schemas.ts`

```ts
export const getApplicationSchemas = (): Promise<ApplicationSchemasResponseDto> =>
  applicationsApi.listApplicationSchemas();
```

---

## Requirements

### Requirement: Authenticated listing of visible schemas

`GET /api/v1/application-schemas` SHALL require a valid session and SHALL call `client.listCustomApplicationSchemas`, forwarding the session user's access token as a `Bearer` Authorization header. Each upstream entry SHALL be normalised into an `ApplicationSchemaSummaryDto` per the field mapping above, and the response SHALL be `{ schemas: [...] }`.

#### Scenario: Authenticated user receives the list

- **GIVEN** an authenticated session user
- **WHEN** `GET /api/v1/application-schemas` is called
- **THEN** the SDK is called with `Authorization: Bearer <accessToken>` and the response is `200` with normalised DTO fields

#### Scenario: An empty upstream list is still a valid response

- **WHEN** DIAL Core returns an empty array
- **THEN** the response is `200` with `{ schemas: [] }`

#### Scenario: Optional upstream fields stay optional

- **WHEN** an upstream item carries `dial:applicationTypeIconUrl`
- **THEN** the DTO carries the same value in `iconUrl`
- **AND** an item without that key produces a DTO whose `iconUrl` is omitted

### Requirement: `DEV_QUICKAPPS_EDITOR_URL` overrides the editor URL for QuickApps schemas only

`EnvironmentVariables` SHALL declare an optional `DEV_QUICKAPPS_EDITOR_URL?: string` validated with `@IsOptional()` and `@IsUrl({ require_tld: false })`. While building each summary, the service SHALL substitute that value for `editorUrl` only when `isQuickAppSchema(schema.id)` is true and the variable is set; in every other case `dial:applicationTypeEditorUrl` SHALL pass through unchanged.

#### Scenario: A QuickApps schema is redirected to the dev editor

- **GIVEN** `DEV_QUICKAPPS_EDITOR_URL=http://localhost:5555` is set
- **WHEN** DIAL Core returns a schema whose `$id` identifies it as QuickApps, with `dial:applicationTypeEditorUrl` set to a production URL
- **THEN** the DTO carries `editorUrl: "http://localhost:5555"`

#### Scenario: The override is inert when unset

- **GIVEN** `DEV_QUICKAPPS_EDITOR_URL` is not set
- **WHEN** a QuickApps schema is returned
- **THEN** `editorUrl` equals `dial:applicationTypeEditorUrl` unchanged

#### Scenario: Non-QuickApps schemas are never overridden

- **GIVEN** `DEV_QUICKAPPS_EDITOR_URL` is set
- **WHEN** a schema that `isQuickAppSchema` does not match is returned
- **THEN** `editorUrl` equals `dial:applicationTypeEditorUrl` unchanged

### Requirement: The list is cached per user

The response SHALL be cached under `application-schemas:list:<userSub>` with a 60 second TTL. A cache hit SHALL be served without calling the SDK, and one user's entry SHALL never serve another user's request.

#### Scenario: A cache hit skips the upstream call

- **GIVEN** `application-schemas:list:<userSub>` is already cached
- **WHEN** the endpoint is called again
- **THEN** `client.listCustomApplicationSchemas` is not called and the cached list is returned with `200`

#### Scenario: A cache miss populates the cache

- **GIVEN** no cached entry exists for the user
- **WHEN** the upstream call succeeds
- **THEN** the result is stored with a 60 second TTL and subsequent calls inside that window are served from cache

#### Scenario: Two users do not share an entry

- **WHEN** user A and user B both call the endpoint
- **THEN** each is served from its own key and user A's token is never used for user B's request

### Requirement: Upstream failures map to typed HTTP exceptions

An upstream `401` or `403` SHALL surface unchanged; any other non-OK status SHALL map to `502 Bad Gateway`; a network or timeout failure SHALL map to `503 Service Unavailable`. The route SHALL carry `@Throttle({ default: { limit: 60, ttl: 60000 } })`, matching `GET /api/v1/applications`.

#### Scenario: Client-error statuses pass through

- **WHEN** DIAL Core returns `401` or `403`
- **THEN** the endpoint returns the same status

#### Scenario: Server errors and outages are distinguished

- **WHEN** DIAL Core returns `500` or `503`
- **THEN** the endpoint returns `502 Bad Gateway`
- **AND** when the SDK throws a network or timeout error, the endpoint returns `503 Service Unavailable`

#### Scenario: The rate limit is enforced per user

- **WHEN** a user exceeds 60 requests in 60 seconds
- **THEN** further requests are rejected with `429`

### Requirement: The endpoint is reachable through the generated client

Swagger annotations SHALL declare `operationId: listApplicationSchemas` so that regeneration produces a typed SDK method, wrapped for the frontend in `apps/chat/src/server-api/application-schemas.ts`.

#### Scenario: Regeneration produces the typed method

- **WHEN** `npm run openapi` runs against the annotated controller
- **THEN** `libs/chat-api-client` exposes `listApplicationSchemas()` returning `ApplicationSchemasResponseDto`
