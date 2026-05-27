## Context

The chat backend exposes `GET /api/v1/models` (proxied via `@epam/ai-dial-typescript-sdk`'s `getModels`) with per-user server-side cache and typed Swagger DTOs. The frontend consumes this through a generated `ModelsApi` client, a thin `models.ts` wrapper, and `ModelsContext` which owns model selection state.

DIAL Core also exposes an Applications API (`GET /openai/applications`) that the chat layer currently ignores. The legacy `GET /api/deployments` endpoint exists but is unversioned, uses a different DTO shape, and is not the right extension point for new features.

The SDK (`@epam/ai-dial-typescript-sdk`) covers models but does not yet expose the Applications API. All Applications API calls must use raw `fetch` with `AbortController` and an explicit timeout, following the same error-mapping helpers already present in `common/utils/dial-fetch-error.ts`.

## Goals / Non-Goals

**Goals:**
- Expose `GET /api/v1/applications` that returns all applications from DIAL Core, exhausting pagination, for the authenticated user.
- Expose `GET /api/v1/catalog` that returns models + applications as a single sorted, typed list.
- Add per-user server-side cache (30 s TTL) and throttling consistent with models.
- Add generated `listApplications` and `listCatalogItems` methods to `@epam/chat-api-client`.
- Add `CatalogContext` as the single owner of unified deployment selection in the frontend conversation flow.
- Mark legacy `GET /api/deployments` as deprecated in Swagger; do not remove or extend it.

**Non-Goals:**
- Changing authentication or session handling.
- Modifying the DIAL Core API.
- Redesigning the conversation UI beyond wiring model/application selection to `CatalogContext`.
- Removing `GET /api/v1/models` or `ModelsContext`.
- Supporting write operations (create/update/delete) for applications.

## Decisions

### 1 — Applications API: raw fetch, not SDK

**Decision:** Use raw `fetch` + `AbortController` (5 s timeout) in `ApplicationsService`, not the SDK client.

**Rationale:** The SDK does not expose the Applications API. Raw fetch is the documented fallback in `apps/chat-api/AGENTS.md` when the SDK has a gap. All error mapping reuses the existing `mapDialHttpStatus` / `handleDialFetchError` helpers from `common/utils/dial-fetch-error.ts` to keep error semantics identical to models.

**Alternative considered:** Waiting for SDK support — rejected because it blocks the feature on an external dependency with no committed timeline.

---

### 2 — Pagination: exhaustive server-side loop

**Decision:** `ApplicationsService.listApplications` fetches all pages before returning. The cursor contract must be verified against the DIAL Core spec before implementation:
- Query parameter name (likely `token` or `cursor`)
- Response field for the next page (likely `nextToken` or `nextCursor` in the JSON body, or a `Link` header)
- Sentinel value when there are no more pages (absent field, empty string, or `null`)

**Loop algorithm:**
```
nextCursor = undefined
allItems = []
seenCursors = new Set<string>()
loop:
  params = nextCursor ? { token: nextCursor } : {}
  response = fetch(DIAL_CORE_URL/openai/applications, { params, timeout: 5s })
  if response.error → throw mapped error
  allItems.push(...response.data.data)
  nextCursor = response.data.nextToken  // or equivalent field
  if !nextCursor → break
  if seenCursors.has(nextCursor) → throw BadGatewayException('Pagination loop detected')
  seenCursors.add(nextCursor)
  if allItems.length > APPLICATIONS_MAX (e.g. 10 000) → break with warning
```

**Rationale:** The frontend needs a complete list for selection; partial lists lead to silent data loss. A `seenCursors` set and a hard page-count cap defend against misbehaving upstream.

---

### 3 — Catalog endpoint: `/api/v1/catalog`

**Decision:** The unified endpoint is `GET /api/v1/catalog`, not `/api/v1/deployments`.

**Rationale:** `/api/deployments` is already occupied by the legacy unversioned endpoint. Introducing `/api/v1/deployments` alongside it creates ambiguity. `/api/v1/catalog` is a clean new name that signals "all deployable items" without overloading "deployment." The legacy endpoint is annotated `@ApiOperation({ deprecated: true })` in Swagger.

**Alternative considered:** `/api/v1/deployments` — rejected because the name collision is confusing and migration semantics are unclear for existing consumers.

---

### 4 — CatalogItemDto shape

```typescript
class CatalogItemDto {
  /** Unique stable identifier from DIAL Core */
  id: string;
  /** Human-readable name for display */
  displayName: string;
  /** Discriminator for UI rendering and filtering */
  type: 'model' | 'application';
  /** Optional description from DIAL Core metadata */
  description?: string;
  /** Icon URL for display in selection lists */
  iconUrl?: string;
  /** Maximum number of input attachments (capabilities field) */
  maxInputAttachments?: number;
  /** MIME types accepted as input attachments */
  inputAttachmentTypes?: string[];
}
```

`displayName` falls back to `id` when DIAL Core returns an absent `displayName`. No `raw` passthrough field — only fields the UI demonstrably needs are included; the DTO is extended when new fields are required.

---

### 5 — Sort order

**Decision:** Single combined sort by `displayName` (case-insensitive ascending), regardless of type. If `displayName` values tie, `id` is the tiebreaker. Type is not used as a primary sort key.

**Rationale:** Users search by name, not by type. A flat alphabetical list is the most predictable for users. The `type` field allows the UI to render icons or type badges without affecting the sort.

**Alternative considered:** Models first, then applications — rejected because it is opinionated about relative importance and makes alphabetical scanning harder.

---

### 6 — Frontend state: new CatalogContext, ModelsContext unchanged

**Decision:** Add `CatalogContext` / `useCatalog` hook. The conversation-flow model/application selection widget is updated to consume `useCatalog` instead of `useModels`. `ModelsContext` is kept as-is for backward compatibility with any existing consumers.

**Rationale:** Merging catalog state into `ModelsContext` would require renaming it, changing its interface, and updating all existing consumers — a large blast radius for no net gain. A new context is additive and keeps `ModelsContext` stable.

`CatalogContext` provides:
- `items: CatalogItemDto[]` — full sorted list
- `selectedItemId: string | null` — currently selected model or application
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

---

### 7 — Partial failure in `/api/v1/catalog`

**Decision:** If either the models fetch or the applications fetch fails, the entire catalog request fails with the upstream error mapped to 502/503. No partial list is returned silently.

**Rationale:** A partial list (e.g., applications only, models missing) is worse than an honest failure: it silently hides items the user might need and leads to confusing "model not found" errors downstream. A typed error allows the UI to show a clear retry prompt.

---

### 8 — Catalog cache: independent keys, shared TTL

**Decision:** Cache `applications:list:<userSub>` and `catalog:list:<userSub>` independently, both at 30 s.

- `CatalogService.listCatalogItems` first checks its own cache key. If absent, calls `ModelsService.listModels` and `ApplicationsService.listApplications` (both may return their own cached data), merges and sorts, then stores the merged result under the catalog cache key.
- Both service caches are invalidated independently on TTL expiry.

**Rationale:** Serving each layer's cache independently avoids double-fetching when applications or models are queried standalone, while still allowing the catalog endpoint to benefit from caching without re-sorting on every request.

## Risks / Trade-offs

- **DIAL Core pagination contract not yet verified** → Before implementation, the implementor MUST read the DIAL Core Applications API documentation (https://dialx.ai/dial_api#tag/Applications/operation/getApplicationMetadata) and confirm cursor field names. This is a prerequisite for the pagination task.

- **Raw fetch timeout tuning** → A 5 s timeout may be too short if DIAL Core is under load and has many applications pages. Mitigation: make the timeout configurable via `EnvironmentVariables` (`DIAL_APPLICATIONS_TIMEOUT_MS`, defaulting to 5000).

- **Large application catalogues** → If DIAL Core returns thousands of applications, the merged catalog response may be large. Mitigation: the 10 000-item hard cap in the loop and a `Content-Encoding: gzip` response header (already set by Helmet/compression middleware if configured).

- **CatalogContext cold-start latency** → Two upstream calls are needed. Mitigation: both are cached independently; in the common case only one fetch escapes cache.

- **Legacy `/api/deployments` confusion** → New consumers may accidentally use the legacy endpoint. Mitigation: `@deprecated` tag in Swagger and a `Deprecation` response header.

## Migration Plan

1. Deploy backend with new endpoints; legacy `GET /api/deployments` remains unchanged.
2. Deploy frontend with `CatalogContext` added and conversation-flow selection wired to it; `ModelsContext` remains in place.
3. No database migrations required.
4. Rollback: remove the two new NestJS modules and revert the frontend context wiring; no data loss.

## Open Questions

1. **Exact DIAL Core pagination contract** — confirm query param name, next-page token field, and empty-page sentinel before writing `ApplicationsService`. Implementor should fetch the OpenAPI spec from https://dialx.ai/dial_api.
2. **DIAL Core application DTO fields** — confirm which fields (`displayName`, `iconUrl`, `maxInputAttachments`, `inputAttachmentTypes`, `description`) are present and their exact JSON key names in the Applications API response.
3. **`@epam/ai-dial-typescript-sdk` Applications support** — verify whether any forthcoming SDK release will cover this before writing raw fetch; if it does, prefer the SDK.
