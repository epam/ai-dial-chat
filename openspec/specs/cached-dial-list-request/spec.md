# cached-dial-list-request Specification

## Purpose

A shared cache-hit / cache-miss / error-map / cache-set helper for DIAL list requests, adopted without changing existing cache keys, TTLs, or log messages.

## Requirements

### Requirement: Shared cache-hit/cache-miss/error-map/cache-set flow
The system SHALL provide a reusable `withCachedDialRequest` helper in `apps/chat-api/src/dial/cached-dial-request.helper.ts` implementing: on cache hit, log a debug line and return the cached value without calling DIAL Core; on cache miss, invoke the provided `fetch`, optionally pass its result through a `transform` before storing, store that value in cache with the configured TTL, and return it. A thrown error SHALL be routed through `handleDialFetchError` from `common/dial/dial-error.mapper.ts`.

Options:

| Option | Required | Behaviour |
|---|---|---|
| `cacheManager`, `cacheKey` | yes | Where and under what key the value is read and written |
| `ttlMs` | no | Cache TTL; defaults to `30_000` |
| `context`, `logger` | yes | Used for the cache-hit debug line and for error mapping |
| `fetch` | yes | Called only on a miss |
| `transform` | no | Applied to the fetched value **before** it is cached, so the cached shape matches the returned one |

The division of labour with the error mapper is deliberate: a **non-OK upstream response** is the caller's concern — its `fetch` calls `mapDialHttpStatus`, which throws the matching Nest exception — while a **thrown transport failure** is the helper's, mapped by `handleDialFetchError`. Because `handleDialFetchError` re-throws an `HttpException` untouched, an exception the caller already mapped passes through unchanged.

A cached value is detected with a truthiness check, so a legitimately falsy cached value (`0`, `''`, `false`) reads as a miss and is re-fetched. The helper is therefore only appropriate for object- and array-shaped results, which is what every DIAL list/read response is.

#### Scenario: Cache hit returns cached value without a DIAL Core call
- **WHEN** `withCachedDialRequest` is called with a `cacheKey` that already has a value in `cacheManager`
- **THEN** the helper logs a debug line naming the context and key, returns the cached value, and does not invoke the `fetch` function

#### Scenario: Cache miss fetches, caches, and returns
- **WHEN** `withCachedDialRequest` is called with a `cacheKey` that has no cached value
- **THEN** the helper invokes `fetch`, stores the resolved value in `cacheManager` under `cacheKey` with the configured `ttlMs` (defaulting to 30000ms if not provided), and returns the resolved value

#### Scenario: A transform is applied before caching
- **WHEN** a `transform` is supplied
- **THEN** the transformed value is what gets cached and returned, so a later cache hit yields the same shape as the original miss

#### Scenario: Fetch error is mapped, not swallowed or re-invented
- **WHEN** the `fetch` function passed to `withCachedDialRequest` throws a transport error
- **THEN** the helper delegates to `handleDialFetchError` (using the provided `context`) and propagates the resulting NestJS exception; no value is written to cache

#### Scenario: An exception the caller already mapped is not re-mapped
- **WHEN** the `fetch` function itself throws by calling `mapDialHttpStatus` on a non-OK upstream response
- **THEN** that exception propagates unchanged, keeping the status the shared mapper chose

### Requirement: Helper adoption preserves existing cache keys, TTLs, and log messages
Migrating a service's list/single-read method to `withCachedDialRequest` SHALL preserve that method's existing cache key format, TTL value, and observable behavior (including debug log occurrence on cache hit where the original implementation logged one).

#### Scenario: ModelsService.listModels cache key unchanged
- **WHEN** `ModelsService.listModels` is migrated to use `withCachedDialRequest`
- **THEN** the cache key remains `models:list:${userSub}` and the TTL remains the value used before migration

#### Scenario: Complex cache shapes are not forced into the helper
- **WHEN** a service's caching logic includes a secondary fallback cache-key read (`DeploymentsListingService`) or post-cache enrichment that must run identically on both cache hit and cache miss (`ToolsetsListingService`)
- **THEN** that service MAY keep its existing hand-written caching logic instead of adopting `withCachedDialRequest`, provided its observable cache-key, TTL, and enrichment behavior is unchanged from before this change

#### Scenario: The helper is the default for straightforward reads
- **WHEN** a service caches a DIAL list or single-read response with one key, one TTL, and no cross-cutting enrichment
- **THEN** it SHALL use `withCachedDialRequest` — as models, applications, application schemas, publish, conversation publish, scheduled tasks, and the MCP app service do — rather than repeating the read-through by hand
