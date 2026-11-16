# Design

## Context

See `proposal.md` (Why, Problem) for the motivation. Requirements are in `specs/model-listing`, `specs/model-lookup` and `specs/model-catalog`.

What shapes the approach:

- `HIDDEN_ENTITY_TAGS` is already parsed and validated at boot into `string[]` (`ClientUiEnv` in `apps/chat-api/src/config/env/client-ui.env.ts`). No env change is needed.
- Two services build their own `Set` from it today (`DeploymentsListingService`, `DeploymentsLookupService`), and `mapToDeploymentItem` matches inline: `(raw.description_keywords || []).some((tag) => hiddenTags.has(tag))`. That expression throws if Core ever sends a non-array truthy value.
- `ModelsService` caches through `withCachedDialRequest` (`apps/chat-api/src/dial/cached-dial-request.helper.ts`) in the shared `CACHE_MANAGER`. A `fetch` that throws is not cached, and an `HttpException` thrown inside it is re-thrown unchanged by `handleDialFetchError`.
- `ModelCatalogService` owns one in-memory entry and one in-flight promise. `fetchCatalog` already validates and projects Core's entries (`toCatalogEntry`) before `loadCatalog` caches them, and `getCatalogEntry` resolves details from that cached list.
- `ModelsService` is exported from `ModelsModule` but has no consumer outside `apps/chat-api/src/models/`. `ConfigModule` is global (`apps/chat-api/src/app/app.module.ts`), so injecting `ConfigService` needs no module change.
- Backend conventions (Logger + ConfigService, typed HTTP exceptions, Swagger for every status) come from `apps/chat-api/AGENTS.md` and are not repeated here.

## Goals / Non-Goals

**Goals:**

- One tag-matching function used by the deployments mapper and by both model services, so the Chat Catalog and Models Garden cannot drift.
- Hidden models are dropped before anything is cached, except the per-model detail entry (see D3).
- No change to response DTOs, operation ids, status-code sets, cache keys, TTLs or `Cache-Control` headers.

**Non-Goals:**

- Moving the deployments services' other config reads (`FEATURED_MODEL_IDS`) into a helper.
- Logging hidden model ids. The tags are operator configuration, and the lists are already observable through `/api/v1/deployments`.
- Any authorization change. All four routes stay behind the global `SessionGuard` and are open to every signed-in user, as today.

## Decisions

### D1. Shared helper in `apps/chat-api/src/deployments/utils/hidden-entity-tags.util.ts`

Two pure exports:

```ts
export const readHiddenEntityTags = (
  configService: ConfigService<EnvironmentVariables>,
): ReadonlySet<string> =>
  new Set(configService.get('HIDDEN_ENTITY_TAGS', { infer: true }) ?? []);

export const hasHiddenEntityTag = (
  keywords: unknown,
  hiddenTags: ReadonlySet<string>,
): boolean =>
  hiddenTags.size > 0 &&
  Array.isArray(keywords) &&
  keywords.some((tag) => typeof tag === 'string' && hiddenTags.has(tag));
```

- `mapToDeploymentItem` sets `isHidden: hasHiddenEntityTag(raw.description_keywords, hiddenTags)`. Its `hiddenTags` parameter becomes `ReadonlySet<string>`.
- `DeploymentsListingService`, `DeploymentsLookupService`, `ModelsService` and `ModelCatalogService` call `readHiddenEntityTags` once in their constructors, as the deployments services do today.
- `keywords: unknown` lets the catalog pass a raw `Record<string, unknown>` field without a cast, and makes the non-array case return `false` instead of throwing. For well-formed Core data, `isHidden` on `/api/v1/deployments` gives the same result as before.

*Alternatives.* `apps/chat-api/src/common/utils/` is more neutral, but the predicate defines a deployment-mapping rule, and `ModelCatalogService` already imports `mapCatalogProperties` from `deployments/utils`. An injectable `HiddenEntityTagsService` would add a provider for one pure function and break the mapper's purity. A `Set` per call would re-read config on every request.

### D2. `GET /api/v1/models` filters inside the cached `fetch`

