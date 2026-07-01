## MODIFIED Requirements

### Requirement: GET /api/v1/deployments endpoint

The system SHALL expose `GET /api/v1/deployments` that proxies DIAL Core `GET /v1/deployments` and returns all deployments (models, applications, toolsets) visible to the authenticated session user, optionally filtered by interface type.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- SHALL accept an optional `interfaceTypes` query parameter as a repeatable string value (or comma-separated list) validated against `('chat' | 'embedding' | 'mcp' | 'custom_ui' | 'all')`; passing an unrecognised value MUST respond 400.
- SHALL call DIAL Core using the `@epam/ai-dial-typescript-sdk` client, passing the session access token, to retrieve the unfiltered deployment list.
- SHALL map the DIAL Core response `deployments` array to `DeploymentItemDto[]` using the normalisation rules in the `DeploymentItemDto shape` requirement.
- SHALL respond 200 with `{ deployments: DeploymentItemDto[] }` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- SHALL cache the **unfiltered** full DIAL Core response under key `deployments:list:<userSub>` for 30 000 ms; `interfaceTypes` filtering SHALL be applied in-process after cache retrieval using the per-value exclusion rules defined in the `deployment-interface-type-filter-semantics` spec.
- SHALL set response header `Cache-Control: private, max-age=30`.
- MUST NOT log the session access token.

#### Scenario: Authenticated user receives all deployments without filter

- **WHEN** `GET /api/v1/deployments` is called with a valid session and no `interfaceTypes` parameter
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing all models, applications, and toolsets from DIAL Core

#### Scenario: Authenticated user filters by single interface type

- **WHEN** `GET /api/v1/deployments?interfaceTypes=chat` is called with a valid session
- **THEN** the endpoint responds 200 with only deployments satisfying the `chat` semantics (no toolsets)

#### Scenario: New fields present on response items

- **WHEN** `GET /api/v1/deployments` returns items with DIAL Core `owner` populated
- **THEN** each item in the response includes `owner`, `isMy`, and (for folder-nested applications) `applicationFolder`

#### Scenario: Backward compatibility — clients ignoring new fields are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `owner`, `isMy`, or `applicationFolder`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

#### Scenario: Authenticated user filters by multiple interface types

- **WHEN** `GET /api/v1/deployments?interfaceTypes=chat&interfaceTypes=mcp` is called with a valid session
- **THEN** the endpoint responds 200 with deployments matching either `chat` or `mcp` semantics

#### Scenario: Invalid interfaceTypes value returns 400

- **WHEN** `GET /api/v1/deployments?interfaceTypes=unknown` is called
- **THEN** the endpoint responds 400 with a validation error referencing `interfaceTypes`

#### Scenario: Old interface_type parameter name is rejected

- **WHEN** `GET /api/v1/deployments?interface_type=chat` is called (old parameter name)
- **THEN** the endpoint responds 400 because `interface_type` is not a known query parameter

#### Scenario: Unauthenticated request rejected

- **WHEN** `GET /api/v1/deployments` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded

- **WHEN** the request rate exceeds 60 per minute for the client IP
- **THEN** the endpoint responds 429

#### Scenario: DIAL Core unreachable

- **WHEN** DIAL Core does not respond within the SDK timeout
- **THEN** the endpoint responds 503

#### Scenario: DIAL Core returns error

- **WHEN** DIAL Core returns a non-2xx response to the upstream call
- **THEN** the endpoint responds 502

#### Scenario: Cache hit — interfaceTypes filter applied in-process to cached list

- **WHEN** `deployments:list:<userSub>` is present in cache and `interfaceTypes=chat` is requested
- **THEN** the service returns cached deployments filtered in-process (applying the chat exclusion rules) without calling DIAL Core

---

### Requirement: Deployments domain structure

The backend SHALL implement the deployments feature in `apps/chat-api/src/deployments/` following the established domain pattern:

- `deployments.controller.ts` — thin controller with `@Get() listDeployments(@Query() query: DeploymentsQueryDto, @Req() req)`
- `deployments.service.ts` — extends `AppService`; calls SDK method for deployments; maps and caches results; applies in-process `interfaceTypes` filtering using the semantic predicate table
- `deployments.module.ts` — `DeploymentsModule` providing `DeploymentsService`; no external domain imports needed
- `dto/deployment-item.dto.ts` — `DeploymentItemDto` and `DeploymentsResponseDto` with `@ApiProperty` decorators
- `dto/deployments-query.dto.ts` — `DeploymentsQueryDto` with `interfaceTypes` field: `@IsOptional`, `@IsArray`, `@IsIn(['chat', 'embedding', 'mcp', 'custom_ui', 'all'], { each: true })`, `@Transform` for comma-separated coercion
- `tests/deployments.controller.spec.ts`
- `tests/deployments.service.spec.ts`
- `tests/deployments.controller.integration.spec.ts`

