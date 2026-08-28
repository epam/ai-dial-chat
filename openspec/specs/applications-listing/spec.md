# applications-listing Specification

## Purpose

The applications listing endpoint, its DTO shape, generated client, and the frontend server-api wrapper.

## Requirements

### Requirement: Applications listing endpoint
The system SHALL expose `GET /api/v1/applications` that returns the applications visible to the authenticated session user by proxying the DIAL Core Applications API through the `@epam/ai-dial-typescript-sdk` client.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Use the session `accessToken` as a Bearer token when calling DIAL Core.
- Issue a single `getApplications` call and return its `data` array as-is; DIAL Core returns the full list for this endpoint, so there is no cursor to follow and the service performs no pagination loop.
- Treat a successful upstream response with no `data` field as an empty list rather than an error.
- Respond 200 with `ApplicationsResponseDto` on success.
- Apply `@Throttle({ default: { limit: 60, ttl: 60000 } })` (identical to `listModels`).
- Set response header `Cache-Control: private, max-age=30` via `@Header`.
- Cache results server-side under key `applications:list:<userSub>` for 30 000 ms, through the shared `withCachedDialRequest` helper.
- Not log the access token, session cookie, or any secret. Safe identifiers such as `userSub` MAY be logged at debug level.

#### Scenario: Successful response
- **WHEN** the authenticated user calls `GET /api/v1/applications`
- **AND** DIAL Core returns the applications
- **THEN** the endpoint responds 200 with `{ data: ApplicationDto[] }` containing all of them

#### Scenario: Empty application list
- **WHEN** DIAL Core returns an empty `data` array
- **THEN** the endpoint responds 200 with `{ data: [] }`

#### Scenario: Upstream response without a data field
- **WHEN** DIAL Core responds successfully but the body carries no `data` field
- **THEN** the endpoint responds 200 with `{ data: [] }` rather than failing

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: DIAL Core denies access
- **WHEN** DIAL Core responds 403 to the applications fetch
- **THEN** the endpoint responds 403

#### Scenario: DIAL Core rate limit
- **WHEN** DIAL Core responds 429 to the applications fetch
- **THEN** the endpoint responds 429

#### Scenario: DIAL Core returns unexpected status
- **WHEN** DIAL Core responds with any non-success, non-4xx status (e.g. 500, 503)
- **THEN** the endpoint responds 502

#### Scenario: DIAL Core timeout or unreachable
- **WHEN** the call to DIAL Core times out or the connection is refused
- **THEN** `handleDialFetchError` maps the transport failure and the endpoint responds 503

#### Scenario: Cache hit returns without upstream call
- **WHEN** `applications:list:<userSub>` is present in the cache
- **THEN** the service returns the cached value immediately without calling DIAL Core

#### Scenario: Cache entries are per user
- **WHEN** two different session users call the endpoint
- **THEN** each is served from its own `applications:list:<userSub>` key and one user's list is never served to the other

---

### Requirement: ApplicationDto response shape
The backend SHALL define `ApplicationDto` with the following strongly typed fields for use in Swagger and in the generated `@epam/ai-dial-chat-api-client`. The field names mirror DIAL Core's own wire format, because this endpoint passes the upstream entries through untransformed:

- `id: string` — unique stable identifier from DIAL Core
- `object: string` — upstream resource kind, e.g. `"application"`
- `display_name?: string` — optional human-readable display name
- `display_version?: string` — optional human-readable version label
- `icon_url?: string` — optional icon URL
- `description?: string` — optional description from DIAL Core metadata
- `input_attachment_types?: string[]` — accepted MIME types for input attachments
- `max_input_attachments?: number` — maximum number of input attachments

There SHALL be no server-side normalisation or defaulting — in particular no fallback of a missing display name to `id`. Callers that need a display name resolve it themselves.

`ApplicationsResponseDto` SHALL wrap this as `{ data: ApplicationDto[] }`, mirroring `DialModelListResponseDto`.

#### Scenario: All fields populated
- **WHEN** DIAL Core returns an application with all known fields present
- **THEN** `ApplicationDto` contains all fields with correct types and no `any` values

