# model-catalog Specification

## Purpose

The session-protected model catalog: `GET /api/v1/model-catalog` and `GET /api/v1/model-catalog/:modelName` list the DIAL Core models visible to the server-side `MODEL_CATALOG_API_KEY`, so a frontend can show a deployment's whole model catalog and mark the models the signed-in user cannot use. The catalog is display data only. `model-listing` and `model-lookup` still decide what a user can use.

## Requirements

### Requirement: Model catalog API key is an optional server-only secret

`apps/chat-api` SHALL declare `MODEL_CATALOG_API_KEY` as an optional string on `DialEnv` (`apps/chat-api/src/config/env/dial.env.ts`). The key SHALL be read only through `ConfigService<EnvironmentVariables>`. A value that is unset, empty or whitespace-only SHALL count as not configured. A configured value SHALL be trimmed before use.

The key:

- MUST be sent to DIAL Core only as the `Api-Key` request header (`getApiKeyAuthHeaders` in `apps/chat-api/src/common/utils/auth-header.ts`), and only on the catalog's upstream `GET /openai/models` call
- MUST NOT appear in any HTTP response body or header, in any log line (including error bodies and debug cache logs), or in the client-config response, except as the derived boolean `modelCatalogAvailable`
- MUST be independent of `DIAL_API_KEY`. Setting, unsetting or rotating either key SHALL NOT change the behaviour that depends on the other. Conversation naming keeps using `DIAL_API_KEY` only, and the catalog never falls back to `DIAL_API_KEY`

The variable SHALL be documented in `apps/chat-api/README.md` and `apps/chat-api/.env.template`. The documentation SHALL state that the key's Core role must be added to the `userRoles` of every restricted model meant to appear in the catalog, that Core has no list-only permission so the role should carry minimal limits, and that the key must be stored as a deployment secret.

This capability is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. The presence of the key is the only switch.

#### Scenario: Blank key counts as not configured

- **GIVEN** `MODEL_CATALOG_API_KEY="   "`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `404` and makes no DIAL Core request

#### Scenario: Key is trimmed before it is sent

- **GIVEN** `MODEL_CATALOG_API_KEY=" catalog-key "`
- **WHEN** the catalog cache is cold and a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** DIAL Core receives `Api-Key: catalog-key` and no `Authorization` header

#### Scenario: DIAL_API_KEY is never used for the catalog

- **GIVEN** `DIAL_API_KEY` is set and `MODEL_CATALOG_API_KEY` is unset
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `404` and no DIAL Core request carries `DIAL_API_KEY`

#### Scenario: The key never reaches a log line

- **WHEN** DIAL Core answers the catalog request with any non-2xx status, or the request fails without a response
- **THEN** no log line written during the request contains the key value

---

### Requirement: Session-protected model catalog list endpoint

The BFF SHALL expose `GET /api/v1/model-catalog`. A `ModelCatalogController` (`@Controller({ path: 'model-catalog', version: '1' })`, `@ApiTags('models')`) SHALL be registered in `ModelsModule` (`apps/chat-api/src/models/models.module.ts`). The route lists the DIAL Core models visible to `MODEL_CATALOG_API_KEY`'s roles, for display to any signed-in user.

The endpoint:

