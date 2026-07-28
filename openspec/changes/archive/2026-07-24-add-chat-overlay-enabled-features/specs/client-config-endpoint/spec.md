## ADDED Requirements

### Requirement: client-config exposes enabledUiFeatures

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `enabledUiFeatures: string[] | null` (sourced from `EnvironmentVariables.ENABLED_UI_FEATURES`, filtered to recognized `OverlayFeature` values per `config-registry-and-env-provider`, default `null`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `enabledUiFeatures: string[] | null` with `nullable: true` so the generated `@epam/chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `enabledUiFeatures: string[] | null`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: No baseline configured — null returned

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `ENABLED_UI_FEATURES` is unset
- **THEN** the response includes `config.enabledUiFeatures: null`

#### Scenario: Baseline configured — array returned

- **WHEN** `ENABLED_UI_FEATURES=header,likes,hide-new-conversation` is set
- **THEN** the response includes `config.enabledUiFeatures: ["header", "likes", "hide-new-conversation"]`

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `enabledUiFeatures: string[] | null`

#### Scenario: Response never includes unrecognized entries

- **WHEN** `ENABLED_UI_FEATURES` includes a value that is not a member of `OverlayFeature`
- **THEN** the response's `config.enabledUiFeatures` array omits that value (filtered per `config-registry-and-env-provider`)

#### Scenario: All-unrecognized input returns null, not empty array

- **WHEN** `ENABLED_UI_FEATURES` contains only values not in `OverlayFeature`
- **THEN** `config.enabledUiFeatures` is `null` — the empty-set footgun (which would disable the entire UI) is prevented
