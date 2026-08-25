# catalog-query-filtering Specification

## Purpose

Capability query parameters on the catalog endpoint and the filter service that applies them.

## Requirements

### Requirement: CatalogQueryDto capability query parameters
The system SHALL accept only capability filter query parameters on `GET /api/v1/catalog` via a `CatalogQueryDto` class decorated with `class-validator`, `class-transformer`, and `@nestjs/swagger`.

All parameters are optional. Absent parameters apply no capability filter.
Unknown query parameters SHALL be rejected with HTTP 400 by the global `ValidationPipe` allowlist.
Capability query values SHALL be boolean strings (`true` or `false`) and SHALL be transformed to booleans before filtering.

`CatalogQueryDto` fields:

| Param | Type | Meaning |
|---|---|---|
| `modelCapabilities.completion` | `boolean` | Exact expected DIAL Core `capabilities.completion` value on model items |
| `modelCapabilities.chat_completion` | `boolean` | Exact expected DIAL Core `capabilities.chat_completion` value on model items |
| `modelCapabilities.embeddings` | `boolean` | Exact expected DIAL Core `capabilities.embeddings` value on model items |
| `modelCapabilities.fine_tune` | `boolean` | Exact expected DIAL Core `capabilities.fine_tune` value on model items |
| `modelCapabilities.inference` | `boolean` | Exact expected DIAL Core `capabilities.inference` value on model items |

#### Scenario: Valid request with no filter params
- **WHEN** `GET /api/v1/catalog` is called with no query parameters
- **THEN** `CatalogQueryDto` parses successfully with all fields `undefined` and no filtering is applied

#### Scenario: Valid request with frontend capability filters
- **WHEN** `GET /api/v1/catalog?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false` is called
- **THEN** `CatalogQueryDto['modelCapabilities.chat_completion']` is `true`, `CatalogQueryDto['modelCapabilities.embeddings']` is `false`, and only model items are filtered by those exact capability values

#### Scenario: Unknown query param rejected
- **WHEN** `GET /api/v1/catalog?types=model` is called
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: Invalid boolean rejected
- **WHEN** `GET /api/v1/catalog?modelCapabilities.chat_completion=yes` is called
- **THEN** the endpoint responds 400 with a validation error

---

### Requirement: CatalogFilter normalized internal type
The system SHALL define a `CatalogFilter` type (plain TypeScript interface) that represents the normalized, parsed form of `CatalogQueryDto`.
`CatalogFilter` is produced by `CatalogFilterService.parse(dto: CatalogQueryDto): CatalogFilter` and used internally; it is never serialized to the client.

`CatalogFilter` SHALL contain only `capabilities?: Partial<Record<'completion' | 'chat_completion' | 'embeddings' | 'fine_tune' | 'inference', boolean>>`.

#### Scenario: DTO with undefined fields produces CatalogFilter with all undefined
- **WHEN** `CatalogFilterService.parse({})` is called
- **THEN** all `CatalogFilter` fields are `undefined` (no active predicates)

#### Scenario: DTO capability booleans are normalized
- **WHEN** `CatalogFilterService.parse({ 'modelCapabilities.chat_completion': true, 'modelCapabilities.embeddings': false })` is called
- **THEN** result is `{ capabilities: { chat_completion: true, embeddings: false } }`

---

### Requirement: CatalogFilterService capability predicate
`apps/chat-api/src/catalog/catalog-filter.service.ts` SHALL implement `CatalogFilterService` as a NestJS `@Injectable()`.

It SHALL expose:
- `parse(dto: CatalogQueryDto): CatalogFilter` — normalizes DTO into an internal capability filter
- `apply(items: CatalogItemDto[], filter: CatalogFilter): CatalogItemDto[]` — applies the capability predicate

`CatalogFilterService` SHALL NOT call any upstream service, perform I/O, or access the cache.
`capabilitiesFilter` SHALL be an exported pure function in the same file for independent unit testing.

#### Scenario: apply with no active filters returns all items unchanged
- **WHEN** `catalogFilterService.apply(items, {})` is called with an empty filter
- **THEN** all items are returned in the original order

#### Scenario: capabilitiesFilter requires exact boolean matches
- **WHEN** filter is `{ capabilities: { chat_completion: true, embeddings: false } }`
- **AND** an item is `type: 'model'` with `capabilities: { chat_completion: true, embeddings: false }`
- **THEN** the item passes the filter

#### Scenario: capabilitiesFilter rejects non-matching boolean values
- **WHEN** filter is `{ capabilities: { chat_completion: true, embeddings: false } }`
- **AND** an item is `type: 'model'` with `capabilities: { chat_completion: true, embeddings: true }`
- **THEN** the item does NOT pass the filter

#### Scenario: capabilitiesFilter keeps application items unfiltered
- **WHEN** any capability filter is active and an item has `type: 'application'`
- **THEN** the item passes the filter because model capability filters do not apply to applications

---

### Requirement: Unit tests for CatalogFilterService and predicates
`apps/chat-api/src/catalog/tests/catalog-filter.service.spec.ts` SHALL cover:

- `parse()`: all fields undefined and capability boolean normalization
- `capabilitiesFilter()`: exact match, value mismatch, missing capability, and application pass-through
- `apply()`: empty filter, matching model filter, application pass-through, empty model result, all-items result
- No network calls, no NestJS context required

#### Scenario: Filter service suite runs in isolation

- **WHEN** `catalog-filter.service.spec.ts` is executed
- **THEN** it covers `parse()`, `capabilitiesFilter()`, and `apply()` across the listed cases
- **AND** it completes without a network call or a NestJS testing module

---

### Requirement: Controller unit tests for query validation
`apps/chat-api/src/catalog/tests/catalog.controller.spec.ts` SHALL include test cases for:

- Valid request with no query params -> 200
- Valid request with `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false` -> service called with normalized capability filter
- Unknown query parameter -> 400 from `ValidationPipe`
- Invalid boolean value -> 400 from `ValidationPipe`

#### Scenario: Controller forwards parsed DTO to CatalogService
- **WHEN** a valid request with `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false` arrives
- **THEN** the controller calls `catalogService.listCatalogItems(sub, at, filter)` where `filter.capabilities = { chat_completion: true, embeddings: false }`

---

### Requirement: Frontend server-api wrapper accepts generated catalog params
`apps/chat/src/server-api/catalog.ts` SHALL accept an optional `ListCatalogItemsRequest` argument and forward it unchanged to the generated `catalogApi.listCatalogItems(params)`.

The generated `@epam/chat-api-client` request type SHALL be used directly as the param type (no hand-crafted wrapper type).

#### Scenario: getCatalogItems passes capability filter params to generated client
- **WHEN** `getCatalogItems({ modelCapabilitiesChatCompletion: true, modelCapabilitiesEmbeddings: false })` is called
- **THEN** it calls `catalogApi.listCatalogItems({ modelCapabilitiesChatCompletion: true, modelCapabilitiesEmbeddings: false })` and returns the result

#### Scenario: getCatalogItems with no params calls without params
- **WHEN** `getCatalogItems()` is called
- **THEN** it calls `catalogApi.listCatalogItems()` without throwing
