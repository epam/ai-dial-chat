## Context

`GET /api/v1/catalog` returns the full merged model + application list for the authenticated user.
For the current frontend slice, the only required server-side filters are model capability filters. The frontend is expected to request chat-capable, non-embedding models with `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`.

## Goals / Non-Goals

**Goals:**

- Add validated boolean capability query params to `GET /api/v1/catalog`.
- Apply capability filters only to `type: 'model'` catalog items.
- Keep applications unfiltered whenever model capability filters are active.
- Keep filtering in a small pure `CatalogFilterService`.
- Preserve `total` and `filtered` count metadata in `CatalogResponseDto`.
- Update generated-client usage so frontend callers can pass typed filter params.

**Non-Goals:**

- Type, text search, feature, owner, status, lifecycle, schema, or validity filtering.
- Pushdown filtering to DIAL Core.
- Pagination or cursor support.
- UI redesign beyond passing the required capability filters.

## Decisions

### 1. Boolean capability params

Use flat query params that match DIAL Core boolean capability names:

```text
GET /api/v1/catalog?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false
```

Supported params are `modelCapabilities.completion`, `modelCapabilities.chat_completion`, `modelCapabilities.embeddings`, `modelCapabilities.fine_tune`, and `modelCapabilities.inference`.
Each param accepts only `true` or `false`; unknown params are rejected by the global `ValidationPipe`.

### 2. Exact-match AND semantics

Every provided capability param must match the model capability value exactly.
`modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false` means:

- include models where `capabilities.chat_completion === true`
- include only those where `capabilities.embeddings === false`
- exclude models with missing capability values
- include applications unchanged

### 3. Cache key remains unfiltered

`catalog:list:<userSub>` caches the full merged list. Filter params do not influence the cache key.
Filtering is applied in memory after cache retrieval, so filtered results are not cached separately.

### 4. Catalog item capability shape

`CatalogItemDto.capabilities` remains a `Record<string, boolean>` containing DIAL Core boolean capability fields for model items only. `scale_types` stays excluded because it is not a boolean capability.

## Risks / Rollback

- Generated client request param names may be camel-cased by OpenAPI generation, while the wire query names remain snake_case.
- Missing capability values are treated as non-matches, which is stricter but avoids accidentally showing incompatible models.
- Rollback is straightforward: remove the query DTO fields and regenerate the API client; the response shape remains compatible.
