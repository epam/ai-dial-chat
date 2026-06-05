## Context

DIAL Core exposes two endpoints for application type schemas:
- `GET /v1/application_type_schemas/schemas` — list all schemas visible to a user
- `GET /v1/application_type_schemas/schema?id={schemaId}` — fetch one schema by `$id`

`@epam/ai-dial-typescript-sdk` already wraps both as `client.listCustomApplicationSchemas(init?)` and `client.getCustomApplicationSchema({ params: { query: { id } }, headers })`. The existing `applications` domain (`apps/chat-api/src/applications/`) already uses the SDK client inherited from `AppService`, per-user caching, `getBearerAuthHeaders`, and `mapDialHttpStatus`/`handleDialFetchError`.

## Goals / Non-Goals

**Goals**
- Expose `GET /api/v1/application-schemas` and `GET /api/v1/application-schemas/:id` as authenticated BFF endpoints.
- Normalise upstream DIAL Core field names (dollar- and colon-prefixed) to stable camelCase DTO fields in the list response.
- Pass the raw JSON schema object through for the item endpoint without re-shaping it.
- Keep full coverage: Swagger, throttling, per-user caching, error mapping.
- Regenerate `libs/chat-api-client` so the frontend uses a generated typed client, not raw fetch.

**Non-Goals**
- Mutating or creating schemas (read-only endpoints only).
- Caching across users (per-user only).
- Pagination (upstream returns the full list).
- Exposing the meta-schema endpoint (`/v1/application_type_schemas/meta_schema`).

## Decisions

### D1 — Extend the existing `applications` domain, do not create a new domain folder

The schema endpoints are conceptually part of the application type subsystem. Putting them in `apps/chat-api/src/applications/` reuses the existing module, service base class, error utilities, and test helpers without introducing a new NestJS module.

Alternative: a new `application-schemas` domain folder. Rejected — adds a new `ApplicationSchemasModule`, duplicates the `AppService` wiring, and splits closely related functionality with no isolation benefit at current scale.

### D2 — Add `ApplicationSchemasController` and `ApplicationSchemasService` as separate files within the `applications/` domain

While the domain folder is shared, the controller and service are kept separate from `ApplicationsController`/`ApplicationsService` to keep files focused and tests clean. Both register in `ApplicationsModule`.

Alternative: add methods directly to the existing controller/service. Rejected — `ApplicationsController` would grow two unrelated route groups; test files would lose clarity.

### D3 — Normalise list response fields to camelCase DTO

The upstream list item contains `$id`, `dial:applicationTypeDisplayName`, `dial:applicationTypeViewerUrl`, `dial:applicationTypeEditorUrl`, `dial:applicationTypeSchemaEndpoint`. These are not valid TypeScript identifiers and would generate weak client types. The BFF normalises them:

| Upstream field                       | DTO field            |
|--------------------------------------|----------------------|
| `$id`                                | `id`                 |
| `dial:applicationTypeDisplayName`    | `displayName`        |
| `dial:applicationTypeViewerUrl`      | `viewerUrl`          |
| `dial:applicationTypeEditorUrl`      | `editorUrl`          |
| `dial:applicationTypeSchemaEndpoint` | `schemaEndpoint`     |

All fields are optional in the upstream contract (`?`); the DTO marks them `@ApiPropertyOptional` accordingly.

Alternative: pass through raw upstream keys. Rejected — colon and dollar characters require bracket access, break generated client types, and couple the frontend to DIAL Core internals.

### D4 — Item endpoint returns `Record<string, unknown>`

The SDK types `getCustomApplicationSchema` response as `Record<string, never>` (an empty object alias used by the OpenAPI generator). In practice the payload is a full JSON Schema object. The BFF DTO uses `Record<string, unknown>` (a named `ApplicationSchemaDto` alias) to preserve all content while keeping TypeScript strict.

Alternative: `unknown` or `any`. Rejected — `Record<string, unknown>` is precise, avoids `any`, and generates a typed client response.

### D5 — Cache TTL of 60 seconds per user

The list cache mirrors the `Cache-Control: private, max-age=30` used for applications listing but doubles it because schemas change less frequently (deployment events, not user edits). Item cache is also 60 seconds keyed by `application-schemas:item:<userSub>:<schemaId>`.

Cache keys:
- List: `application-schemas:list:<userSub>`
- Item: `application-schemas:item:<userSub>:<schemaId>`

