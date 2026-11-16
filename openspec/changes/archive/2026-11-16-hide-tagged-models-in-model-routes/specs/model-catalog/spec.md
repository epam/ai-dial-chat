# Spec Delta

## ADDED Requirements

### Requirement: Model catalog omits models hidden through HIDDEN_ENTITY_TAGS

`GET /api/v1/model-catalog` SHALL omit every model whose `description_keywords` contains a tag from `HIDDEN_ENTITY_TAGS`, using the same match as `isHidden` on `/api/v1/deployments`. A model whose `description_keywords` is absent or not an array is not hidden. The entry shape and every other catalog rule SHALL stay as they are.

#### Scenario: Hidden model is omitted from the catalog

- **GIVEN** `MODEL_CATALOG_API_KEY` is set, `HIDDEN_ENTITY_TAGS=HIDDEN`, and the key sees `gpt-4o` with `description_keywords: ["HIDDEN"]` and `claude-opus` with `description_keywords: ["Text"]`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `200` with `{ "data": [ { "id": "claude-opus", … } ] }`

#### Scenario: Hidden model is omitted even when the user cannot access it

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and the catalog key sees a hidden `gpt-4o` that the signed-in user's roles do not allow
- **WHEN** the user calls `GET /api/v1/model-catalog`
- **THEN** `gpt-4o` is absent from `data`, so no "No access" entry can be shown for it

### Requirement: Model catalog cache holds the filtered list

The hidden-model filter SHALL run before the catalog list is stored in its shared per-instance entry (5-minute TTL, `MODEL_CATALOG_CACHE_TTL_MS`; expiry is the only invalidation). The tags are read at boot, so changing them takes a BFF restart, which empties the entry.

#### Scenario: Shared cache entry holds the filtered list

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o` in the key's model list
- **WHEN** user A and then user B call `GET /api/v1/model-catalog` within 5 minutes
- **THEN** DIAL Core is called once and neither response contains `gpt-4o`

### Requirement: Model catalog detail answers 404 for a model hidden through HIDDEN_ENTITY_TAGS

`GET /api/v1/model-catalog/:modelName` SHALL answer `404 Not Found` for a model omitted from the catalog because of `HIDDEN_ENTITY_TAGS`, with the same body as for a model that is not in the catalog. It SHALL NOT answer `403`, and it SHALL still make no DIAL Core `GET /openai/models/{name}` call.

#### Scenario: Hidden model detail answers 404

- **GIVEN** `MODEL_CATALOG_API_KEY` is set, `HIDDEN_ENTITY_TAGS=HIDDEN`, and the key sees `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF returns `404` and makes no DIAL Core `GET /openai/models/gpt-4o` request

#### Scenario: Model without a hidden tag is returned

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and the cached catalog contains `claude-opus` with `description_keywords: ["Text"]`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/claude-opus`
- **THEN** the BFF returns `200` with the `claude-opus` entry

### Requirement: Model catalog contract is unchanged when no tag is configured

With `HIDDEN_ENTITY_TAGS` unset or empty, both catalog routes SHALL behave exactly as before. The OpenAPI operations `listModelCatalog` and `getModelCatalogEntry`, the request DTO `GetModelDto`, the response DTOs `ModelCatalogListResponseDto` / `ModelCatalogEntryDto` and the `Cache-Control` header SHALL NOT change. No `ENABLED_FEATURES` gate, UI, i18n key or metric is added.

#### Scenario: Empty tag list changes nothing

- **GIVEN** `HIDDEN_ENTITY_TAGS` is unset or empty, and the key sees `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** `gpt-4o` and every other entry with a string `id` are returned, as today
