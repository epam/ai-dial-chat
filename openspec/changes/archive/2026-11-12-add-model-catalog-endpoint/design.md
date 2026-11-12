## Context

`ModelsService` (`apps/chat-api/src/models/models.service.ts`) lists and looks up models through `DialClientService.client.getModels` / `getModel` with the session's bearer token. Each call goes through `withCachedDialRequest` (`apps/chat-api/src/dial/cached-dial-request.helper.ts`), which checks `CACHE_MANAGER`, calls `fetch`, caches the result and maps thrown errors with `handleDialFetchError`. A non-ok SDK result is mapped with `mapDialHttpStatus`, which turns `401`/`403` into `UnauthorizedException`/`ForbiddenException`.

Core visibility (`ModelController.getModels` → `RoleBasedEntity.hasAccess`) works as follows. A model is listed when its `userRoles` is unset or shares a role with the caller. For an API key, the caller's roles are the key's roles. An empty `userRoles` list hides the model from everyone. A per-model `GET /openai/models/{name}` answers `403` for a model the caller cannot see.

`DIAL_API_KEY` exists only for conversation naming, and `aiTextRefinementAvailable` is the existing precedent for a client-config boolean derived from env (`apps/chat-api/src/app-config/app-config.service.ts`). Two single-flight patterns already exist: `ImmutableResourceStore.pending` (`apps/chat-api/src/celebrations/immutable-resource.store.ts`) and `RefreshService.inFlight` (`apps/chat-api/src/auth/refresh/refresh.service.ts`).

Server conventions (versioning, thin annotated controllers, Logger + ConfigService, DTOs, typed exceptions, env on domain classes) follow `apps/chat-api/AGENTS.md` §2–§7 and are not repeated here.

## Goals / Non-Goals

**Goals:**

- Signed-in users can read a deployment-wide catalog of models, with no API key ever reaching the browser.
- At most one Core list request per BFF instance per TTL window, including under concurrent cold-cache traffic.
- A bad, revoked or under-privileged catalog key degrades the catalog (`503`) and never signs users out.
- Detail lookups never reveal the existence of models hidden from the key.
- Zero behaviour change for `GET /api/v1/models[/:modelName]`, `DIAL_API_KEY` and conversation naming.

**Non-Goals:**

- Any frontend in this repo, a merged per-user view, or an `accessible` flag.
- Cross-instance caching, negative caching, or event-driven invalidation.
- Hot-reloading the key without a restart.

## Decisions

### D1. Location: a `catalog/` concern inside the `models` domain

The new files are `apps/chat-api/src/models/catalog/model-catalog.controller.ts`, `model-catalog.service.ts` and `model-catalog-key.ts`, registered in the existing `ModelsModule`. Tests go under `apps/chat-api/src/models/tests/catalog/`.

- *Why:* the catalog serves the same resource (`DialModelDto`) and validates with the same `GetModelDto`. `AGENTS.md` §1 allows concern subfolders in a domain. A separate top-level `model-catalog/` domain would import `models/dto` across domains.
- *Alternative:* add the methods to `ModelsController` / `ModelsService`. Rejected because the base path differs (`model-catalog` vs `models`), and mixing session-scoped and key-scoped calls in one service invites copy-paste mistakes with the auth header.

### D2. Route path `model-catalog`, operationIds `listModelCatalog` / `getModelCatalogEntry`

`@Controller({ path: 'model-catalog', version: '1' })` with `@ApiTags('models')`, so the generated methods land on the existing `ModelsApi`. `operationIdFactory` uses the handler name (`apps/chat-api/src/openapi/openapi.config.ts`), so the handler names must be globally unique. `getModelCatalogEntry` avoids a clash with `getModel`.

- *Alternative:* `models/catalog`. Rejected because it collides with `models/:modelName`.

### D3. Key resolution in one pure helper

`model-catalog-key.ts` exports `resolveModelCatalogApiKey(configService): string | undefined`, which returns the trimmed key or `undefined` for unset or blank. Both `ModelCatalogService` and `AppConfigService` call it, so the client-config flag and the route can never disagree. A pure function avoids making `AppConfigModule` import `ModelsModule` just for a boolean.

- *Alternative:* expose `ModelCatalogService.isAvailable()` and inject it into `AppConfigService`. Rejected because it adds a module edge for a one-line check.

### D4. Cache + single-flight in `ModelCatalogService`

```
getCatalog():
  key = resolveModelCatalogApiKey() ?? throw NotFoundException
  if inFlight: return inFlight
  inFlight = withCachedDialRequest({ cacheKey: 'models:catalog', ttlMs: 300_000, fetch: fetchFromCore(key) })
             .finally(() => inFlight = null)
  return inFlight
```

- The helper's cache read happens inside the shared promise. A request that arrives while the fetch runs awaits the same promise, so it neither reads the cache nor calls Core.
- A rejection propagates to every waiter, and `finally` clears the handle. Errors are never cached (`withCachedDialRequest` only `set`s on success).
- `withCachedDialRequest` is reused unchanged rather than extended with a `singleFlight` option. Single-flight is needed only here today. Changing the shared helper would widen the blast radius to every domain that uses it.
- The detail route calls `getCatalog()` and then `data.find((m) => m.id === modelName)`. It throws `NotFoundException` when the model is not found. A linear scan over a catalog of tens to hundreds of entries costs nothing next to the request.
- *Alternative:* a short negative cache for failures. Rejected for now because the issue asks only for concurrent de-duplication, and a negative cache would delay recovery after a key is fixed. It is listed under Risks.

### D5. Error mapping inside `fetchFromCore`