Alternative: 30 s (same as applications). Acceptable but schemas are more stable; 60 s reduces upstream pressure without meaningfully staling the data.

### D6 — @Throttle same as applications listing (60 req/min)

Both endpoints serve authenticated users reading catalogue data. The same `{ default: { limit: 60, ttl: 60000 } }` limit applied to `GET /api/v1/applications` is appropriate and consistent.

## Backend Flow

```
Browser
  │  GET /api/v1/application-schemas
  │  GET /api/v1/application-schemas/:id
  ▼
ApplicationSchemasController            (apps/chat-api/src/applications/)
  │  extracts req.user { sub, at }
  ▼
ApplicationSchemasService               (extends AppService)
  │  checks cacheManager — key: application-schemas:list:<sub>
  │                              application-schemas:item:<sub>:<id>
  │  on miss: this.client.listCustomApplicationSchemas({ headers: getBearerAuthHeaders(at) })
  │           this.client.getCustomApplicationSchema({ params: { query: { id } }, headers })
  │  maps result.error → mapDialHttpStatus(result.response.status, …)
  │  normalises list items → ApplicationSchemaSummaryDto[]
  │  stores in cache with 60 s TTL
  ▼
ApplicationsModule                      (registers both controller + service)
```

## DTO Shape

```
// apps/chat-api/src/applications/dto/application-schema.dto.ts

ApplicationSchemaSummaryDto {
  id?:             string    // from $id
  displayName?:    string    // from dial:applicationTypeDisplayName
  viewerUrl?:      string    // from dial:applicationTypeViewerUrl
  editorUrl?:      string    // from dial:applicationTypeEditorUrl
  schemaEndpoint?: string    // from dial:applicationTypeSchemaEndpoint
}

ApplicationSchemasResponseDto {
  schemas: ApplicationSchemaSummaryDto[]
}

// Used as the item response type alias
type ApplicationSchemaDto = Record<string, unknown>
```

## Caching and Error Mapping

Caching uses the global `CacheModule` instance (already `isGlobal: true` in `AppModule`). `ApplicationSchemasService` injects `@Inject(CACHE_MANAGER) cacheManager: Cache` identically to `ApplicationsService`.

Error mapping reuses the existing utilities without modification:
- `result.error` → `mapDialHttpStatus(result.response.status, context, logger)` — handles 401, 403, 404, 429, 5xx
- `catch (err)` → `handleDialFetchError(err, context, logger, 0)` — handles AbortError and unexpected errors

The item endpoint additionally maps upstream 400 → `BadRequestException` because the upstream contract documents `400 Bad request` when `id` is missing or malformed. This is a new mapping not currently in `mapDialHttpStatus`; the controller handles it via a `GetApplicationSchemaDto` path param DTO with `@IsString()` + `@IsNotEmpty()` validation that catches empty strings before reaching the service.

## Generated Client Impact

After running `npm run openapi`:
- `ApplicationsApi` in `libs/chat-api-client` gains two methods:
  - `listApplicationSchemas(): Promise<ApplicationSchemasResponseDto>`
  - `getApplicationSchema({ id: string }): Promise<ApplicationSchemaDto>`
- `api-client.ts` already exports `applicationsApi`; if the generator places both routes under the same `applications` tag, no new singleton is needed. If the generator uses a separate tag, a new `applicationSchemasApi` export is added.

Do not hand-edit generated files in `libs/chat-api-client/`.

## Library Isolation Statement

All DIAL Core integration — SDK calls, bearer tokens, REST paths, cache keys, error mapping — lives exclusively in `apps/chat-api/src/applications/`. The generated client (`libs/chat-api-client`) is the sole exception (regenerated artefact, not hand-authored). The thin wrappers in `apps/chat/src/server-api/application-schemas.ts` delegate to the generated client and carry no SDK, auth, or REST-path knowledge. Hand-authored libs (`libs/chat-shared`, `libs/conversation-input`) are not touched.

## Open Questions

- If the generator assigns the new routes to a new Swagger tag (not `applications`), `api-client.ts` will need a new API singleton. Confirm after running `npm run openapi` and inspecting the generated `apis/` folder.
- Confirm whether `$id` is guaranteed to be non-empty in practice; if not, consider filtering out schema entries with missing `$id` in `listApplicationSchemas`.
