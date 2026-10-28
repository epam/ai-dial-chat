# catalog-toolsets Specification

## Purpose

Loading toolsets from the dedicated toolsets API and combining them with deployments at the app edge.

## Requirements

### Requirement: Catalog toolsets are loaded from the dedicated toolsets API

The app SHALL load catalog toolsets through the existing frontend toolsets adapter, `apps/chat/src/server-api/toolsets.ts`, by calling `listToolsets()`.

The app MUST NOT derive catalog toolsets from `GET /api/v1/deployments`. `DeploymentsProvider` does request MCP-capable deployments there (`getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp])`, per the deployments-context spec), but those rows stay deployment items in `DeploymentsContextType.items`; catalog toolsets come only from `listToolsets()`.

The backend `GET /api/v1/toolsets` listing SHALL filter out hidden marker entries whose `id` contains `.dial_folder`, matching the existing deployments listing behavior for DIAL folder markers.

The backend `DialToolsetDto` OpenAPI response SHALL document DIAL SDK fields used by the frontend, including `features`, `allowedTools`, `transport`, `status`, timestamps, and OAuth auth fields such as `codeChallenge`.

The backend `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses SHALL return every field in camelCase, matching the `GET /api/v1/deployments` response convention, with no snake_case fields present anywhere in the payload (top-level or nested, e.g. `authSettings`). This includes:

- `isInstalled`, computed from `userConfig.toolsets.installed`
- `isMy`, computed by `computeItemOwnershipFlags` (`apps/chat-api/src/common/utils/resource-ownership.ts`): the toolset id's owner-bucket segment (the second segment for a `toolsets/`-prefixed id, otherwise the first) equals the current session bucket
- `canEdit`, computed from `isMy` or WRITE-level share access
- `sharedWithMe`, computed from non-owned share access
- `displayName`, `displayVersion`, `iconUrl`, `descriptionKeywords`, `maxRetryAttempts`, `createdAt`, `updatedAt`, `allowedTools` — remapped from the corresponding raw DIAL Core snake_case fields
- `authSettings`, with nested fields remapped to camelCase (`authenticationType`, `apiKeyHeader`, `clientId`, `redirectUri`, `authorizationEndpoint`, `tokenEndpoint`, `codeChallenge`, `codeChallengeMethod`, `scopesSupported`, `globalAuthStatus`, `userLevelAuthStatus`, `dynamicallyRegistered`), continuing to exclude `clientSecret`/`codeVerifier`
- `features`, typed as `DialToolsetFeaturesDto` with nested fields remapped to camelCase (`truncatePrompt`, `systemPrompt`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts`, plus unprefixed `rate`, `tokenize`, `configuration`, `tools`, `seed`, `temperature`, `cache`, `mcp`) — distinct from the shared, intentionally-snake_case `DialModelFeaturesDto` used by the out-of-scope `GET /api/v1/models`

The frontend toolsets adapter (`apps/chat/src/server-api/toolsets.ts`) SHALL pass through the `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses without field-name normalization, since the backend already returns camelCase fields.

#### Scenario: Provider loads toolsets in parallel with deployments

- **WHEN** `DeploymentsProvider` starts loading catalog/model data
- **THEN** it calls `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp])`
- **AND** it calls `getApplicationSchemas()`
- **AND** it calls `listToolsets()`
- **AND** it exposes the returned `DialToolsetListResponseDto.data` (`DialToolsetDto[]`, sorted by `sortToolsets`) as `toolsets` on `DeploymentsContextType`

#### Scenario: Toolsets expose user ownership and installation state in camelCase

- **GIVEN** the user config contains a toolset id in `toolsets.installed`
- **AND** the toolset id's owner-bucket segment is the current session bucket
- **WHEN** the authenticated user calls `GET /api/v1/toolsets`
- **THEN** that toolset has `isInstalled: true`
- **AND** `isMy: true`
- **AND** the response contains no `is_installed` or `is_my` keys

#### Scenario: Hidden marker toolsets are not returned

- **GIVEN** DIAL Core returns a toolset with an `id` containing `.dial_folder`
- **WHEN** the authenticated user calls `GET /api/v1/toolsets`
- **THEN** the response excludes that marker toolset

#### Scenario: Toolsets fetch failure does not fail deployments

- **WHEN** `listToolsets()` rejects
- **AND** `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp])` succeeds
- **THEN** `DeploymentsContextType.items` contains the loaded deployments
- **AND** `DeploymentsContextType.toolsets` is an empty array
- **AND** `DeploymentsContextType.error` remains `null`
- **AND** the provider logs a warning

### Requirement: Catalog combines deployments and toolsets at the app edge

`CatalogView` SHALL build catalog items through the app-level `useCatalogItems` hook (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`), which combines (alongside prompts and skills):

