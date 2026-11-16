# Spec Delta

## ADDED Requirements

### Requirement: Model list omits models hidden through HIDDEN_ENTITY_TAGS

`GET /api/v1/models` SHALL omit every model whose `description_keywords` contains a tag from `HIDDEN_ENTITY_TAGS`. The match SHALL be the exact-string match that sets `isHidden` on `/api/v1/deployments`, so a model is hidden on both routes or on neither. A model whose `description_keywords` is absent or not an array is not hidden. Other entries SHALL stay as Core sends them.

#### Scenario: Hidden model is omitted

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core lists `gpt-4o` with `description_keywords: ["HIDDEN", "Text"]` and `claude-opus` with `description_keywords: ["Text"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** the BFF returns `200` with `{ "data": [ { "id": "claude-opus", … } ] }`, and `claude-opus` is exactly as Core sent it

#### Scenario: Any configured tag hides a model

- **GIVEN** `HIDDEN_ENTITY_TAGS=internal,experimental`, and DIAL Core lists `gpt-4o` with `description_keywords: ["experimental"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** `gpt-4o` is absent from `data`

#### Scenario: Tag match is exact

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core lists `gpt-4o` with `description_keywords: ["hidden", "HIDDEN-ish"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** `gpt-4o` is present in `data`

#### Scenario: Deployments still list the hidden model

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o` that the user can access
- **WHEN** the user calls `GET /api/v1/deployments`
- **THEN** `gpt-4o` is listed with `isHidden: true`

### Requirement: Model list cache holds the filtered list

The hidden-model filter on `GET /api/v1/models` SHALL run before the result is stored under `models:list:<user.sub>` (30-second TTL; expiry is the only invalidation). The tags are read at boot, so changing them takes a BFF restart, which empties the cache.

#### Scenario: Cached list is the filtered list

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o` in DIAL Core's list
- **WHEN** the same user calls `GET /api/v1/models` twice within 30 seconds
- **THEN** DIAL Core is called once and neither response contains `gpt-4o`

### Requirement: Model list contract is unchanged when no tag is configured

With `HIDDEN_ENTITY_TAGS` unset or empty, `GET /api/v1/models` SHALL behave exactly as before. The OpenAPI operation `listModels` (`ModelsApi.listModels()`), the response DTO `DialModelListResponseDto`, the status codes and the `Cache-Control` header SHALL NOT change. The route is not gated by `ENABLED_FEATURES` and adds no UI, i18n key or metric.

#### Scenario: Empty tag list changes nothing

- **GIVEN** `HIDDEN_ENTITY_TAGS` is unset or empty, and DIAL Core lists `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** the BFF returns every model DIAL Core returned, `gpt-4o` included, unchanged
