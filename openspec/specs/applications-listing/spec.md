## ADDED Requirements

### Requirement: Applications listing endpoint
The system SHALL expose `GET /api/v1/applications` that returns all applications visible to the authenticated session user by proxying the DIAL Core Applications API, exhausting all pages before responding.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Use the session `accessToken` as a Bearer token when calling DIAL Core.
- Fetch all pages in a sequential server-side loop before returning; never return only the first page.
- Respond 200 with `ApplicationsResponseDto` on success.
- Apply `@Throttle({ default: { limit: 60, ttl: 60000 } })` (identical to `listModels`).
- Set response header `Cache-Control: private, max-age=30`.
- Cache results server-side under key `applications:list:<userSub>` for 30 000 ms.
- Not log the access token, session cookie, or any secret. Safe identifiers (`userSub`, page number, cursor hash) MAY be logged at debug level.

#### Scenario: Successful single-page response
- **WHEN** the authenticated user calls `GET /api/v1/applications`
- **AND** DIAL Core returns all applications in one page with no next-page token
- **THEN** the endpoint responds 200 with `{ data: ApplicationDto[] }` containing all applications

#### Scenario: Successful multi-page response
- **WHEN** DIAL Core returns N pages for the authenticated user's applications
- **AND** each page except the last contains a next-page cursor/token
- **THEN** the endpoint fetches all N pages and responds 200 with the merged `data` array

#### Scenario: Empty application list
- **WHEN** DIAL Core returns a first page with an empty `data` array and no next-page token
- **THEN** the endpoint responds 200 with `{ data: [] }`

#### Scenario: Last page without next token
- **WHEN** the loop fetches a page that has items but no next-page token
- **THEN** the loop terminates immediately after that page, not after an additional empty fetch

#### Scenario: Upstream error on an intermediate page
- **WHEN** DIAL Core returns a non-2xx status on page 2 or later
- **THEN** the endpoint throws and responds 502; partial results from earlier pages are discarded

#### Scenario: Protection against infinite pagination loop — repeated cursor
- **WHEN** DIAL Core returns the same cursor/token twice in successive responses
- **THEN** the service detects the repeated cursor, logs a warning with a safe cursor hash, and throws `BadGatewayException('Pagination loop detected')`
- **AND** the endpoint responds 502

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
- **WHEN** the fetch to DIAL Core exceeds the configured timeout (default 5 000 ms) or the connection is refused
- **THEN** the `AbortController` aborts the request and the endpoint responds 503

#### Scenario: Cache hit returns without upstream call
- **WHEN** `applications:list:<userSub>` is present in the cache
- **THEN** the service returns the cached value immediately without calling DIAL Core

---

### Requirement: ApplicationDto response shape
The backend SHALL define `ApplicationDto` with the following strongly typed fields for use in Swagger and in the generated `@epam/chat-api-client`:

- `id: string` — unique stable identifier from DIAL Core
- `displayName: string` — human-readable display name; falls back to `id` when DIAL Core omits it
- `description?: string` — optional description from DIAL Core metadata
- `iconUrl?: string` — optional icon URL
- `maxInputAttachments?: number` — maximum number of input attachments (from capabilities)
- `inputAttachmentTypes?: string[]` — accepted MIME types for input attachments

`ApplicationsResponseDto` SHALL wrap this as `{ data: ApplicationDto[] }`, mirroring `DialModelListResponseDto`.

#### Scenario: All fields populated
- **WHEN** DIAL Core returns an application with all known fields present
- **THEN** `ApplicationDto` contains all fields with correct types and no `any` values

#### Scenario: Optional fields absent
- **WHEN** DIAL Core omits `description`, `iconUrl`, `maxInputAttachments`, or `inputAttachmentTypes`
- **THEN** those fields are absent (not `null`) in the returned `ApplicationDto`

#### Scenario: Missing displayName defaults to id
- **WHEN** DIAL Core returns an application without a `displayName` field
- **THEN** `ApplicationDto.displayName` equals the `id` value

---

### Requirement: Applications domain structure
The backend SHALL implement the applications feature in `apps/chat-api/src/applications/` following the established domain pattern:

- `applications.controller.ts` — thin controller with `@Get() listApplications(@Req() req)`
- `applications.service.ts` — `ApplicationsService` injects `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) for the shared DIAL SDK client and `baseUrl`; raw fetch with `AbortController`; pagination loop; cache management
- `applications.module.ts` — `ApplicationsModule` that imports `CacheModule`
- `dto/application.dto.ts` — `ApplicationDto` and `ApplicationsResponseDto` with `@ApiProperty` decorators
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
- **THEN** `@epam/chat-api-client` exports an `ApplicationsApi` class with a `listApplications()` method typed to return `Promise<ApplicationsResponseDto>`

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

- Single-page response → returns all items
- Multi-page response (≥ 3 pages) → merges all items
- Empty list → returns `{ data: [] }`
- Last page without next token → loop terminates correctly
- Upstream error on intermediate page → throws mapped HTTP exception
- Repeated cursor → throws `BadGatewayException` with message `'Pagination loop detected'`
- Cache hit → does not call DIAL Core

All DIAL Core calls SHALL be mocked/stubbed; no live network calls.

#### Scenario: Service test for multi-page merge
- **WHEN** the mocked DIAL Core returns page 1 with 2 items and `nextToken: 'page2'`, and page 2 with 1 item and no `nextToken`
- **THEN** the service returns `{ data: [item1, item2, item3] }`

#### Scenario: Service test for repeated cursor protection
- **WHEN** the mocked DIAL Core returns `nextToken: 'same'` on both the first and second page
- **THEN** the service throws `BadGatewayException` containing `'Pagination loop detected'`
