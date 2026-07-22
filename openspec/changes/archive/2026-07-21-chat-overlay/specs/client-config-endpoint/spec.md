## ADDED Requirements

### Requirement: client-config exposes overlay eligibility

`GET /api/v1/client-config` SHALL include two additional `visibility='client'` keys under `config`: `overlayEnabled: boolean` (sourced from `EnvironmentVariables.OVERLAY_ENABLED`, default `false`) and `overlayAllowedOrigins: string[]` (sourced from `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS`, default `[]`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), rate limit (60/min/IP), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add `@ApiProperty` fields for both keys so the generated `@epam/chat-api-client` types them concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Overlay disabled by default

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `OVERLAY_ENABLED` is unset
- **THEN** the response includes `config.overlayEnabled: false` and `config.overlayAllowedOrigins: []`

#### Scenario: Overlay enabled with configured origins

- **WHEN** `OVERLAY_ENABLED=true` and `ALLOWED_IFRAME_ORIGINS=https://partner.example.com` are set
- **THEN** the response includes `config.overlayEnabled: true` and `config.overlayAllowedOrigins: ["https://partner.example.com"]`

#### Scenario: Generated client type includes both fields

- **WHEN** `npm run openapi` is run after this change
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`

#### Scenario: overlayAllowedOrigins never leaks server-only origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` also happens to include an origin used for a purpose unrelated to overlay embedding
- **THEN** the response still returns the same allowlist verbatim — this key is defined as client-visible by design (the host page must know it is on the allowlist to self-diagnose), matching the existing `frame-src`/`frame-ancestors` use of this same variable, which is already effectively public (observable via the CSP response header)