```
result = await dialClient.client.getModels({ headers: getApiKeyAuthHeaders(key) })
if (!result.response.ok || result.error != null):
  status = result.response.status
  if status in {401, 403}:
    logger.error(`DIAL Core rejected the model catalog key (${status})`)
    throw new ServiceUnavailableException('Model catalog is unavailable')
  return mapDialHttpStatus(status, 'list model catalog', logger)
return { data: (result.data as DialModelListResponseDto).data }
```

- The `503` is thrown as an `HttpException` inside `fetch`, and `handleDialFetchError` rethrows `HttpException`s unchanged, so it reaches the client as `503`.
- No error body is passed to `mapDialHttpStatus`, so Core's text is never logged. That keeps any echo of request headers out of the logs.
- Network errors and timeouts already become `503` through `handleDialFetchError`.

### D6. `Cache-Control: private, max-age=300`

This matches the server TTL. `private` keeps shared proxies from caching session-gated data. The handler sets the header through `@Res({ passthrough: true })` after the catalog resolves, not with `@Header()`. Nest's `@Header()` also stamps error responses, so a browser would keep a transient `404`/`503` for the full `max-age`. Error responses therefore carry no explicit freshness. The controller spec found this during implementation.

- *Alternative:* `private` with no `max-age`. Equivalent in safety, but every page view would cost a round trip.

### D7. `modelCatalogAvailable` appended last in `config`

The service builds `{ aiTextRefinementAvailable, appVersion, ...config, catalogCreationPermissions, modelCatalogAvailable }`. Appending keeps every existing key's position, so the existing order assertions only gain one trailing entry. The DTO marks the field optional (`@ApiPropertyOptional`), as `aiTextRefinementAvailable` is, so a newer client tolerates an older BFF.

### Authorization

| Route                                  | Who may call         | Roles required                                                      |
| -------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `GET /api/v1/model-catalog`            | Any signed-in user   | None at the BFF. Visibility is the catalog key's Core roles         |
| `GET /api/v1/model-catalog/:modelName` | Any signed-in user   | None at the BFF                                                     |
| `GET /api/v1/models[/:modelName]`      | Unchanged            | The user's own Core roles, unchanged                                |

The catalog is display data. Whether a user can *use* a model is still decided by Core on the user's own token.

### Frontend / generated client

No `apps/chat/src/server-api/` wrapper or `api-client.ts` change is planned, because no caller exists in this repo. That differs from the usual new-endpoint checklist on purpose. The consumer (Models Garden) uses `ModelsApi.listModelCatalog()` / `getModelCatalogEntry()` from the regenerated `@epam/ai-dial-chat-api-client`. No hand-authored `libs/*` changes, so library-isolation rules are not engaged.

## Risks / Trade-offs

- **Privacy:** signed-in users see names, descriptions, pricing and limits of models they cannot use. → The feature is opt-in per deployment through the key, the README calls out the exposure, and the proposal asks product/security to confirm before a deployment enables it.
- **The key can invoke models, not just list them** (Core has no list-only permission). → The README instructs operators to use a dedicated role with minimal limits and to store the key as a secret. The BFF uses the key for the list call only.
- **Models missing from the catalog** when an operator forgets to add the key's role to a model's `userRoles`. → Documented. Users with access still see the model through `GET /api/v1/models`, because the frontend unions the two lists.
- **Sequential retries during a Core outage:** without negative caching, each request that arrives after a failure starts a new Core call. Concurrent requests still collapse into one. → Acceptable at the expected traffic. Revisit with a short (5–10 s) negative cache if Core load during outages becomes a problem.
- **Staleness up to about 10 minutes** (5 min server TTL + 5 min browser `max-age`) after a model is added or removed. → Acceptable for display data. No invalidation hook exists in the BFF for Core config changes.
- **Per-instance cache:** N BFF instances make up to N Core calls per TTL window. → Negligible.

## Migration Plan

1. Deploy the BFF with the change. With no key set, routes answer `404` and the flag is `false`, so nothing changes for existing deployments.
2. Operators who want the catalog create a Core key with a dedicated role, add that role to the `userRoles` of every restricted model, set `MODEL_CATALOG_API_KEY` as a secret, and restart.
3. Rollback: unset the key and restart, or revert the change. The routes and the optional field are additive, so no client breaks.

## Open Questions

- Product/security sign-off on exposing restricted-model metadata to all signed-in users of a deployment that enables the key. This does not block implementation, because the feature is off by default.

## Review revisions

A review of the implementation changed three decisions. The sections above keep the original reasoning, and the specs describe the result.

- **D4, cache store.** The catalog entry is held by `ModelCatalogService` (`{ value, expiresAt }` next to `inFlight`), not in `CACHE_MANAGER`. The shared store is a 100-entry LRU (`apps/chat-api/src/app/cache.config.ts`) that per-user keys such as `models:list:<sub>` fill quickly. Browser `max-age=300` makes catalog reads rare, so it would be evicted before its TTL and the catalog key would call Core again. `ImmutableResourceStore` is the precedent for a cache kept outside the shared store. Thrown errors are mapped with `handleDialFetchError` directly, as `withCachedDialRequest` did.
- **D5, malformed body.** A Core `200` whose body has no `data` array is rejected with `502` before it is cached. Before, `{ data: undefined }` would have been served to every user for 5 minutes, and the detail route would have failed with a `TypeError`. Entries that are not objects or have no string `id` are dropped with a `warn`.
- **Body projection.** The body is no longer passed through unchanged. Each entry is reduced to the display fields in `MODEL_CATALOG_ENTRY_FIELDS`, and `ModelCatalogEntryDto` / `ModelCatalogListResponseDto` (`apps/chat-api/src/models/dto/model-catalog-response.dto.ts`) are a `PickType` of `DialModelDto` over the same list. Core's invocation settings (`defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`) and any future Core field no longer reach users who cannot use the model. That narrows the privacy risk listed above, but does not remove it.
