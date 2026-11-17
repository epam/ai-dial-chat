# Spec Delta

## ADDED Requirements

### Requirement: Model lookup answers 404 for a model hidden through HIDDEN_ENTITY_TAGS

`GET /api/v1/models/:modelName` SHALL answer `404 Not Found` when the model Core returns has a `description_keywords` tag listed in `HIDDEN_ENTITY_TAGS`, using the same match as `isHidden` on `/api/v1/deployments`. The body SHALL match the one for a model Core does not know. Hiding SHALL never produce `403`. Core's own `401`/`403`/`429`/`5xx` keep their mapping.

#### Scenario: Hidden model answers 404

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core returns `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user who can access `gpt-4o` calls `GET /api/v1/models/gpt-4o`
- **THEN** the BFF returns `404 Not Found`, not `403` and not the model

#### Scenario: Model without a hidden tag is returned

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core returns `claude-opus` with `description_keywords: ["Text"]`
- **WHEN** a signed-in user calls `GET /api/v1/models/claude-opus`
- **THEN** the BFF returns `200` with the model as Core sent it

#### Scenario: Core's own 403 is unchanged

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`
- **WHEN** DIAL Core answers `403` for `GET /openai/models/gpt-4o`
- **THEN** the BFF returns `403`, as it does today

### Requirement: Hidden model lookups are answered from the cache

The `models:single:<user.sub>:<modelName>` entry (60-second TTL; expiry is the only invalidation) SHALL keep Core's answer, and the hidden check SHALL run on every response, cache hits included, so a repeated lookup of a hidden model does not call Core again within the TTL.

#### Scenario: Repeated lookup of a hidden model is served from cache

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o`
- **WHEN** the same user calls `GET /api/v1/models/gpt-4o` twice within 60 seconds
- **THEN** both calls return `404` and DIAL Core is called once

### Requirement: Model lookup contract is unchanged when no tag is configured

With `HIDDEN_ENTITY_TAGS` unset or empty, `GET /api/v1/models/:modelName` SHALL behave exactly as before. The OpenAPI operation `getModel` (`ModelsApi.getModel({ modelName })`), request DTO `GetModelDto`, response DTO `DialModelDto` and `Cache-Control` header SHALL NOT change. The route is not gated by `ENABLED_FEATURES` and adds no UI, i18n key or metric.

#### Scenario: Empty tag list changes nothing

- **GIVEN** `HIDDEN_ENTITY_TAGS` is unset or empty, and DIAL Core returns `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/models/gpt-4o`
- **THEN** the BFF returns `200` with the model
