# Capability: application-schemas-get

## Purpose

Endpoint that fetches a single DIAL Core application type schema by its `$id`, with per-user caching.

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

## Requirements

### Requirement: Authenticated schema lookup by `$id`

`GET /api/v1/application-schemas/:id` SHALL require a valid session and SHALL fetch the schema from DIAL Core via `client.getCustomApplicationSchema`, forwarding the session user's access token as a `Bearer` Authorization header. The upstream payload SHALL be returned verbatim, with every top-level key preserved and no normalisation applied.

#### Scenario: Authenticated user fetches a schema by id

- **GIVEN** an authenticated session user
- **WHEN** `GET /api/v1/application-schemas/https%3A%2F%2Fexample.com%2Fschemas%2Fquick-app` is called
- **THEN** the service calls `client.getCustomApplicationSchema` with the decoded id and responds `200` with the JSON schema object unchanged

#### Scenario: The access token reaches upstream

- **GIVEN** a session user whose access token is `tok-xyz`
- **WHEN** the service calls the SDK for a schema
- **THEN** the SDK request carries `Authorization: Bearer tok-xyz`

### Requirement: The `id` path parameter is validated before any upstream call

`GetApplicationSchemaDto.id` SHALL be validated with `@IsString()`, `@IsNotEmpty()`, and `@Matches(/^[^\s]+$/)`, so an empty or whitespace-only id is rejected by the global `ValidationPipe` rather than forwarded to DIAL Core.

#### Scenario: An empty id is rejected

- **WHEN** the endpoint is called with an empty or whitespace-only `id` segment
- **THEN** the request is rejected with `400 Bad Request` and no upstream call is made

### Requirement: Results are cached per user and per schema id

The resolved schema SHALL be cached under `application-schemas:item:<userSub>:<schemaId>` with a 60 second TTL. A cache hit SHALL be served without calling the SDK, and cache entries SHALL NOT be shared between users.

#### Scenario: A cache hit skips the upstream call

- **GIVEN** `application-schemas:item:<userSub>:<schemaId>` is already cached
- **WHEN** the endpoint is called again
- **THEN** `client.getCustomApplicationSchema` is not called and the cached schema is returned with `200`

#### Scenario: A cache miss populates the cache

- **GIVEN** no cached entry exists for the user and schema id
- **WHEN** the SDK returns successfully
- **THEN** the result is stored with a 60 second TTL

#### Scenario: Two users do not share an entry

- **WHEN** user A and user B fetch the same schema id
- **THEN** each is served from its own key, `application-schemas:item:<subA>:<id>` and `application-schemas:item:<subB>:<id>`

### Requirement: Upstream failures map to typed HTTP exceptions

An upstream `401`, `403`, or `404` SHALL surface unchanged; any other non-OK status SHALL map to `502 Bad Gateway`; a network or timeout failure SHALL map to `503 Service Unavailable`. The route SHALL carry `@Throttle({ default: { limit: 60, ttl: 60000 } })`, matching `GET /api/v1/applications`.

#### Scenario: Client-error statuses pass through

- **WHEN** DIAL Core returns `401`, `403`, or `404`
- **THEN** the endpoint returns the same status

#### Scenario: Server errors and outages are distinguished

- **WHEN** DIAL Core returns `500` or `503`
- **THEN** the endpoint returns `502 Bad Gateway`
- **AND** when the SDK throws a network or timeout error, the endpoint returns `503 Service Unavailable`

#### Scenario: The rate limit is enforced per user

- **WHEN** a user exceeds 60 requests in 60 seconds
- **THEN** further requests are rejected with `429`

### Requirement: The endpoint is reachable through the generated client

Swagger annotations SHALL declare `operationId: getApplicationSchema` so that regeneration produces a typed SDK method, wrapped for the frontend in `apps/chat/src/server-api/application-schemas.ts`.

#### Scenario: Regeneration produces the typed method

- **WHEN** `npm run openapi` runs against the annotated controller
- **THEN** `libs/chat-api-client` exposes `getApplicationSchema({ id })` returning `ApplicationSchemaDto`
