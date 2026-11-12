## ADDED Requirements

### Requirement: client-config exposes model catalog availability

`GET /api/v1/client-config` SHALL include `config.modelCatalogAvailable: boolean`. It is `true` when `MODEL_CATALOG_API_KEY` is configured (non-blank after trimming) and `false` otherwise. A frontend can then decide whether to call `GET /api/v1/model-catalog` without probing it (see the `model-catalog` capability).

- `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`) SHALL assemble the field itself from `ConfigService`, as it does `aiTextRefinementAvailable`. The field is not a config-registry key and has no entry in the mapping module (`apps/chat-api/src/app-config/client-config.mapper.ts`). `MappedClientConfig` SHALL omit it, and the mapper spec's list of service-assembled fields SHALL include it.
- The service SHALL decide availability with the same key-resolution helper as the catalog service, so the flag and the route can never disagree.
- The field SHALL be emitted on every response. It SHALL be appended after `catalogCreationPermissions`, so every existing field keeps its position.
- `ClientConfigDto` SHALL declare it with `@ApiPropertyOptional({ type: Boolean })` and a description stating that a missing value means unavailable, so a client generated against this BFF tolerates an older BFF. The generated `ClientConfigDto` type in `@epam/ai-dial-chat-api-client` gains `modelCatalogAvailable?: boolean`. No frontend caller in `apps/chat` reads it.
- The value SHALL NOT vary by user, role or `appId`, and SHALL never carry the key. It is cached as part of the existing client-config entry (60-second TTL, unchanged key). The key is read at boot, so no invalidation is needed.
- No i18n string, UI, RTL impact or feature gate is introduced.

#### Scenario: Key configured

- **GIVEN** `MODEL_CATALOG_API_KEY=catalog-key`
- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called
- **THEN** `response.config.modelCatalogAvailable` is `true` and no field of the response contains `catalog-key`

#### Scenario: Key unset or blank

- **GIVEN** `MODEL_CATALOG_API_KEY` is unset, or is `"  "`
- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called
- **THEN** `response.config.modelCatalogAvailable` is `false`

#### Scenario: Field order keeps existing positions

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called with all providers returning `undefined`
- **THEN** `Object.keys(response.config)` equals the previous list with `modelCatalogAvailable` appended after `catalogCreationPermissions`

#### Scenario: DIAL_API_KEY does not affect the flag

- **GIVEN** `DIAL_API_KEY` is set and `MODEL_CATALOG_API_KEY` is unset
- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called
- **THEN** `response.config.modelCatalogAvailable` is `false`
