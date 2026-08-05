## ADDED Requirements

### Requirement: client-config exposes publicationFilterSources

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `publicationFilterSources: string[]` (sourced from `EnvironmentVariables.PUBLICATION_FILTER_SOURCES` via the `publish.publicationFilterSources` registry entry, default `['title', 'role', 'dial_roles']`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `publicationFilterSources: string[]` so the generated `@epam/chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `publicationFilterSources: string[]`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None — values are raw claim/category strings, not localized copy.

#### Scenario: Default sources returned when unconfigured
- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `PUBLICATION_FILTER_SOURCES` is unset
- **THEN** the response includes `config.publicationFilterSources: ["title", "role", "dial_roles"]`

#### Scenario: Operator-configured sources are returned
- **WHEN** `PUBLICATION_FILTER_SOURCES=roles,department` is set
- **THEN** the response includes `config.publicationFilterSources: ["roles", "department"]`

#### Scenario: Generated client type includes the new field
- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `publicationFilterSources: string[]`

### Requirement: Frontend AppConfigContext exposes publicationFilterSources with a safe default

`AppConfigContext.tsx`'s `AppConfigState.config` SHALL gain `publicationFilterSources: string[]`, initialized in `INITIAL_STATE` and on fetch failure to a new `DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles']` constant (mirroring `DEFAULT_FILE_MANAGER_TABS`'s existing pattern), and populated in `loadConfig` from `response.config?.publicationFilterSources ?? DEFAULT_PUBLICATION_FILTER_SOURCES`. Consumers (`PublishConversationPanelContainer`, `CatalogView`) SHALL read this value via `useAppConfig().config.publicationFilterSources` to populate `ruleSourceOptions`, rather than hardcoding a list.

#### Scenario: Source list is available before the panel opens
- **WHEN** `AppConfigProvider` has resolved its initial fetch
- **THEN** `useAppConfig().config.publicationFilterSources` reflects the value returned by `GET /api/v1/client-config`

#### Scenario: Config fetch failure still yields a usable default
- **WHEN** `getClientConfig` rejects (network error)
- **THEN** `useAppConfig().config.publicationFilterSources` remains `DEFAULT_PUBLICATION_FILTER_SOURCES`, so the access-rules source picker is never left with zero options