#### Scenario: Optional fields absent
- **WHEN** DIAL Core omits `description`, `icon_url`, `max_input_attachments`, or `input_attachment_types`
- **THEN** those fields are absent (not `null`) in the returned `ApplicationDto`

#### Scenario: A missing display name is not defaulted
- **WHEN** DIAL Core returns an application without a `display_name` field
- **THEN** the returned `ApplicationDto` simply omits `display_name`; the endpoint does not substitute `id`

---

### Requirement: Applications domain structure
The backend SHALL implement the applications feature in `apps/chat-api/src/applications/` following the established domain pattern:

- `applications.controller.ts` — thin controller. `@Get() listApplications(@Req() req)` is the listing route; the same controller also hosts the application create/update/delete/get routes owned by their own capabilities.
- `applications.service.ts` — `ApplicationsService` injects `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) for the shared DIAL SDK client, the cache manager, and `DeploymentsService`. Listing is a single SDK call wrapped in the shared `withCachedDialRequest` helper — no raw `fetch`, no `AbortController`, no pagination loop.
- `applications.module.ts` — `ApplicationsModule`, importing `DeploymentsModule` and exporting `ApplicationsService`
- `dto/application.dto.ts` — `ApplicationDto` and `ApplicationsResponseDto` with `@ApiProperty` decorators; sibling DTO files cover the write routes
- `tests/applications.controller.spec.ts`
- `tests/applications.service.spec.ts`

`ApplicationsModule` SHALL be imported into `AppModule`.

#### Scenario: Controller delegates to service
- **WHEN** `listApplications` is called on the controller
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `applicationsService.listApplications(sub, at)`

#### Scenario: AppModule registers module
- **WHEN** the NestJS application boots
- **THEN** `ApplicationsModule` is present in `AppModule.imports` and the endpoint is reachable at `/api/v1/applications`

---

### Requirement: Swagger and generated client for applications
The `listApplications` handler SHALL be annotated so the OpenAPI spec and the generated client are correct:

- `@ApiOperation({ operationId: 'listApplications', summary: 'List available applications' })`
- `@ApiResponse({ status: 200, type: ApplicationsResponseDto })`
- Standard 401, 403, 429, 502, 503 `@ApiResponse` entries
- No `any` in success response types

Running `npm run openapi` and `npm run openapi:check` SHALL pass. Running `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` SHALL pass.

#### Scenario: Generated client exposes listApplications
- **WHEN** `npm run openapi` runs after adding the endpoint
- **THEN** `@epam/ai-dial-chat-api-client` exports an `ApplicationsApi` class with a `listApplications()` method typed to return `Promise<ApplicationsResponseDto>`

---

### Requirement: Frontend server-api wrapper for applications
`apps/chat/src/server-api/applications.ts` SHALL export:

```typescript
export const getApplications = (): Promise<ApplicationsResponseDto> =>
  applicationsApi.listApplications();
```

`applicationsApi` SHALL be instantiated from the generated client in `api-client.ts` following the same pattern as `modelsApi` and `deploymentsApi`.

#### Scenario: Wrapper delegates to generated client
- **WHEN** `getApplications()` is called
- **THEN** it calls `applicationsApi.listApplications()` and returns the result without transformation

#### Scenario: 401 is handled by shared middleware
- **WHEN** the generated client receives a 401 response
- **THEN** the shared `unauthorizedMiddleware` in `api-client.ts` fires before the wrapper sees the response

---

### Requirement: Backend service tests for applications pagination
`applications.service.spec.ts` SHALL cover:

- Upstream list on a cache miss → returns all items
- Upstream body without `data` → returns `{ data: [] }`
- Cache hit → does not call DIAL Core
- Per-user cache keys → two users never share an entry
- The `Authorization` header is forwarded upstream
- Each mapped upstream failure → 401, 403, 429, 502 for a 5xx, and 503 for a network error

All DIAL Core calls SHALL be mocked/stubbed; no live network calls.

#### Scenario: Service test for a missing data field
- **WHEN** the mocked DIAL Core resolves with a body carrying no `data`
- **THEN** the service returns `{ data: [] }`

#### Scenario: Service test for per-user cache isolation
- **WHEN** two users call the service with different `userSub` values
- **THEN** each read and write targets its own `applications:list:<userSub>` key
