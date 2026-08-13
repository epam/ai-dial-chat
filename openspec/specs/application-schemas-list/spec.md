# Capability: application-schemas-list

## Purpose

Endpoint that lists every DIAL Core application type schema visible to the authenticated session user, with per-user caching.

List all DIAL Core application type schemas visible to the authenticated session user.

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

## Scenarios

### S1 — Authenticated user receives schema list

**Given** an authenticated session user  
**When** `GET /api/v1/application-schemas` is called  
**Then** the service calls `client.listCustomApplicationSchemas` with a `Bearer <accessToken>` Authorization header  
**And** the response is `200` with `{ schemas: [...] }` containing normalised DTO fields

### S2 — Cache hit skips upstream call

**Given** the result for `application-schemas:list:<userSub>` is already cached  
**When** `GET /api/v1/application-schemas` is called  
**Then** `client.listCustomApplicationSchemas` is NOT called  
**And** the cached list is returned with `200`

### S3 — Cache miss populates cache

**Given** no cached entry for `application-schemas:list:<userSub>`  
**When** `GET /api/v1/application-schemas` returns successfully from upstream  
**Then** the result is stored in cache with a 60 second TTL  
**And** subsequent calls within the TTL window hit the cache

### S4 — Different users have independent cache entries

**Given** user A and user B both call the list endpoint  
**Then** each gets their own cache key (`application-schemas:list:<subA>`, `application-schemas:list:<subB>`)  
**And** user A's token is never used for user B's request

### S5 — Authorization header is forwarded to upstream

**Given** a session user with access token `tok-xyz`  
**When** the service calls the SDK  
**Then** the SDK request includes `Authorization: Bearer tok-xyz`

### S6 — Upstream 401 maps to 401

**Given** DIAL Core returns 401  
**Then** the endpoint returns `401 Unauthorized`

### S7 — Upstream 403 maps to 403

**Given** DIAL Core returns 403  
**Then** the endpoint returns `403 Forbidden`

### S8 — Upstream 5xx maps to 502

**Given** DIAL Core returns 500 or 503  
**Then** the endpoint returns `502 Bad Gateway`

### S9 — Network error maps to 503

**Given** the SDK throws a network/fetch error  
**Then** the endpoint returns `503 Service Unavailable`

### S10 — Empty upstream list returns empty schemas array

**Given** DIAL Core returns an empty array  
**Then** the response is `200` with `{ schemas: [] }`

### S11 — Generated client method exists after OpenAPI generation

**Given** the Swagger annotations are in place  
**When** `npm run openapi` runs  
**Then** `libs/chat-api-client` contains a `listApplicationSchemas()` method with return type `ApplicationSchemasResponseDto`

### S12 — `iconUrl` is populated when upstream provides `dial:applicationTypeIconUrl`

**Given** DIAL Core returns a schema item with `"dial:applicationTypeIconUrl": "https://example.com/icon.png"`  
**Then** the normalised DTO includes `iconUrl: "https://example.com/icon.png"`

### S13 — `iconUrl` is absent when upstream omits `dial:applicationTypeIconUrl`

**Given** DIAL Core returns a schema item without `dial:applicationTypeIconUrl`  
**Then** the normalised DTO has `iconUrl` as `undefined` (field omitted from response)

### S14 — `DEV_QUICKAPPS_EDITOR_URL` overrides `editorUrl` for a quickapps2 schema

**Given** `DEV_QUICKAPPS_EDITOR_URL=http://localhost:5555` is set  
**And** DIAL Core returns a schema with `"$id": "https://example.com/schemas/quickapps2"` and `"dial:applicationTypeEditorUrl": "https://prod-editor.example.com"`  
**Then** the normalised DTO has `editorUrl: "http://localhost:5555"`

### S15 — `DEV_QUICKAPPS_EDITOR_URL` unset leaves `editorUrl` unchanged

**Given** `DEV_QUICKAPPS_EDITOR_URL` is not set  
**And** DIAL Core returns a schema whose `$id` contains `quickapps2`  
**Then** the normalised DTO `editorUrl` equals `dial:applicationTypeEditorUrl` unchanged

### S16 — Non-quickapps2 schema is never overridden

**Given** `DEV_QUICKAPPS_EDITOR_URL` is set  
**And** DIAL Core returns a schema whose `$id` does not include `quickapps2`  
**Then** the normalised DTO `editorUrl` equals `dial:applicationTypeEditorUrl` unchanged
