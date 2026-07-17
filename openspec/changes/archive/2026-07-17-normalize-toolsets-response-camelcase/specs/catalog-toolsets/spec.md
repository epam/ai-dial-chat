## MODIFIED Requirements

### Requirement: Catalog toolsets are loaded from the dedicated toolsets API

The app SHALL load catalog toolsets through the existing frontend toolsets adapter, `apps/chat/src/server-api/toolsets.ts`, by calling `listToolsets()`.

The app MUST NOT load catalog toolsets by requesting MCP deployments from `GET /api/v1/deployments`.

The backend `GET /api/v1/toolsets` listing SHALL filter out hidden marker entries whose `id` contains `.dial_folder`, matching the existing deployments listing behavior for DIAL folder markers.

The backend `DialToolsetDto` OpenAPI response SHALL document DIAL SDK fields used by the frontend, including `features`, `allowedTools`, `transport`, `status`, timestamps, and OAuth auth fields such as `codeChallenge`.

The backend `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses SHALL return every field in camelCase, matching the `GET /api/v1/deployments` response convention, with no snake_case fields present anywhere in the payload (top-level or nested, e.g. `authSettings`). This includes:

- `isInstalled`, computed from `userConfig.toolsets.installed`
- `isMy`, computed by checking whether the current session bucket appears as a path segment in the toolset id/path
- `canEdit`, computed from `isMy` or WRITE-level share access
- `sharedWithMe`, computed from non-owned share access
- `displayName`, `displayVersion`, `iconUrl`, `descriptionKeywords`, `maxRetryAttempts`, `createdAt`, `updatedAt`, `allowedTools` — remapped from the corresponding raw DIAL Core snake_case fields
- `authSettings`, with nested fields remapped to camelCase (`authenticationType`, `apiKeyHeader`, `clientId`, `redirectUri`, `authorizationEndpoint`, `tokenEndpoint`, `codeChallenge`, `codeChallengeMethod`, `scopesSupported`, `globalAuthStatus`, `userLevelAuthStatus`), continuing to exclude `clientSecret`/`codeVerifier`
- `features`, typed as `DialToolsetFeaturesDto` with nested fields remapped to camelCase (`truncatePrompt`, `systemPrompt`, `urlAttachments`, `folderAttachments`, `allowResume`, `accessibleByPerRequestKey`, `contentParts`, `autoCaching`, `parallelToolCalls`, `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `maxTokensSupported`, `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts`, plus unprefixed `rate`, `tokenize`, `configuration`, `tools`, `seed`, `temperature`, `cache`, `mcp`) — distinct from the shared, intentionally-snake_case `DialModelFeaturesDto` used by the out-of-scope `GET /api/v1/models`

The frontend toolsets adapter (`apps/chat/src/server-api/toolsets.ts`) SHALL pass through the `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses without field-name normalization, since the backend already returns camelCase fields.

#### Scenario: Provider loads toolsets in parallel with deployments

- **WHEN** `DeploymentsProvider` starts loading catalog/model data
- **THEN** it calls `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`
- **AND** it calls `getApplicationSchemas()`
- **AND** it calls `listToolsets()`
- **AND** it exposes the returned `DialToolsetDto[]` as `toolsets` on `DeploymentsContextType`

#### Scenario: Toolsets expose user ownership and installation state in camelCase

- **GIVEN** the user config contains a toolset id in `toolsets.installed`
- **AND** the toolset id/path includes the current session bucket as a path segment
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
- **AND** `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])` succeeds
- **THEN** `DeploymentsContextType.items` contains the loaded deployments
- **AND** `DeploymentsContextType.toolsets` is an empty array
- **AND** `DeploymentsContextType.error` remains `null`
- **AND** the provider logs a warning