- `DeploymentsContextType.items`, mapped with the deployment-to-catalog mapper, passing `isToolsetTabEnabled: isToolsetsEnabled` so MCP applications are listed under Toolsets only while the Toolsets UI feature is on (see [catalog-interface-classification](../catalog-interface-classification/spec.md))
- `DeploymentsContextType.toolsets`, mapped with the app-level `mapToolsetToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) — only while the `OverlayFeature.Toolsets` UI feature (`isToolsetsEnabled`) is on

The Toolsets tab therefore lists both toolsets and MCP applications. An MCP application keeps its application entity kind (`type: CatalogEntityType.Agent`) and its application behavior (edit, delete, share, publish, favorites, application MCP URL); it is never mapped through the toolset mapper and never gets toolset credentials, a toolset id, or a `toolsets.installed` favorite.

The toolset mapper SHALL convert each `DialToolsetDto` to a `CatalogItem` with:

- `id` from `toolset.id`
- `type: CatalogEntityType.Toolset`
- `name` from `displayName` resolved for the active locale (`resolveLocalizedText`), falling back to `toolset`, then `reference`, then `id`
- `description` from `description` resolved for the active locale, falling back to empty string
- `iconUrl` resolved through the existing catalog icon resolver
- `version` from `displayVersion`, falling back to empty string
- `updatedAt` from `updatedAt`, `createdAt` from `createdAt`, and `lastUsed` from `formatLastUsed(updatedAt)`
- `topics` from `descriptionKeywords`, falling back to an empty array
- `folder` from the localized ownership/root label and any decoded nested path, following the [deployment-catalog-item-mapping](../deployment-catalog-item-mapping/spec.md) rules; configured toolsets with plain IDs SHALL show the Organization label when neither owned nor shared
- `details.tools.tools` from `allowedTools`, when present
- `isMyApp` from `isMy`, `sharedWithMe` from `sharedWithMe`, and `isEditable` from `isMy || canEdit`
- `credentials` from `authSettings` via `mapDeploymentToolsetCredentials`
- favorite/starred state from user-config installed ids

The app-owned wrapper in `apps/chat` SHALL resolve translations and icon URLs and delegate the DTO mapping to `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`, following [chat-hooks-domain-utilities](../chat-hooks-domain-utilities/spec.md). `libs/catalog` SHALL consume resolved `CatalogItem` values without interpreting DIAL identifiers or ownership metadata.

#### Scenario: Catalog renders toolset items

- **GIVEN** `DeploymentsContextType.items` contains a model deployment
- **AND** `DeploymentsContextType.toolsets` contains a toolset
- **AND** the `OverlayFeature.Toolsets` UI feature is enabled
- **WHEN** `CatalogView` renders
- **THEN** the `Catalog` component receives one model catalog item
- **AND** one toolset catalog item with `type: CatalogEntityType.Toolset`

#### Scenario: MCP application is listed under Toolsets as an application

- **GIVEN** `DeploymentsContextType.items` contains an application with `interfaces: ['mcp']`
- **AND** the `OverlayFeature.Toolsets` UI feature is enabled
- **WHEN** `CatalogView` renders
- **THEN** the `Catalog` component receives one item for it with `type: CatalogEntityType.Agent` and `catalogTabs: [CatalogEntityType.Toolset]`

#### Scenario: Conversation selector remains deployment-only

- **GIVEN** `DeploymentsContextType.toolsets` contains toolsets
- **WHEN** conversation/model selector surfaces read `DeploymentsContextType.items`
- **THEN** they receive only the deployments loaded from `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp, ListDeploymentsInterfaceTypeEnum.CustomUi])`, never `DialToolsetDto` entries

#### Scenario: Installed toolsets appear as catalog favorites

- **GIVEN** user config contains a toolset id in `toolsets.installed`
- **WHEN** `CatalogView` renders that toolset
- **THEN** the toolset catalog item is marked favorite/starred
- **AND** it is included in the catalog favorites list

#### Scenario: Toggling a toolset favorite updates toolset installation config

- **WHEN** the user favorites or unfavorites a toolset catalog item
- **THEN** the frontend calls the user-config toolset installed endpoint
- **AND** it MUST NOT call the deployments installed endpoint for that toolset

#### Scenario: Toggling an MCP application favorite from the Toolsets tab updates deployment installation config

- **WHEN** the user favorites an MCP application from the Toolsets tab
- **THEN** the frontend calls the deployments installed endpoint, as for any application
- **AND** it MUST NOT call the user-config toolset installed endpoint

### Requirement: Catalog UI labels include Toolsets

`CatalogView` SHALL pass a translated `CatalogEntityType.Toolset` tab label to the catalog component.

#### Scenario: Toolsets tab has app-level i18n label

- **WHEN** `CatalogView` renders catalog titles
- **THEN** `titles.tabLabels[CatalogEntityType.Toolset]` uses the `catalog.tab.toolsets` translation key

### Requirement: Toolset auth settings expose the stored client secret hint

The backend `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses SHALL include `authSettings.clientSecretHint` whenever DIAL Core's `auth_settings` carries `client_secret_hint`, copied unchanged (no masking, trimming, or padding). The field SHALL be documented on `DialToolsetAuthSettingsDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) as an optional string and mapped by `mapAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`) through its existing allowlist. For a custom toolset, the hint comes from the `getCustomToolSet` response, whose `auth_settings` wins in `mergeCustomToolsetDetails`.

