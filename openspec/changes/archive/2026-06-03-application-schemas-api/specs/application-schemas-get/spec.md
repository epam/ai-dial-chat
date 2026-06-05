# Capability: application-schemas-get

Fetch a single DIAL Core application type schema by its `$id`.

---

## Endpoint

| Property | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/application-schemas/:id` |
| Auth | Session cookie required (authenticated user) |
| operationId | `getApplicationSchema` |

## Request

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `id` | Path | `string` | Yes | The schema `$id` (URL-encoded). Must be non-empty. |

Path param DTO (`GetApplicationSchemaDto`):
- `id`: `@IsString()` + `@IsNotEmpty()` + `@Matches(/^[^\s]+$/)` (no whitespace; prevents trivially invalid ids from reaching upstream)

## Response — 200 OK

The full JSON Schema document for the application type, returned as-is from upstream.

Response DTO: `ApplicationSchemaDto` (alias for `Record<string, unknown>`)

```json
{
  "$id": "https://example.com/schemas/quick-app",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Quick App",
  "type": "object",
  "properties": { ... }
}
```

The response passes through the upstream payload verbatim (all top-level keys preserved). No normalisation is applied.

## Error Responses

| Status | Condition |
|---|---|
| 400 | `id` param is empty or contains only whitespace |
| 401 | No valid session cookie / upstream returns 401 |
| 403 | Caller lacks permission to access this schema |
| 404 | Schema not found for the given `id` |
| 429 | Rate limit exceeded (60 req/60 s per user) |
| 502 | DIAL Core returned a non-OK, non-4xx status |
| 503 | DIAL Core is unreachable or timed out |

## Rate Limiting

`@Throttle({ default: { limit: 60, ttl: 60000 } })` — same as `GET /api/v1/applications`.

## Caching

- Cache key: `application-schemas:item:<userSub>:<schemaId>`
- TTL: 60 seconds
- Scope: per authenticated user, per schema id
- On cache hit: upstream SDK is not called; cached `ApplicationSchemaDto` is returned directly.

## Generated Client

After OpenAPI regeneration, `ApplicationsApi` (or `ApplicationSchemasApi`) exposes:

```ts
applicationsApi.getApplicationSchema({ id: string }): Promise<ApplicationSchemaDto>
```

Frontend server-api wrapper: `apps/chat/src/server-api/application-schemas.ts`

```ts
export const getApplicationSchema = (id: string): Promise<ApplicationSchemaDto> =>
  applicationsApi.getApplicationSchema({ id });
```

---

## Scenarios

### S1 — Authenticated user fetches schema by id

**Given** an authenticated session user  
**When** `GET /api/v1/application-schemas/https%3A%2F%2Fexample.com%2Fschemas%2Fquick-app` is called  
**Then** the service calls `client.getCustomApplicationSchema({ params: { query: { id: '...' } }, headers })` with a `Bearer <accessToken>` Authorization header  
**And** the response is `200` with the JSON schema object

### S2 — Cache hit skips upstream call

**Given** the result for `application-schemas:item:<userSub>:<schemaId>` is already cached  
**When** `GET /api/v1/application-schemas/:id` is called  
**Then** `client.getCustomApplicationSchema` is NOT called  
**And** the cached schema is returned with `200`

### S3 — Cache miss populates cache

**Given** no cached entry for the user + schema id pair  
**When** the SDK returns successfully  
**Then** the result is stored in cache with a 60 second TTL

### S4 — Empty id returns 400

**Given** the client calls `GET /api/v1/application-schemas/` (empty segment) or sends id as whitespace  
**Then** `ValidationPipe` rejects the request  
**And** the endpoint returns `400 Bad Request`

### S5 — Authorization header is forwarded to upstream

**Given** a session user with access token `tok-xyz`  
**When** the service calls the SDK for a schema  
**Then** the SDK request includes `Authorization: Bearer tok-xyz`

### S6 — Upstream 401 maps to 401

**Given** DIAL Core returns 401  
**Then** the endpoint returns `401 Unauthorized`

### S7 — Upstream 403 maps to 403

**Given** DIAL Core returns 403  
**Then** the endpoint returns `403 Forbidden`

### S8 — Upstream 404 maps to 404

**Given** DIAL Core returns 404 (schema not found for the given id)  
**Then** the endpoint returns `404 Not Found`

### S9 — Upstream 5xx maps to 502

**Given** DIAL Core returns 500 or 503  
**Then** the endpoint returns `502 Bad Gateway`

### S10 — Network error maps to 503

**Given** the SDK throws a network/fetch error  
**Then** the endpoint returns `503 Service Unavailable`

### S11 — Different users have independent cache entries

**Given** user A and user B both fetch the same schema id  
**Then** each gets their own cache key (`application-schemas:item:<subA>:<id>`, `application-schemas:item:<subB>:<id>`)

### S12 — Generated client method exists after OpenAPI generation

**Given** the Swagger annotations are in place  
**When** `npm run openapi` runs  
**Then** `libs/chat-api-client` contains a `getApplicationSchema({ id })` method with return type `ApplicationSchemaDto` / `Record<string, unknown>`
