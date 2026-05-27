## Why

`GET /api/v1/catalog` currently returns the full merged model + application list with no way for clients to narrow results — any search, type filtering, or feature-based selection must be re-implemented in every UI consumer.
Adding a typed, validated query-filter layer on the BFF makes the generated `@epam/chat-api-client` the single source of truth for filter contracts and keeps filtering logic unit-testable on the server rather than scattered across React components.

## What Changes

- Add query-filter support to `GET /api/v1/catalog` via a new `CatalogQueryDto` validated with `class-validator` / `class-transformer` and documented with `@nestjs/swagger`.
- Introduce a `CatalogFilterService` (or equivalent filter utility module) that exposes a registry of typed predicate functions, keeping the `CatalogService` and controller thin.
- Extend `CatalogResponseDto` with optional metadata fields (`total`, `filtered`) to give clients count information without a second request.
- Add Swagger examples for common filter combinations so the generated client surfaces idiomatic usage.
- Add frontend `getCatalogItems(params?)` wrapper update in `apps/chat/src/server-api/catalog.ts` to pass filter params through the generated client.
- Ship unit tests for every predicate, query-parsing edge cases, combined-filter service scenarios, controller validation, and the updated frontend wrapper.

## Capabilities

### New Capabilities

- `catalog-query-filtering`: Typed, validated BFF-side filter mechanism for `GET /api/v1/catalog` — query DTO, predicate registry, filter semantics, and response metadata.

### Modified Capabilities

- `unified-catalog`: Endpoint signature changes — query parameters are added to `GET /api/v1/catalog`; `CatalogResponseDto` gains optional `total` / `filtered` metadata fields; `operationId` `listCatalogItems` handler receives the validated DTO.

## Impact

- **Backend**: `apps/chat-api/src/catalog/` — new `CatalogQueryDto`, `CatalogFilterService`, updated `CatalogService.listCatalogItems` signature, updated controller, new and updated tests.
- **Generated client**: `libs/chat-api-client/` — regenerated after `npm run openapi`; `listCatalogItems()` gains typed optional request params.
- **Frontend**: `apps/chat/src/server-api/catalog.ts` — updated wrapper to accept and forward filter params; `CatalogContext.tsx` may pass filters as needed.
- **OpenAPI spec**: `libs/chat-api-client/openapi.json` — updated with new query parameters and response metadata.
- **No breaking changes** to the existing unauthenticated behavior, authentication flow, or any other endpoint.
