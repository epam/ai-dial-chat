## 1. Catalog capability query contract

- [x] 1.1 Update `apps/chat-api/src/catalog/dto/catalog-query.dto.ts` to expose only boolean model capability query params: `modelCapabilities.completion`, `modelCapabilities.chat_completion`, `modelCapabilities.embeddings`, `modelCapabilities.fine_tune`, `modelCapabilities.inference`.
- [x] 1.2 Reject unknown query params and invalid boolean values via `ValidationPipe`.
- [x] 1.3 Document Swagger metadata and examples for `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`.

## 2. Catalog filtering implementation

- [x] 2.1 Update `apps/chat-api/src/catalog/catalog-filter.service.ts` so `CatalogFilter` contains only a capability boolean map.
- [x] 2.2 Apply exact-match AND semantics for every provided capability value.
- [x] 2.3 Keep application items unfiltered whenever model capability filters are active.
- [x] 2.4 Keep filtering after cache retrieval in `apps/chat-api/src/catalog/catalog.service.ts`.

## 3. Specs and tests

- [x] 3.1 Update `openspec/changes/catalog-query-filtering/specs/catalog-query-filtering/spec.md`.
- [x] 3.2 Update `openspec/changes/catalog-query-filtering/specs/unified-catalog/spec.md`.
- [x] 3.3 Update `openspec/changes/catalog-query-filtering/design.md`.
- [x] 3.4 Update `apps/chat-api/src/catalog/tests/catalog-filter.service.spec.ts`.
- [x] 3.5 Update `apps/chat-api/src/catalog/tests/catalog.controller.spec.ts`.
- [x] 3.6 Update `apps/chat-api/src/catalog/tests/catalog.service.spec.ts`.

## 4. Generated client and frontend wrapper

- [x] 4.1 Run `npm run openapi`.
- [x] 4.2 Run `npm run openapi:check`.
- [x] 4.3 Update `apps/chat/src/server-api/tests/catalog.api.spec.ts` to use generated capability filter params.
- [x] 4.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache`.
- [x] 4.5 Update `apps/chat/src/context/CatalogContext.tsx` to request `modelCapabilitiesChatCompletion: true` and `modelCapabilitiesEmbeddings: false`.

## 5. Verification

- [x] 5.1 Run `npm exec nx test chat-api -- --skip-nx-cache`.
- [x] 5.2 Run `npm exec nx lint chat-api -- --skip-nx-cache`.
- [x] 5.3 Run `npm exec nx test chat -- --skip-nx-cache`.
- [x] 5.4 Run `npm exec nx lint chat -- --skip-nx-cache`.
- [x] 5.5 Run `npm exec nx build chat-api -- --skip-nx-cache`.
