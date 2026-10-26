## ADDED Requirements

### Requirement: Toolset details expose the stored client secret hint

`ToolsetAuthSettingsDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`) SHALL gain an optional `clientSecretHint?: string`, mapped by `mapToolsetAuthSettings` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) from DIAL Core's `auth_settings.client_secret_hint` without modification, so `GET /api/v1/deployments/{deployment}/details` for a toolset carries it in `toolsetDetails.authSettings`. `client_secret` and `code_verifier` SHALL remain unread and unforwarded, and the debug log of the raw Core toolset response SHALL keep redacting them through `redactToolsetAuthSettings`; the hint is not a secret and needs no redaction.

Generated-client impact: operationId `getDeploymentDetails` is unchanged; the generated `ToolsetAuthSettingsDto` gains optional `clientSecretHint`. No frontend surface reading `toolsetDetails.authSettings` (catalog details, `AppEditorIframe`) is required to render it.

Caching is unchanged: the field rides in the existing `deployments:details:<user.sub>:<deployment>` entry (60 s), which `ToolsetsListingService.invalidateCaches` clears after every toolset write.

#### Scenario: Toolset details carry the hint

- **GIVEN** DIAL Core's `getToolset` response for `toolsets/<bucket>/github_valery__1.0.0` has `auth_settings.client_secret_hint: "d4c6"`
- **WHEN** the user calls `GET /api/v1/deployments/toolsets%2F<bucket>%2Fgithub_valery__1.0.0/details`
- **THEN** `toolsetDetails.authSettings.clientSecretHint` is `"d4c6"`
- **AND** `toolsetDetails.authSettings` has no `clientSecret` or `codeVerifier`