The responses SHALL continue to exclude `clientSecret`/`codeVerifier`. The hint SHALL NOT be accepted on any toolset write: `ToolsetBodyDto` gains no hint field (so the global `ValidationPipe` rejects one with `400`), and `preserveHiddenAuthSettings` SHALL NOT copy `client_secret_hint` into the DIAL Core update body.

Generated-client impact: operationIds `listToolsets` / `getToolset` are unchanged; `DialToolsetAuthSettingsDto` in `libs/chat-api-client` gains optional `clientSecretHint`, regenerated through `npm run openapi`. Frontend callers keep using the normal (non-`Raw`) generated methods via `apps/chat/src/server-api/toolsets.ts`.

Caching is unchanged: the hint is part of the mapped DTO cached under `toolsets:single:<user.sub>:<toolsetName>` (60 s) and is cleared with it by `ToolsetsListingService.invalidateCaches` after every toolset write.

Example response fragment (`GET /api/v1/toolsets/toolsets%2F<bucket>%2Fgithub_valery__1.0.0`, 200):

```json
{
  "authSettings": {
    "authenticationType": "OAUTH",
    "dynamicallyRegistered": false,
    "clientId": "Iv23li6Tjp68EjvaPGsd",
    "clientSecretHint": "d4c6",
    "redirectUri": "http://localhost:4207/auth/toolset-signin",
    "authorizationEndpoint": "https://github.com/login/oauth/authorize",
    "tokenEndpoint": "https://github.com/login/oauth/access_token",
    "globalAuthStatus": "SIGNED_OUT",
    "userLevelAuthStatus": "SIGNED_IN"
  }
}
```

#### Scenario: Core hint is forwarded unchanged

- **GIVEN** DIAL Core's `getCustomToolSet` response has `auth_settings.client_secret_hint: "d4c6"`
- **WHEN** the authenticated user calls `GET /api/v1/toolsets/{toolsetName}`
- **THEN** the response has `authSettings.clientSecretHint: "d4c6"`
- **AND** it has no `clientSecret`, `client_secret`, or `codeVerifier` field anywhere

#### Scenario: No hint from Core

- **GIVEN** DIAL Core's toolset response has no `client_secret_hint`
- **WHEN** the user calls `GET /api/v1/toolsets/{toolsetName}`
- **THEN** `authSettings.clientSecretHint` is absent

#### Scenario: Hint is rejected on write

- **WHEN** a client sends `PATCH /api/v1/toolsets/{toolsetName}` with `authSettings.clientSecretHint` in the body
- **THEN** the request is rejected with `400 Bad Request` and nothing is sent to DIAL Core
