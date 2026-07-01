## MODIFIED Requirements

### Requirement: Unified catalog endpoint

The system SHALL expose `GET /api/v1/catalog` that returns models, applications, and toolsets merged into a single sorted list for the authenticated session user, optionally filtered by model capability query parameters.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Accept an optional `CatalogQueryDto` as query parameters; bind and validate via NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted).
- Fetch models via `ModelsService.listModels`, applications via `ApplicationsService.listApplications`, and toolsets via `ToolsetsService.listToolsets` — all three called in parallel via `Promise.all` and each may be served from their respective caches.
- If any upstream call fails, respond with the mapped error status (502 or 503); do not return a partial list.
- Merge results into `CatalogItemDto[]` and sort by `displayName` case-insensitively ascending; use `id` as a tiebreaker.
- Apply `CatalogFilterService.apply` to the sorted merged list using the normalized capability-only `CatalogFilter` from `CatalogFilterService.parse(dto)`.
- Record `total` (count before filtering) and `filtered` (count after filtering) and include them in `CatalogResponseDto`.
- Cache the **unfiltered** merged list under key `catalog:list:<userSub>` for 30 000 ms; filtering is applied after cache retrieval and filtered results are NOT cached separately.
- Apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- Set response header `Cache-Control: private, max-age=30`.
- Not log the access token, session cookie, or any secret.

#### Scenario: Successful merge with no filter params

- **WHEN** the authenticated user calls `GET /api/v1/catalog` with no query parameters
- **THEN** the endpoint responds 200 with `{ data: CatalogItemDto[], total: N, filtered: N }` where `total === filtered === N` and the result includes models, applications, and toolsets

#### Scenario: Toolsets appear in catalog response

- **WHEN** the authenticated user calls `GET /api/v1/catalog` with no query parameters
- **AND** DIAL Core returns 2 models, 1 application, and 1 toolset
- **THEN** the response contains 4 items with one having `type: 'toolset'`

#### Scenario: Capability filters do not affect toolsets

- **WHEN** `GET /api/v1/catalog?modelCapabilities.chat_completion=true` is called
- **AND** the list contains 1 model with `capabilities.chat_completion: true` and 1 toolset
- **THEN** the response contains both items — the toolset is never filtered by model capability predicates

#### Scenario: Successful merge with model capability filters

- **WHEN** the authenticated user calls `GET /api/v1/catalog?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`
- **THEN** the endpoint responds 200 with matching model items and all application and toolset items in `data`, and `total` reflects the full unfiltered count while `filtered` reflects the matching count

#### Scenario: Invalid query param returns 400

- **WHEN** `GET /api/v1/catalog?types=model` is called
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: Sort is case-insensitive and alphabetical across all types

- **WHEN** the merged list contains items with `displayName` values `['Zebra Toolset', 'alpha model', 'Beta App']`
- **THEN** the sorted order is `['alpha model', 'Beta App', 'Zebra Toolset']`

#### Scenario: Id tiebreaker when displayNames are equal

- **WHEN** two items share the same `displayName`
- **THEN** the item with the lexicographically smaller `id` appears first

#### Scenario: Toolsets fetch fails — full request fails

- **WHEN** `ToolsetsService.listToolsets` throws a mapped HTTP exception
- **THEN** `CatalogService` rethrows the exception and the endpoint responds with the corresponding error status (502 or 503); no partial list is returned

#### Scenario: Models fetch fails — full request fails

- **WHEN** `ModelsService.listModels` throws a mapped HTTP exception
- **THEN** `CatalogService` rethrows the exception and the endpoint responds with the corresponding error status (502 or 503); no partial list is returned

#### Scenario: Applications fetch fails — full request fails

- **WHEN** `ApplicationsService.listApplications` throws a mapped HTTP exception
- **THEN** `CatalogService` rethrows the exception and the endpoint responds with the corresponding error status; no partial list is returned

#### Scenario: Empty toolset list merged with models and applications

- **WHEN** toolsets returns `{ data: [] }` and models returns N items and applications returns M items
- **THEN** the catalog responds 200 with `{ data: CatalogItemDto[N+M], total: N+M, filtered: N+M }`

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded

- **WHEN** the request rate exceeds 60 per minute for the client
- **THEN** the endpoint responds 429

#### Scenario: Catalog cache hit — filter applied to cached list including toolsets

- **WHEN** `catalog:list:<userSub>` is present in the cache (includes models, applications, and toolsets)
- **AND** the request includes `?modelCapabilities.chat_completion=true`
- **THEN** the service returns the cached merged list, applies the capability filter to model items, leaves applications and toolsets unfiltered; `total` equals the cached count, `filtered` equals the matching count