- MUST require a valid BFF session (the global `SessionGuard`, with no `@Public()`). An unauthenticated request SHALL be rejected with `401` before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured, without calling DIAL Core
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models` through the `@epam/ai-dial-typescript-sdk` client's `getModels` (`DialClientService`), sending `Api-Key: <MODEL_CATALOG_API_KEY>` and never the session's bearer token
- SHALL return `200 OK` with `{ "data": ModelCatalogEntryDto[] }` (`ModelCatalogListResponseDto` in `apps/chat-api/src/models/dto/model-catalog-response.dto.ts`). Each entry SHALL carry only the display fields listed in `MODEL_CATALOG_ENTRY_FIELDS`, copied from Core's entry, plus `catalog_properties` as described below. Core's invocation settings (`defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`), `catalog_schema_id`, and any field the list does not name SHALL be dropped, because the catalog shows models the caller cannot use. `ModelCatalogEntryDto` is a `PickType` of `DialModelDto` over the same list, so the Swagger schema and the runtime projection of the copied fields cannot drift. Core entries that are not objects or have no string `id` SHALL be dropped with a `warn` log. It SHALL NOT add per-user fields (for example an `accessible` flag), filter by the caller's roles, or merge in the caller's own model list
- SHALL copy Core's top-level `provider`, `deprecation_date` and `end_of_service` as Core sends them. All three are members of `MODEL_CATALOG_ENTRY_FIELDS`, and each SHALL be absent from an entry whose Core model does not carry it. The BFF SHALL NOT parse, validate or default them: `provider` is free-form text and the two dates are documented by Core as `YYYY-MM-DD`, but Core does not validate them. They are display data, so they fit the catalog's display-only rule
- SHALL reduce Core's `catalog_properties` with `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), the allowlist that `deployment-details-api` already uses, and return the result as `catalog_properties` typed `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`). Only `vendor`, `license`, `knowledgeCutoffDate` and `parameters` with string values SHALL be kept. `catalog_properties.provider` is not part of the allowlist: the top-level `provider` is the model's provider. Unknown keys and non-string values SHALL be dropped. `catalog_properties` SHALL be omitted when Core sends none, sends a value that is not an object, or sends no recognised string key (a `provider`-only object counts as none). `catalog_properties` is not a member of `MODEL_CATALOG_ENTRY_FIELDS`. `ModelCatalogEntryDto` declares it on its own as `@ApiPropertyOptional({ type: () => ModelCatalogPropertiesDto })`
- MUST set `Cache-Control: private, max-age=300` on a `200` response
- SHALL have the OpenAPI `operationId` `listModelCatalog`. The generated SDK method is `ModelsApi.listModelCatalog()`, there is no request DTO, and the response DTO is `ModelCatalogListResponseDto`. Its generated `ModelCatalogEntryDto` SHALL include `provider?: string`, `deprecationDate?: string`, `endOfService?: string` and `catalogProperties?: ModelCatalogPropertiesDto`, whose generated type has no `provider` (the generated client camelCases property names; the wire names are `provider`, `deprecation_date`, `end_of_service` and `catalog_properties`)

`DialModelDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) SHALL declare `catalog_properties` as an optional free-form object (`type: 'object', additionalProperties: true`), and `provider`, `deprecation_date` and `end_of_service` as optional strings with `@ApiPropertyOptional` descriptions and examples (`'Azure'`, `'2026-12-31'`, `'2027-03-31'`), so `PickType` can name them and the `GET /api/v1/models` schema documents what that route already forwards. The runtime body of `GET /api/v1/models` SHALL NOT change: it keeps forwarding Core's model objects as sent, including any `catalog_properties.provider`.

Example:

```http
GET /api/v1/model-catalog HTTP/1.1
Cookie: <session cookie>
```

```json
{
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "display_name": "GPT-4o",
      "description": "Restricted to the research role",
      "pricing": { "unit": "token", "prompt": "0.000005", "completion": "0.000015" },
      "provider": "Azure",
      "deprecation_date": "2026-12-31",
      "end_of_service": "2027-03-31",
      "catalog_properties": {
        "vendor": "OpenAI",
        "knowledgeCutoffDate": "2023-10-01"
      }
    }
  ]
}
```

#### Scenario: Signed-in user sees models they cannot access

- **GIVEN** `MODEL_CATALOG_API_KEY` is set, its role can see `gpt-4o` and `claude-opus`, and the signed-in user's roles allow only `claude-opus`
- **WHEN** the user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `200` with both `gpt-4o` and `claude-opus` in `data`, each reduced to its display fields

#### Scenario: Invocation settings are not exposed

- **GIVEN** DIAL Core returns `gpt-4o` with `defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`, `catalog_schema_id` and a field the BFF does not know
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries its display fields and none of those six

#### Scenario: Catalog properties are allowlisted

- **GIVEN** DIAL Core returns `gpt-4o` with `catalog_properties: { "provider": "Azure", "vendor": "OpenAI", "knowledgeCutoffDate": "2023-10-01", "license": { "name": "MIT" }, "internalNote": "x" }`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries `catalog_properties: { "vendor": "OpenAI", "knowledgeCutoffDate": "2023-10-01" }`, with no `provider`, no `license` and no `internalNote`

#### Scenario: Entry without catalog properties omits the field

- **GIVEN** DIAL Core returns `gpt-4o` with no `catalog_properties`, `claude-opus` with `catalog_properties: { "internalNote": "x" }`, and `gemini-pro` with `catalog_properties: { "provider": "Google" }`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** none of the three entries has a `catalog_properties` key

#### Scenario: Provider and lifecycle dates are copied as Core sends them

- **GIVEN** DIAL Core returns `gpt-4o` with `provider: "Azure"`, `deprecation_date: "Q4 2026"` and `end_of_service: "2027-03-31"`, and `claude-opus` with none of the three
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries the three values unchanged, including the non-ISO `deprecation_date`
- **AND** the `claude-opus` entry has no `provider`, `deprecation_date` or `end_of_service` key

#### Scenario: Unauthenticated request is rejected

- **WHEN** `GET /api/v1/model-catalog` is called without a session cookie
- **THEN** the BFF returns `401` and makes no DIAL Core request

#### Scenario: Key not configured

- **GIVEN** `MODEL_CATALOG_API_KEY` is unset
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `404` and makes no DIAL Core request

#### Scenario: Existing user-scoped list is unchanged

- **GIVEN** `MODEL_CATALOG_API_KEY` is set
- **WHEN** the same user calls `GET /api/v1/models`
- **THEN** the BFF still proxies with the session's bearer token, uses cache key `models:list:<user.sub>` with a 30-second TTL, and returns only the models the user's roles allow, each with the `catalog_properties` Core sent, unfiltered, and with `provider`, `deprecation_date` and `end_of_service` when Core sent them

---

### Requirement: Model catalog is cached once per BFF instance with a shared in-flight request

The catalog list SHALL be cached as one in-memory entry held by `ModelCatalogService` itself, shared by every user, with a TTL of **5 minutes** (`300000` ms, `MODEL_CATALOG_CACHE_TTL_MS`). It SHALL NOT use the shared `CACHE_MANAGER`: that store is a 100-entry LRU (`apps/chat-api/src/app/cache.config.ts`), so per-user entries could evict the catalog before its TTL, as `ImmutableResourceStore` avoids for celebration assets. The cache is per BFF instance and is not shared across instances. A cache hit MUST NOT call DIAL Core.

While a catalog fetch is in flight, every other request that misses the cache SHALL await that same fetch instead of starting a new Core request, and SHALL receive the same result or the same mapped error. The in-flight handle SHALL be cleared when the fetch settles, whether it succeeds or fails. Failed fetches SHALL NOT be cached. A later request after a failure starts a new fetch.

Invalidation is by TTL only. No event invalidates the entry. Changing or removing `MODEL_CATALOG_API_KEY` requires a BFF restart, because env values are read at boot. After the restart the cache is empty.

#### Scenario: All users share one cache entry

- **GIVEN** a warm catalog cache populated by user A
- **WHEN** user B calls `GET /api/v1/model-catalog` within 5 minutes
- **THEN** user B receives the cached list and DIAL Core is not called

#### Scenario: Concurrent cold-cache requests share one Core call

- **GIVEN** an empty catalog cache
- **WHEN** ten signed-in users call `GET /api/v1/model-catalog` concurrently
- **THEN** DIAL Core receives exactly one `GET /openai/models` request and all ten responses carry the same body

#### Scenario: Concurrent requests during a Core outage share one failure

- **GIVEN** an empty catalog cache and DIAL Core unreachable
- **WHEN** several signed-in users call `GET /api/v1/model-catalog` concurrently
- **THEN** DIAL Core is attempted once, every caller receives `503`, and nothing is cached

#### Scenario: The entry expires after the TTL

- **WHEN** `GET /api/v1/model-catalog` is called, and called again more than 5 minutes later
- **THEN** DIAL Core is called once for each request

---

### Requirement: Model catalog detail endpoint reads from the cached list

The BFF SHALL expose `GET /api/v1/model-catalog/:modelName` on `ModelCatalogController`. It returns the single catalog entry whose `id` equals `modelName`, resolved from the same cached list (and the same in-flight fetch) as `GET /api/v1/model-catalog`. It MUST NOT call DIAL Core `GET /openai/models/{model_name}`.

The endpoint:

- MUST require a valid BFF session, as the list route does
- MUST validate `modelName` with `GetModelDto` (`apps/chat-api/src/models/dto/get-model.dto.ts`) and return `400 Bad Request` for a name that fails its allowlist `@Matches`, before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured
- SHALL return `404 Not Found` when no catalog entry has `id === modelName`. That includes a model that exists in Core but is hidden from the key's roles
- SHALL return `200 OK` with the cached entry (`ModelCatalogEntryDto`), already reduced to its display fields, including `provider`, `deprecation_date`, `end_of_service` and the allowlisted `catalog_properties` when present
- MUST set `Cache-Control: private, max-age=300` on a `200` response
- SHALL return the list route's errors unchanged when the underlying catalog fetch fails
- SHALL have the OpenAPI `operationId` `getModelCatalogEntry`. The generated SDK method is `ModelsApi.getModelCatalogEntry({ modelName })`, the request DTO is the `GetModelDto` path parameter, and the response DTO is `ModelCatalogEntryDto`

Example:

```http
GET /api/v1/model-catalog/gpt-4o HTTP/1.1
Cookie: <session cookie>
```

```json
{
  "id": "gpt-4o",
  "object": "model",
  "display_name": "GPT-4o",
  "provider": "Azure",
  "end_of_service": "2027-03-31",
  "catalog_properties": { "vendor": "OpenAI" }
}
```

#### Scenario: Model present in the catalog

- **GIVEN** the cached catalog contains `gpt-4o`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF returns `200` with the `gpt-4o` entry and makes no DIAL Core request

#### Scenario: Detail entry carries provider, lifecycle dates and catalog properties

- **GIVEN** DIAL Core returned `gpt-4o` with `provider: "Azure"`, `end_of_service: "2027-03-31"` and `catalog_properties: { "provider": "Legacy", "vendor": "OpenAI", "internalNote": "x" }` when the catalog was cached
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the entry carries `provider: "Azure"`, `end_of_service: "2027-03-31"` and `catalog_properties: { "vendor": "OpenAI" }`

#### Scenario: Model not in the catalog

- **GIVEN** the catalog does not contain `secret-model`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/secret-model`
- **THEN** the BFF returns `404`, whether or not `secret-model` exists in DIAL Core