`listModels` returns `{ data: models.filter((m) => !hasHiddenEntityTag(m.description_keywords, this.hiddenTags)) }` from its `fetch`, so the `models:list:<sub>` entry holds the filtered list, as the issue asks. Everything else in each entry is passed through untouched. The early `size > 0` check in D1 keeps the empty-tag path at almost zero cost.

*Alternative.* Filtering after the cache read would re-filter on every hit and keep hidden models in memory. It gives no benefit because the tags are static.

### D3. `GET /api/v1/models/:modelName` checks after the cache

`getModel` keeps caching Core's raw answer under `models:single:<sub>:<name>` and checks the value `withCachedDialRequest` returns. A hidden model throws `new NotFoundException('Resource not found')`, the same message `mapDialHttpStatus` uses for a Core `404`, so the two cases look the same to a caller.

*Why not throw inside `fetch`:* a thrown `fetch` is never cached, so every lookup of a hidden model would call Core again and lose the 60-second cache. Checking after the cache costs one `Set` lookup per request and keeps the miss rate unchanged. Caching a "hidden" marker instead would change the cache value type for no gain.

### D4. The catalog filters raw Core entries before projecting and caching

In `fetchCatalog`, the hidden check joins the existing `isRecord && typeof id === 'string'` filter step. It runs on the raw Core record, before `toCatalogEntry`. Only the malformed-entry count goes into the existing `warn`. Hidden entries are dropped silently, because hiding is configuration, not a data problem.

- Matching on the raw record means the rule does not depend on `description_keywords` staying in `MODEL_CATALOG_ENTRY_FIELDS`.
- `loadCatalog` caches the result, so the shared 5-minute entry and every in-flight waiter get the filtered list.
- `getCatalogEntry` is unchanged: a hidden model is simply missing from the list and answers its existing `NotFoundException('Model not found')`.

### D5. Swagger, README and generated client

- `ModelsController`: the `listModels` and `getModel` descriptions say that models tagged with `HIDDEN_ENTITY_TAGS` are omitted. The `404` of `getModel` reads "Model not found, or hidden through `HIDDEN_ENTITY_TAGS`".
- `ModelCatalogController`: the same sentence goes on `listModelCatalog`, and the detail `404` says "…not in the catalog, or hidden through `HIDDEN_ENTITY_TAGS`".
- `npm run openapi` regenerates the spec and `libs/chat-api-client`. Only descriptions change. `npm run openapi:check` must pass.
- `apps/chat-api/README.md`: the `HIDDEN_ENTITY_TAGS` row lists all routes it affects (the Catalog and selector through `isHidden`, the two model routes, the two catalog routes) and states that hiding is not access control. The "Model catalog" section gains one bullet. In `docs/architecture.md`, the `/api/v1/model-catalog` route-table description mentions the hidden-tag filter.

## Risks / Trade-offs

- [A consumer relied on `/api/v1/models` listing hidden models] → None found in this repo: `apps/chat` does not call it (`model-listing` spec purpose). External consumers get the documented behavior, and an empty `HIDDEN_ENTITY_TAGS` restores the old output.
- [Hiding is mistaken for access control] → The README row and the Swagger text say so explicitly. Completion, share and publish guards are unchanged.
- [`/api/v1/models/:name` 404 for a model the user can invoke may confuse debugging] → It matches what the Chat Catalog already shows. Operators can confirm through `/api/v1/deployments`, which still reports `isHidden: true`.
- [The shared predicate changes `isHidden` for malformed `description_keywords`] → It used to throw, and now it returns `false`. That is strictly safer. A mapper unit test pins the behavior.
- [Tag changes need a restart] → Same as today for the deployments routes. Env values are read at boot.

## Migration Plan

No data or cache migration. Deploy as usual. Operators who already set `HIDDEN_ENTITY_TAGS` see hidden models disappear from Garden within one cache TTL of the rollout (a restart empties the caches anyway). Rollback: revert the commit, or unset `HIDDEN_ENTITY_TAGS` to show all models again (which also un-hides them in the Chat Catalog).
