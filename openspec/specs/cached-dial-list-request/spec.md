# cached-dial-list-request Specification

## Purpose

A shared cache-hit / cache-miss / error-map / cache-set helper for DIAL list requests, adopted without changing existing cache keys, TTLs, or log messages.

## Requirements

### Requirement: Shared cache-hit/cache-miss/error-map/cache-set flow
The system SHALL provide a reusable `withCachedDialRequest` helper implementing: on cache hit, return the cached value without calling DIAL Core; on cache miss, invoke the provided fetch function, map any thrown error via the existing `mapDialHttpStatus`/`handleDialFetchError` from `common/dial/dial-error.mapper.ts`, store the successful result in cache with the configured TTL, and return it.

#### Scenario: Cache hit returns cached value without a DIAL Core call
- **WHEN** `withCachedDialRequest` is called with a `cacheKey` that already has a value in `cacheManager`
- **THEN** the helper returns the cached value and does not invoke the `fetch` function

#### Scenario: Cache miss fetches, caches, and returns
- **WHEN** `withCachedDialRequest` is called with a `cacheKey` that has no cached value
- **THEN** the helper invokes `fetch`, stores the resolved value in `cacheManager` under `cacheKey` with the configured `ttlMs` (defaulting to 30000ms if not provided), and returns the resolved value

#### Scenario: Fetch error is mapped, not swallowed or re-invented
- **WHEN** the `fetch` function passed to `withCachedDialRequest` throws a DIAL SDK or HTTP error
- **THEN** the helper delegates to the existing `mapDialHttpStatus`/`handleDialFetchError` mapping (using the provided `context`) and propagates the resulting NestJS exception; no value is written to cache

### Requirement: Helper adoption preserves existing cache keys, TTLs, and log messages
Migrating a service's list/single-read method to `withCachedDialRequest` SHALL preserve that method's existing cache key format, TTL value, and observable behavior (including debug log occurrence on cache hit where the original implementation logged one).

#### Scenario: ModelsService.listModels cache key unchanged
- **WHEN** `ModelsService.listModels` is migrated to use `withCachedDialRequest`
- **THEN** the cache key remains `models:list:${userSub}` and the TTL remains the value used before migration

#### Scenario: Complex cache shapes are not forced into the helper
- **WHEN** a service's caching logic includes a secondary fallback cache-key read (`DeploymentsService.listDeployments`) or post-cache enrichment that must run identically on both cache hit and cache miss (`ToolsetsService.listToolsets`/`getToolset`)
- **THEN** that service MAY keep its existing hand-written caching logic instead of adopting `withCachedDialRequest`, provided its observable cache-key, TTL, and enrichment behavior is unchanged from before this change