`DeploymentsModule` SHALL be imported into `AppModule`.

#### Scenario: DeploymentsModule resolves without errors

- **WHEN** NestJS boots with `DeploymentsModule` imported into `AppModule`
- **THEN** `DeploymentsService` resolves without circular dependency errors

#### Scenario: Controller delegates to service with parsed query

- **WHEN** `listDeployments` is called with a validated `DeploymentsQueryDto`
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `deploymentsService.listDeployments(sub, at, query.interfaceTypes)`

---

### Requirement: Swagger and generated client for deployments

The `listDeployments` handler SHALL be annotated:

- `@ApiTags('deployments')`
- `@ApiOperation({ operationId: 'listDeployments', summary: 'List deployments by interface type' })`
- `@ApiQuery` for `interfaceTypes` with enum values `['chat', 'embedding', 'mcp', 'custom_ui', 'all']` and multi-value example
- `@ApiResponse({ status: 200, type: DeploymentsResponseDto })`
- Standard 400, 401, 403, 429, 502, 503 `@ApiResponse` entries

The `'deployments'` tag SHALL be present in `openapi.config.ts`.

Running `npm run openapi` SHALL produce a `DeploymentsApi` class in `@epam/chat-api-client` with a `listDeployments(params?: ListDeploymentsRequest)` method typed to return `Promise<DeploymentsResponseDto>` where `ListDeploymentsRequest` contains `interfaceTypes?: string[]`.

#### Scenario: Generated client exposes typed listDeployments method with interfaceTypes

- **WHEN** `npm run openapi` runs after the deployments controller update
- **THEN** `@epam/chat-api-client` exports a `DeploymentsApi` class with `listDeployments` method accepting optional `interfaceTypes` array (plural)

---

### Requirement: Frontend server-api wrapper for deployments

`apps/chat/src/server-api/deployments.api.ts` SHALL export:

```ts
export const getDeployments = (interfaceTypes?: string[]): Promise<DeploymentsResponseDto> =>
  deploymentsApi.listDeployments({ interfaceTypes });
```

`deploymentsApi` SHALL be instantiated in `api-client.ts`.

#### Scenario: getDeployments with no params returns all deployments

- **WHEN** `getDeployments()` is called
- **THEN** it calls `deploymentsApi.listDeployments()` without throwing

#### Scenario: getDeployments with interfaceTypes filters correctly

- **WHEN** `getDeployments(['chat'])` is called
- **THEN** it calls `deploymentsApi.listDeployments({ interfaceTypes: ['chat'] })`

---

### Requirement: Backend service tests for deployments

`deployments.service.spec.ts` SHALL cover:

- Successful mapping of `ModelOpenAi`, `ApplicationOpenAi`, `ToolsetOpenAi` entries to `DeploymentItemDto[]`
- Items without `id` are skipped
- `displayName` falls back to `id` when `display_name` is absent
- Cache hit — returns cached value without calling DIAL Core
- `interfaceTypes=chat` filter applied after cache hit — excludes toolsets, correct item count returned
- `interfaceTypes=embedding` filter applied after cache hit — excludes applications and toolsets
- `interfaceTypes=mcp` filter applied after cache hit — excludes models, includes toolsets unconditionally
- `interfaceTypes=custom_ui` filter applied after cache hit — excludes models and toolsets
- Multi-value `interfaceTypes` union — item matching any value is included
- DIAL Core 502 → service throws `BadGatewayException`
- DIAL Core unreachable → service throws `ServiceUnavailableException`

All DIAL Core calls SHALL be mocked; no live network calls.

#### Scenario: Service test — successful full listing

- **WHEN** DIAL Core returns 2 models, 1 application, 1 toolset
- **THEN** `listDeployments` returns `{ deployments: [DeploymentItemDto × 4] }` with correct `type` discriminators

#### Scenario: Service test — cache hit skips DIAL Core call

- **WHEN** `deployments:list:<userSub>` is populated in cache
- **THEN** the DIAL Core SDK is NOT called on the second request

#### Scenario: Service test — chat filter excludes toolset

- **WHEN** `listDeployments` is called with `interfaceTypes: ['chat']` and cache contains 1 chat model and 1 toolset
- **THEN** the returned list contains only the chat model