#### Scenario: Invalid model name

- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/bad%2Fname`
- **THEN** the BFF returns `400` and makes no DIAL Core request

#### Scenario: Cold cache fetches the list once

- **GIVEN** an empty catalog cache
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF fetches `GET /openai/models` once with the catalog key, caches the list, and answers from it

---

### Requirement: Catalog errors never sign the user out

Catalog upstream failures SHALL be mapped with the same helpers as `ModelsService` (`mapDialHttpStatus` and `handleDialFetchError` in `apps/chat-api/src/common/dial/dial-error.mapper.ts`), with one exception: a DIAL Core `401` or `403` for the catalog key SHALL produce `503 Service Unavailable`, because it means the server's key is invalid, revoked or under-privileged. The catalog routes SHALL NOT return `401` or `403` for any upstream outcome. A `401` from these routes only ever means the BFF session is missing or expired.

| Upstream outcome                         | BFF status |
| ---------------------------------------- | ---------- |
| `401` / `403`                            | `503`      |
| `404`                                    | `404`      |
| `429`                                    | `429`      |
| other mapped `4xx` (`400`, `409`, …)     | as mapped  |
| `5xx`                                    | `502`      |
| `200` whose body has no `data` array     | `502`      |
| network error / timeout (no response)    | `503`      |

For a `401`/`403`, the service SHALL log at `error` level a message that names the upstream status and says the catalog key was rejected, never the key itself. Each declared status SHALL be documented in Swagger. `@ApiDialCoreErrors({ exclude: [HttpStatus.FORBIDDEN] })` sits above explicit `@ApiResponse` entries for `401` (session only), `404` (key not configured, or model not in catalog) and `503` (key rejected, or Core unreachable).

#### Scenario: Revoked key does not sign the user out

- **GIVEN** an empty catalog cache and DIAL Core answering `401` for the catalog key
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `503`, the session cookie is not cleared, and nothing is cached

#### Scenario: Under-privileged key

- **WHEN** DIAL Core answers `403` for the catalog key
- **THEN** the BFF returns `503`

#### Scenario: Core rate-limits the key

- **WHEN** DIAL Core answers `429`
- **THEN** the BFF returns `429`

#### Scenario: Core server error

- **WHEN** DIAL Core answers `500`
- **THEN** the BFF returns `502`

#### Scenario: Core returns a malformed body

- **GIVEN** an empty catalog cache
- **WHEN** DIAL Core answers `200` with a body that has no `data` array
- **THEN** the BFF returns `502`, logs an `error`, and caches nothing, so the next request calls Core again

#### Scenario: Core unreachable

- **WHEN** the catalog request fails without an HTTP response
- **THEN** the BFF returns `503`

---

### Requirement: Model catalog has no UI, strings or telemetry of its own

This capability SHALL add no frontend caller in `apps/chat`, no React context or hook, no i18n key, no UI (so no RTL or accessibility impact), no memoisation requirement and no new metric or analytics event. The only observability is the domain logger. It writes `debug` on a cache hit and `warn`/`error` on upstream failures, and it never includes the key. Request timing and HTTP metrics come from the existing global interceptors. The routes are consumed by a frontend outside this repository through the generated `@epam/ai-dial-chat-api-client`. No hand-authored `libs/*` is involved.

#### Scenario: Cache hit is logged without the key

- **WHEN** `GET /api/v1/model-catalog` is served from cache
- **THEN** the domain logger writes one `debug` line naming the catalog cache hit and no line containing the key value
