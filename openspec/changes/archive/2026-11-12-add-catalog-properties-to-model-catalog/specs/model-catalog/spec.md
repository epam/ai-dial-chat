## MODIFIED Requirements

### Requirement: Session-protected model catalog list endpoint

The BFF SHALL expose `GET /api/v1/model-catalog`. A `ModelCatalogController` (`@Controller({ path: 'model-catalog', version: '1' })`, `@ApiTags('models')`) SHALL be registered in `ModelsModule` (`apps/chat-api/src/models/models.module.ts`). The route lists the DIAL Core models visible to `MODEL_CATALOG_API_KEY`'s roles, for display to any signed-in user.

The endpoint:

- MUST require a valid BFF session (the global `SessionGuard`, with no `@Public()`). An unauthenticated request SHALL be rejected with `401` before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured, without calling DIAL Core
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models` through the `@epam/ai-dial-typescript-sdk` client's `getModels` (`DialClientService`), sending `Api-Key: <MODEL_CATALOG_API_KEY>` and never the session's bearer token
- SHALL return `200 OK` with `{ "data": ModelCatalogEntryDto[] }` (`ModelCatalogListResponseDto` in `apps/chat-api/src/models/dto/model-catalog-response.dto.ts`). Each entry SHALL carry only the display fields listed in `MODEL_CATALOG_ENTRY_FIELDS`, copied from Core's entry, plus `catalog_properties` as described below. Core's invocation settings (`defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`), `catalog_schema_id`, and any field the list does not name SHALL be dropped, because the catalog shows models the caller cannot use. `ModelCatalogEntryDto` is a `PickType` of `DialModelDto` over the same list, so the Swagger schema and the runtime projection of the copied fields cannot drift. Core entries that are not objects or have no string `id` SHALL be dropped with a `warn` log. It SHALL NOT add per-user fields (for example an `accessible` flag), filter by the caller's roles, or merge in the caller's own model list
- SHALL reduce Core's `catalog_properties` with `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), the allowlist that `deployment-details-api` already uses, and return the result as `catalog_properties` typed `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`). Only `provider`, `vendor`, `license`, `knowledgeCutoffDate` and `parameters` with string values SHALL be kept. Unknown keys and non-string values SHALL be dropped. `catalog_properties` SHALL be omitted when Core sends none, sends a value that is not an object, or sends no recognised string key. `catalog_properties` is not a member of `MODEL_CATALOG_ENTRY_FIELDS`. `ModelCatalogEntryDto` declares it on its own as `@ApiPropertyOptional({ type: () => ModelCatalogPropertiesDto })`
- MUST set `Cache-Control: private, max-age=300` on a `200` response
- SHALL have the OpenAPI `operationId` `listModelCatalog`. The generated SDK method is `ModelsApi.listModelCatalog()`, there is no request DTO, and the response DTO is `ModelCatalogListResponseDto`. Its generated `ModelCatalogEntryDto` SHALL include `catalogProperties?: ModelCatalogPropertiesDto` (the generated client camelCases property names; the wire name is `catalog_properties`)

`DialModelDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) SHALL declare `catalog_properties` as an optional free-form object (`type: 'object', additionalProperties: true`), so `PickType` can name it and the `GET /api/v1/models` schema documents what that route already forwards. The runtime body of `GET /api/v1/models` SHALL NOT change.

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
      "catalog_properties": {
        "provider": "Azure",
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
- **THEN** the `gpt-4o` entry carries `catalog_properties: { "provider": "Azure", "vendor": "OpenAI", "knowledgeCutoffDate": "2023-10-01" }`, with no `license` and no `internalNote`

#### Scenario: Entry without catalog properties omits the field

- **GIVEN** DIAL Core returns `gpt-4o` with no `catalog_properties`, and `claude-opus` with `catalog_properties: { "internalNote": "x" }`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** neither entry has a `catalog_properties` key

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
- **THEN** the BFF still proxies with the session's bearer token, uses cache key `models:list:<user.sub>` with a 30-second TTL, and returns only the models the user's roles allow, each with the `catalog_properties` Core sent, unfiltered

---

### Requirement: Model catalog detail endpoint reads from the cached list

The BFF SHALL expose `GET /api/v1/model-catalog/:modelName` on `ModelCatalogController`. It returns the single catalog entry whose `id` equals `modelName`, resolved from the same cached list (and the same in-flight fetch) as `GET /api/v1/model-catalog`. It MUST NOT call DIAL Core `GET /openai/models/{model_name}`.

The endpoint:

- MUST require a valid BFF session, as the list route does
- MUST validate `modelName` with `GetModelDto` (`apps/chat-api/src/models/dto/get-model.dto.ts`) and return `400 Bad Request` for a name that fails its allowlist `@Matches`, before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured
- SHALL return `404 Not Found` when no catalog entry has `id === modelName`. That includes a model that exists in Core but is hidden from the key's roles
- SHALL return `200 OK` with the cached entry (`ModelCatalogEntryDto`), already reduced to its display fields, including the allowlisted `catalog_properties` when present
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
  "catalog_properties": { "provider": "Azure", "vendor": "OpenAI" }
}
```

#### Scenario: Model present in the catalog

- **GIVEN** the cached catalog contains `gpt-4o`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF returns `200` with the `gpt-4o` entry and makes no DIAL Core request

#### Scenario: Detail entry carries catalog properties

- **GIVEN** DIAL Core returned `gpt-4o` with `catalog_properties: { "provider": "Azure", "internalNote": "x" }` when the catalog was cached
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the entry carries `catalog_properties: { "provider": "Azure" }`

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
